import { randomUUID } from 'crypto';
import db from '../../core/db.js';
import { authHook } from '../middleware/auth.js';

const VALID_TYPES = new Set(['string', 'email', 'number', 'boolean', 'url', 'date']);
const RESERVED_NAMES = new Set(['id', 'app_id', 'data', 'idempotency_key', 'ip', 'created_at']);
const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return 'fields must be a non-empty array';
  }
  if (fields.length > 50) {
    return 'Maximum 50 fields allowed';
  }
  const names = new Set();
  for (const f of fields) {
    if (!f.name || typeof f.name !== 'string') return 'Each field must have a name';
    if (!FIELD_NAME_RE.test(f.name)) return `Invalid field name: "${f.name}" — use letters, numbers, underscores only`;
    if (RESERVED_NAMES.has(f.name)) return `"${f.name}" is a reserved field name`;
    if (!VALID_TYPES.has(f.type)) return `Invalid type: "${f.type}" — allowed: ${[...VALID_TYPES].join(', ')}`;
    if (names.has(f.name)) return `Duplicate field name: "${f.name}"`;
    if (f.compound_key !== null && f.compound_key !== undefined && f.compound_key !== '') {
      if (!FIELD_NAME_RE.test(f.compound_key)) return `Invalid compound_key: "${f.compound_key}" — use letters, numbers, underscores only`;
    }
    names.add(f.name);
  }
  return null;
}

export async function registerSchemaRoutes(server) {
  // GET /api/apps/:id/schema
  server.get('/api/apps/:id/schema', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const fields = await db.find('schema_fields', { app_id: app.id }, {
      orderBy: 'position',
      order: 'ASC',
    });
    return fields;
  });

  // PUT /api/apps/:id/schema
  server.put('/api/apps/:id/schema', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const { fields } = request.body || {};
    const error = validateFields(fields);
    if (error) return reply.status(400).send({ error });

    // Delete existing fields and replace
    await db.delete('schema_fields', { app_id: app.id });

    const rows = fields.map((f, i) => ({
      id:           randomUUID(),
      app_id:       app.id,
      name:         f.name,
      type:         f.type,
      required:     f.required ? 1 : 0,
      unique:       f.unique ? 1 : 0,
      position:     f.position ?? i,
      compound_key: (f.compound_key && FIELD_NAME_RE.test(f.compound_key)) ? f.compound_key : null,
    }));

    if (rows.length > 0) {
      await db.insertMany('schema_fields', rows);
    }

    return rows;
  });
}
