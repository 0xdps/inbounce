import { randomUUID } from 'crypto';
import { z } from 'zod';
import db from '../../core/db.js';
import logger from '../../core/logger.js';
import { cacheGet, cacheSet } from '../../core/cache.js';

const MAX_BODY_BYTES = 16 * 1024; // 16KB
const MAX_FIELDS     = 50;
const MAX_STR_LEN    = 10_000;

const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|localhost)/;

async function fetchGeo(ip, submissionId) {
  if (!ip || PRIVATE_IP_RE.test(ip)) return;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return;
    const geo = await res.json();
    if (geo.status !== 'success') return;
    const sub = await db.findOne('submissions', { id: submissionId });
    if (!sub) return;
    const existing = sub.meta ? JSON.parse(sub.meta) : {};
    await db.exec(
      'UPDATE submissions SET meta = ? WHERE id = ?',
      [JSON.stringify({ ...existing, geo: { city: geo.city, region: geo.regionName, country: geo.country, isp: geo.isp } }), submissionId]
    );
  } catch {
    // geo is optional — ignore failures
  }
}

const TYPE_VALIDATORS = {
  string:  () => z.string().min(1).max(MAX_STR_LEN),
  email:   () => z.string().email().max(MAX_STR_LEN),
  number:  () => z.coerce.number(),
  boolean: () => z.coerce.boolean(),
  url:     () => z.string().url().max(MAX_STR_LEN),
  date:    () => z.string().max(MAX_STR_LEN).refine((v) => !isNaN(Date.parse(v)), { message: 'Invalid date' }),
};

function buildZodSchema(fields) {
  const shape = {};
  for (const field of fields) {
    const validator = TYPE_VALIDATORS[field.type] ?? TYPE_VALIDATORS.string;
    let schema = validator();
    if (!field.required) schema = schema.optional();
    shape[field.name] = schema;
  }
  return z.object(shape).strict();
}

export async function registerInboundRoutes(server) {
  // Handle CORS preflight for the public endpoint
  server.options('/s/:api_key', async (request, reply) => {
    const origin = request.headers.origin;
    reply.header('Access-Control-Allow-Origin', origin || '*');
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
    reply.header('Access-Control-Max-Age', '86400');
    return reply.status(204).send();
  });

  // POST /s/:api_key  — public inbound submission endpoint
  server.post('/s/:api_key', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
        keyGenerator: (req) => `${req.ip}:${req.params.api_key}`,
        errorResponseBuilder: (_req, reply) => {
          reply.statusCode = 200;
          return { ok: true };
        },
      },
    },
  }, async (request, reply) => {
    const origin = request.headers.origin;

    // Always set permissive CORS on this public endpoint
    reply.header('Access-Control-Allow-Origin', origin || '*');
    reply.header('Access-Control-Allow-Credentials', 'true');

    try {
      // Body size guard — silently ok if too large, just drop it
      const contentLength = parseInt(request.headers['content-length'] || '0', 10);
      if (contentLength > MAX_BODY_BYTES) {
        return reply.status(200).send({ ok: true });
      }

      const body = request.body;

      // Malformed / missing body — silently ok
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return reply.status(200).send({ ok: true });
      }
      if (Object.keys(body).length > MAX_FIELDS) {
        return reply.status(200).send({ ok: true });
      }

      // Honeypot check — fake ok to confuse bots
      if (body._hp) {
        return reply.status(200).send({ ok: true, id: randomUUID() });
      }

      // Strip honeypot field before validation
      const { _hp, ...payload } = body;

      // Look up app (TTL-cached, 60s) — silently ok if not found
      const apiKey = request.params.api_key;
      const appCacheKey = `app:${apiKey}`;
      let app = cacheGet(appCacheKey);
      if (!app) {
        app = await db.findOne('apps', { api_key: apiKey });
        if (app) cacheSet(appCacheKey, app);
      }
      if (!app) return reply.status(200).send({ ok: true });

      // Per-app CORS origin check — silently ok (don't expose origin config)
      const allowedOrigins = JSON.parse(app.allowed_origins || '[]');
      if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) {
        return reply.status(200).send({ ok: true });
      }

      // Load schema (TTL-cached, 60s)
      const schemaCacheKey = `schema:${app.id}`;
      let fields = cacheGet(schemaCacheKey);
      if (!fields) {
        fields = await db.find('schema_fields', { app_id: app.id }, {
          orderBy: 'position',
          order: 'ASC',
        });
        cacheSet(schemaCacheKey, fields);
      }

      // No schema yet — silently ok
      if (fields.length === 0) {
        return reply.status(200).send({ ok: true });
      }

      // Validate with Zod — silently ok on failure (caller gets no hint)
      const schema = buildZodSchema(fields);
      const result = schema.safeParse(payload);
      if (!result.success) {
        return reply.status(200).send({ ok: true });
      }

      const validatedData = result.data;

      // Idempotency key check
      const idempotencyKey = request.headers['idempotency-key'] || null;
      if (idempotencyKey) {
        const existing = await db.findOne('submissions', { idempotency_key: idempotencyKey });
        if (existing) {
          return reply.status(200).send({ ok: true, id: existing.id });
        }
      }

      // Individual unique field checks — duplicates bump a counter, always return ok
      for (const field of fields) {
        if (!field.unique || field.compound_key) continue;
        const value = validatedData[field.name];
        if (value === undefined) continue;

        const hit = await db.exec(
          `SELECT id FROM submissions WHERE app_id = ? AND json_extract(data, '$.${field.name}') = ? LIMIT 1`,
          [app.id, String(value)]
        );
        const orig = hit?.rows?.[0];
        if (orig) {
          await db.exec(
            'UPDATE submissions SET dup_count = dup_count + 1, last_seen_at = ? WHERE id = ?',
            [Math.floor(Date.now() / 1000), orig.id]
          );
          return reply.status(200).send({ ok: true });
        }
      }

      // Compound unique checks
      const compoundGroups = {};
      for (const field of fields) {
        if (!field.compound_key) continue;
        if (!compoundGroups[field.compound_key]) compoundGroups[field.compound_key] = [];
        compoundGroups[field.compound_key].push(field);
      }
      for (const groupFields of Object.values(compoundGroups)) {
        const present = groupFields.filter(f => validatedData[f.name] !== undefined);
        if (present.length === 0) continue;
        const conditions = present.map(f => `json_extract(data, '$.${f.name}') = ?`);
        const params     = present.map(f => String(validatedData[f.name]));
        const hit = await db.exec(
          `SELECT id FROM submissions WHERE app_id = ? AND ${conditions.join(' AND ')} LIMIT 1`,
          [app.id, ...params]
        );
        const orig = hit?.rows?.[0];
        if (orig) {
          await db.exec(
            'UPDATE submissions SET dup_count = dup_count + 1, last_seen_at = ? WHERE id = ?',
            [Math.floor(Date.now() / 1000), orig.id]
          );
          return reply.status(200).send({ ok: true });
        }
      }

      // Insert submission
      const id = randomUUID();
      const now = Math.floor(Date.now() / 1000);

      const meta = JSON.stringify({
        ua:       request.headers['user-agent'] ?? null,
        referrer: request.headers['referer'] || request.headers['referrer'] || null,
      });

      await db.insert('submissions', {
        id,
        app_id:           app.id,
        data:             JSON.stringify(validatedData),
        idempotency_key:  idempotencyKey,
        ip:               request.ip,
        meta,
        created_at:       now,
      });

      logger.info({ appId: app.id, submissionId: id }, 'Submission received');
      reply.status(200).send({ ok: true, id });

      // Fire-and-forget geo enrichment (doesn't block response)
      fetchGeo(request.ip, id);

    } catch (err) {
      logger.error({ err }, 'Unhandled error in submission handler');
      reply.status(500).send({ ok: false, error: 'Internal server error' });
    }
  });
}
