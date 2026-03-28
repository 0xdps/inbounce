import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../../core/db.js';
import { authHook } from '../middleware/auth.js';
import { cacheDel } from '../../core/cache.js';

const VALID_TYPES = new Set(['string', 'email', 'number', 'boolean', 'url', 'date']);
const RESERVED_NAMES = new Set(['id', 'app_id', 'data', 'idempotency_key', 'ip', 'created_at']);
const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface FieldInput {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  position?: number;
  compound_key?: string;
}

interface SchemaField extends FieldInput {
  id: string;
  app_id: string;
  required: number;
  unique: number;
  position: number;
  compound_key: string | null;
}

function validateFields(fields: unknown): string | null {
  if (!Array.isArray(fields) || fields.length === 0) {
    return 'fields must be a non-empty array';
  }
  if (fields.length > 50) {
    return 'Maximum 50 fields allowed';
  }
  const names = new Set<string>();
  for (const f of fields) {
    const field = f as Partial<FieldInput>;
    if (!field.name || typeof field.name !== 'string') return 'Each field must have a name';
    if (!FIELD_NAME_RE.test(field.name)) return `Invalid field name: "${field.name}" — use letters, numbers, underscores only`;
    if (RESERVED_NAMES.has(field.name)) return `"${field.name}" is a reserved field name`;
    if (!VALID_TYPES.has(field.type || '')) return `Invalid type: "${field.type}" — allowed: ${[...VALID_TYPES].join(', ')}`;
    if (names.has(field.name)) return `Duplicate field name: "${field.name}"`;
    if (field.compound_key !== null && field.compound_key !== undefined && field.compound_key !== '') {
      if (!FIELD_NAME_RE.test(field.compound_key))
        return `Invalid compound_key: "${field.compound_key}" — use letters, numbers, underscores only`;
    }
    names.add(field.name);
  }
  return null;
}

export async function registerSchemaRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/apps/:id/schema
  server.get<{ Params: { id: string } }>(
    '/api/apps/:id/schema',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await db.findById('apps', request.params.id);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const fields = (await db.find('schema_fields', { app_id: app.id }, {
        orderBy: 'position',
        order: 'ASC',
      })) as SchemaField[];
      return fields;
    }
  );

  // PUT /api/apps/:id/schema
  server.put<{ Params: { id: string }; Body: { fields: FieldInput[] } }>(
    '/api/apps/:id/schema',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await db.findById('apps', request.params.id);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const { fields } = request.body || {};
      const error = validateFields(fields);
      if (error) return reply.status(400).send({ error });

      // Delete existing fields and replace
      await db.delete('schema_fields', { app_id: app.id });

      const rows = (fields as FieldInput[]).map((f, i) => ({
        id: randomUUID(),
        app_id: app.id,
        name: f.name,
        type: f.type,
        required: f.required ? 1 : 0,
        unique: f.unique ? 1 : 0,
        position: f.position ?? i,
        compound_key: f.compound_key && FIELD_NAME_RE.test(f.compound_key) ? f.compound_key : null,
      }));

      if (rows.length > 0) {
        await db.insertMany('schema_fields', rows);
      }

      cacheDel(`schema:${app.id}`);
      return rows;
    }
  );
}
