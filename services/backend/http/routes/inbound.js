import { randomUUID } from 'crypto';
import { z } from 'zod';
import db from '../../core/db.js';
import logger from '../../core/logger.js';

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
        errorResponseBuilder: () => ({ error: 'Too many submissions — slow down' }),
      },
    },
  }, async (request, reply) => {
    const origin = request.headers.origin;

    // Always set permissive CORS on this public endpoint;
    // per-app origin enforcement happens below via 403
    reply.header('Access-Control-Allow-Origin', origin || '*');
    reply.header('Access-Control-Allow-Credentials', 'true');

    // Body size guard
    const contentLength = parseInt(request.headers['content-length'] || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return reply.status(413).send({ error: 'Payload too large' });
    }

    const body = request.body;

    // Field count guard
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply.status(400).send({ error: 'Request body must be a JSON object' });
    }
    if (Object.keys(body).length > MAX_FIELDS) {
      return reply.status(400).send({ error: `Too many fields — maximum is ${MAX_FIELDS}` });
    }

    // Honeypot check — silent fake 201 to confuse bots
    if (body._hp) {
      return reply.status(201).send({ ok: true, id: randomUUID() });
    }

    // Strip honeypot field before validation
    const { _hp, ...payload } = body;

    // Look up app
    const app = await db.findOne('apps', { api_key: request.params.api_key });
    if (!app) return reply.status(404).send({ error: 'App not found' });

    // Per-app CORS origin check
    const allowedOrigins = JSON.parse(app.allowed_origins || '[]');
    if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) {
      return reply.status(403).send({ error: 'Origin not allowed' });
    }

    // Load schema
    const fields = await db.find('schema_fields', { app_id: app.id }, {
      orderBy: 'position',
      order: 'ASC',
    });

    if (fields.length === 0) {
      return reply.status(409).send({ error: 'Schema not defined yet — define fields in the dashboard first' });
    }

    // Validate with Zod
    const schema = buildZodSchema(fields);
    const result = schema.safeParse(payload);
    if (!result.success) {
      const first = result.error.errors[0];
      const field = first.path.join('.') || 'unknown';
      return reply.status(400).send({ error: `${first.message} (field: ${field})` });
    }

    const validatedData = result.data;

    // Idempotency key check
    const idempotencyKey = request.headers['idempotency-key'] || null;
    if (idempotencyKey) {
      const existing = await db.findOne('submissions', { idempotency_key: idempotencyKey });
      if (existing) {
        return reply.status(201).send({ ok: true, id: existing.id });
      }
    }

    // Unique field checks
    for (const field of fields) {
      if (!field.unique) continue;
      const value = validatedData[field.name];
      if (value === undefined) continue;

      const rows = await db.exec(
        `SELECT COUNT(*) AS n FROM submissions WHERE app_id = ? AND json_extract(data, '$.${field.name}') = ?`,
        [app.id, String(value)]
      );
      const count = rows?.rows?.[0]?.n ?? 0;
      if (count > 0) {
        return reply.status(409).send({ error: `Duplicate value for unique field: ${field.name}` });
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
    reply.status(201).send({ ok: true, id });

    // Fire-and-forget geo enrichment (doesn't block response)
    fetchGeo(request.ip, id);
  });
}
