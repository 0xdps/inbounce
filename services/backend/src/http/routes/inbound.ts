import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../../core/db.js';
import logger from '../../core/logger.js';
import {
  getZodSchema,
  getAppMetadata,
  initializeCacheResetTimer,
} from '../../core/caches.js';
import { getQuotedSchemaFieldsTableName, getQuotedSubmissionsTableName, getSubmissionsTableName } from '../../core/slug.js';
import { ensureAppTables } from '../../core/tables.js';
import { SchemaField } from '../../core/schema-builder.js';
import config from '../../core/config.js';

const MAX_BODY_BYTES = 16 * 1024; // 16KB
const MAX_FIELDS = 50;

const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|localhost)/;

async function fetchGeo(ip: string, submissionId: string, slug: string): Promise<void> {
  if (!ip || PRIVATE_IP_RE.test(ip)) return;
  try {
    const tableName = getSubmissionsTableName(slug);  // Unquoted for ORM
    const tableNameQuoted = getQuotedSubmissionsTableName(slug);  // Quoted for SQL
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,isp`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return;
    const geo = (await res.json()) as {
      status: string;
      country?: string;
      regionName?: string;
      city?: string;
      isp?: string;
    };
    if (geo.status !== 'success') return;
    const sub = (await db.findOne(tableName, { id: submissionId })) as { meta?: string } | null;
    if (!sub) return;
    const existing = sub.meta ? JSON.parse(sub.meta) : {};
    await db.exec(`UPDATE ${tableNameQuoted} SET meta = ? WHERE id = ?`, [
      JSON.stringify({
        ...existing,
        geo: { city: geo.city, region: geo.regionName, country: geo.country, isp: geo.isp },
      }),
      submissionId,
    ]);
  } catch {
    // geo is optional — ignore failures
  }
}

export async function registerInboundRoutes(server: FastifyInstance): Promise<void> {
  // Initialize cache reset timer (hourly)
  initializeCacheResetTimer(logger);

  // Handle CORS preflight for the public endpoint
  server.options('/api/submit', async (_request, reply) => {
    const origin = _request.headers.origin;
    reply.header('Access-Control-Allow-Origin', origin || '*');
    reply.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, Authorization');
    reply.header('Access-Control-Max-Age', '86400');
    return reply.status(204).send();
  });

  // POST /api/submit — public inbound submission endpoint (requires api_key in Authorization header)
  server.post<{ Body: Record<string, unknown> }>(
    '/api/submit',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          keyGenerator: (req: any) => `${req.ip}:${req.headers.authorization || 'unknown'}`,  // Rate limit by IP + API key
          errorResponseBuilder: (_req, reply) => {
            reply.statusCode = 200;
            return { ok: true };  // Silent fail for rate-limited requests
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const origin = request.headers.origin;

      // Always set permissive CORS on this public endpoint
      reply.header('Access-Control-Allow-Origin', origin || '*');
      reply.header('Access-Control-Allow-Credentials', 'true');

      // Extract and validate API key from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (config.debugInbound) {
          logger.warn({ authHeader }, 'Inbound: missing or invalid authorization header');
          return reply.status(401).send({ ok: false, error: 'Missing API key' });
        }
        return reply.status(200).send({ ok: true });
      }

      const api_key = authHeader.slice(7); // Remove "Bearer " prefix

      try {
        // Body size guard — silently ok if too large
        const contentLength = parseInt(request.headers['content-length'] || '0', 10);
        if (contentLength > MAX_BODY_BYTES) {
          if (config.debugInbound && contentLength > MAX_BODY_BYTES) {
            logger.warn({ contentLength }, 'Inbound: body too large, dropped');
            return reply.status(413).send({ ok: false, error: 'Body too large' });
          }
          return reply.status(200).send({ ok: true });
        }

        const body = request.body as Record<string, unknown>;

        // Malformed / missing body — silently ok
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          if (config.debugInbound && (!body || typeof body !== 'object' || Array.isArray(body))) {
            logger.warn({ body }, 'Inbound: malformed or missing body');
            return reply.status(400).send({ ok: false, error: 'Malformed or missing body' });
          }
          return reply.status(200).send({ ok: true });
        }
        if (Object.keys(body).length > MAX_FIELDS) {
          if (config.debugInbound && Object.keys(body).length > MAX_FIELDS) {
            logger.warn({ fieldCount: Object.keys(body).length }, 'Inbound: too many fields');
            return reply.status(400).send({ ok: false, error: 'Too many fields' });
          }
          return reply.status(200).send({ ok: true });
        }

        // Honeypot check — fake ok to confuse bots
        if ((body as Record<string, unknown>)._hp) {
          if (config.debugInbound && (body as Record<string, unknown>)._hp) {
            logger.info({ body }, 'Inbound: honeypot triggered');
            return reply.status(200).send({ ok: true, id: randomUUID(), debug: 'honeypot' });
          }
          return reply.status(200).send({ ok: true, id: randomUUID() });
        }

        // Strip honeypot field before validation
        const { _hp, ...payload } = body as Record<string, unknown>;

        // Get app metadata (cached) — lookup by API key
        const appMetadata = await getAppMetadata(api_key, async (key) => {
          return await db.findOne('apps', { api_key: key });
        });

        if (!appMetadata) {
          if (config.debugInbound) {
            logger.warn({ api_key }, 'Inbound: app not found');
            return reply.status(404).send({ ok: false, error: 'App not found' });
          }
          return reply.status(200).send({ ok: true });
        }

        const slug = appMetadata.slug;

        // Per-app CORS origin check — silently ok (don't expose origin config)
        if (appMetadata.allowed_origins.length > 0 && origin && !appMetadata.allowed_origins.includes(origin)) {
          if (config.debugInbound && appMetadata.allowed_origins.length > 0 && origin && !appMetadata.allowed_origins.includes(origin)) {
            logger.warn({ origin, allowedOrigins: appMetadata.allowed_origins }, 'Inbound: origin not allowed');
            return reply.status(403).send({ ok: false, error: 'Origin not allowed' });
          }
          return reply.status(200).send({ ok: true });
        }

        // Ensure app tables exist (idempotent)
        await ensureAppTables(db, slug);

        // Get schema (cached)
        const schemaTable = getQuotedSchemaFieldsTableName(slug);
        const zodSchema = await getZodSchema(slug, async () => {
          return (await db.find(schemaTable.slice(1, -1), {}, {  // Remove backticks for find()
            orderBy: 'position',
            order: 'ASC',
          })) as unknown as SchemaField[];
        });

        // No schema yet — silently ok if no fields were defined
        const fields = await db.find(schemaTable.slice(1, -1), {});  // Remove backticks for find()
        if (fields.length === 0) {
          if (config.debugInbound) {
            logger.warn({ slug }, 'Inbound: no schema fields');
            return reply.status(400).send({ ok: false, error: 'No schema fields' });
          }
          // Allow submission anyway (empty schema accepts any object in strict mode)
        }

        // Validate with Zod — silently ok on failure
        const result = zodSchema.safeParse(payload);
        if (!result.success) {
          if (config.debugInbound && !result.success) {
            logger.warn({ issues: result.error.issues }, 'Inbound: schema validation failed');
            return reply.status(400).send({ ok: false, error: 'Schema validation failed', details: result.error.issues });
          }
          return reply.status(200).send({ ok: true });
        }

        const validatedData = result.data;

        // Idempotency key check
        const idempotencyKey = (request.headers['idempotency-key'] as string) || null;
        const submissionsTable = getSubmissionsTableName(slug);  // Unquoted for ORM methods
        const submissionsTableQuoted = getQuotedSubmissionsTableName(slug);  // Quoted for raw SQL

        if (idempotencyKey) {
          const existing = await db.findOne(submissionsTable, { idempotency_key: idempotencyKey });
          if (existing) {
            if (config.debugInbound && idempotencyKey && existing) {
              logger.info({ idempotencyKey, existingId: (existing as { id: string }).id }, 'Inbound: idempotency key hit');
              return reply
                .status(409)
                .send({ ok: false, error: 'Duplicate idempotency key', id: (existing as { id: string }).id });
            }
            return reply.status(200).send({ ok: true, id: (existing as { id: string }).id });
          }
        }

        // Individual unique field checks — duplicates bump a counter
        const fieldsArray = (await db.find(schemaTable.slice(1, -1), {})) as unknown as SchemaField[];  // Remove backticks for find()

        for (const field of fieldsArray) {
          if (!field.unique || field.compound_key) continue;
          const value = validatedData[field.name];
          if (value === undefined) continue;

          const hit = await db.exec(
            `SELECT id FROM ${submissionsTableQuoted} WHERE json_extract(data, '$.${field.name}') = ? LIMIT 1`,
            [String(value)]
          );
          const orig = ((hit as any)?.rows?.[0] as { id: string } | undefined);
          if (orig) {
            await db.exec(`UPDATE ${submissionsTableQuoted} SET dup_count = dup_count + 1, last_seen_at = ? WHERE id = ?`, [
              Math.floor(Date.now() / 1000),
              orig.id,
            ]);
            if (config.debugInbound) {
              logger.info({ field: field.name, value }, 'Inbound: unique field duplicate');
              return reply.status(409).send({ ok: false, error: 'Duplicate unique field', field: field.name, value });
            }
            return reply.status(200).send({ ok: true });
          }
        }

        // Compound unique checks
        const compoundGroups: Record<string, SchemaField[]> = {};
        for (const field of fieldsArray) {
          if (!field.compound_key) continue;
          if (!compoundGroups[field.compound_key]) compoundGroups[field.compound_key] = [];
          compoundGroups[field.compound_key].push(field);
        }
        for (const groupFields of Object.values(compoundGroups)) {
          const present = groupFields.filter((f) => validatedData[f.name] !== undefined);
          if (present.length === 0) continue;
          const conditions = present.map((f) => `json_extract(data, '$.${f.name}') = ?`);
          const params = present.map((f) => String(validatedData[f.name]));
          const hit = await db.exec(`SELECT id FROM ${submissionsTableQuoted} WHERE ${conditions.join(' AND ')} LIMIT 1`, params);
          const orig = ((hit as any)?.rows?.[0] as { id: string } | undefined);
          if (orig) {
            await db.exec(`UPDATE ${submissionsTableQuoted} SET dup_count = dup_count + 1, last_seen_at = ? WHERE id = ?`, [
              Math.floor(Date.now() / 1000),
              orig.id,
            ]);
            if (config.debugInbound) {
              logger.info({ group: groupFields.map((f) => f.name), present }, 'Inbound: compound unique duplicate');
              return reply.status(409).send({
                ok: false,
                error: 'Duplicate compound unique group',
                group: groupFields.map((f) => f.name),
                present,
              });
            }
            return reply.status(200).send({ ok: true });
          }
        }

        // Insert submission
        const id = randomUUID();
        const now = Math.floor(Date.now() / 1000);

        const meta = JSON.stringify({
          ua: request.headers['user-agent'] ?? null,
          referrer: request.headers['referer'] || request.headers['referrer'] || null,
        });

        await db.insert(submissionsTable, {
          id,
          data: JSON.stringify(validatedData),
          idempotency_key: idempotencyKey,
          ip: request.ip,
          meta,
          created_at: now,
        });

        logger.info({ slug, submissionId: id }, 'Submission received');
        reply.status(200).send({ ok: true, id });

        // Fire-and-forget geo enrichment (doesn't block response)
        fetchGeo(request.ip as string, id, slug);
      } catch (err) {
        logger.error({ err }, 'Unhandled error in submission handler');
        reply.status(500).send({ ok: false, error: 'Internal server error' });
      }
    }
  );
}
