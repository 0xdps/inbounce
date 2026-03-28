import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../../core/db.js';
import { authHook } from '../middleware/auth.js';
import { getSchemaFieldsTableName } from '../../core/slug.js';
import { invalidateSchemaCacheForApp } from '../../core/caches.js';

const VALID_TYPES = new Set(['string', 'email', 'number', 'boolean', 'url', 'date']);
const RESERVED_NAMES = new Set(['id', 'data', 'idempotency_key', 'ip', 'created_at', 'updated_at']);
const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface FieldInput {
  name: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  position?: number;
  compound_key?: string;
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
  // GET /api/apps/:slug/schema
  server.get<{ Params: { slug: string } }>(
    '/api/apps/:slug/schema',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
      const app = await db.findOne('apps', { slug: (request.params as any).slug });
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const schemaTable = getSchemaFieldsTableName((request.params as any).slug);
      const fields = (await db.find(
        schemaTable,
        {},
        {
          orderBy: 'position',
          order: 'ASC',
        }
      )) as unknown as any[];
      
      // Transform SQLite integers to booleans for required/unique
      const transformed = fields.map(f => ({
        ...f,
        required: !!f.required,
        unique: !!f.unique,
      }));
      
      return transformed;
    }
  );

  // PUT /api/apps/:slug/schema
  server.put<{ Params: { slug: string }; Body: { fields: FieldInput[] } }>(
    '/api/apps/:slug/schema',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{ Params: { slug: string }; Body: { fields: FieldInput[] } }>, reply: FastifyReply) => {
      const app = await db.findOne('apps', { slug: (request.params as any).slug });
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const { fields } = (request.body as any) || {};
      const error = validateFields(fields);
      if (error) return reply.status(400).send({ error });

      const schemaTable = getSchemaFieldsTableName((request.params as any).slug);

      // Delete existing fields and replace
      await db.delete(schemaTable, {});

      const rows = (fields as FieldInput[]).map((f, i) => ({
        id: randomUUID(),
        name: f.name,
        type: f.type,
        required: f.required ? 1 : 0,
        unique: f.unique ? 1 : 0,
        position: f.position ?? i,
        compound_key: f.compound_key && FIELD_NAME_RE.test(f.compound_key) ? f.compound_key : null,
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      }));

      if (rows.length > 0) {
        await db.insertMany(schemaTable, rows);
      }

      // Invalidate schema cache immediately
      invalidateSchemaCacheForApp((request.params as any).slug);

      // Transform response to match frontend expectations (booleans instead of 0/1)
      const transformed = rows.map(r => ({
        ...r,
        required: !!r.required,
        unique: !!r.unique,
      }));

      return transformed;
    }
  );
}
