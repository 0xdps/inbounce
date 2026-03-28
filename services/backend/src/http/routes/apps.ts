import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID, randomBytes } from 'crypto';
import db from '../../core/db.js';
import logger from '../../core/logger.js';
import { authHook } from '../middleware/auth.js';
import { createUniqueSlug, getSubmissionsTableName } from '../../core/slug.js';
import { ensureAppTables, dropAppTables } from '../../core/tables.js';
import { invalidateSchemaCacheForApp, invalidateAppMetadataCacheForApp } from '../../core/caches.js';

interface App {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  api_key: string;
  allowed_origins: string;
  created_at: number;
}

interface AppResponse extends Omit<App, 'allowed_origins'> {
  allowed_origins: string[];
  submission_count: number;
}

function parseApp(app: App): Omit<AppResponse, 'submission_count'> {
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    description: app.description,
    api_key: app.api_key,
    allowed_origins: JSON.parse(app.allowed_origins || '[]'),
    created_at: app.created_at,
  };
}

export async function registerAppsRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/apps
  server.get('/api/apps', { preHandler: [authHook] }, async () => {
    const apps = (await db.find('apps', {}, { orderBy: 'created_at', order: 'DESC' })) as App[];
    const result = await Promise.all(
      apps.map(async (app) => {
        const submissionsTable = getSubmissionsTableName(app.slug);
        const submission_count = await db.count(submissionsTable, {});
        return {
          ...parseApp(app),
          submission_count,
        };
      })
    );
    return result;
  });

  // POST /api/apps
  server.post<{ Body: { name: string; description?: string; allowed_origins?: string[] } }>(
    '/api/apps',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { name, description, allowed_origins } = (request.body as any) || {};

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return reply.status(400).send({ error: 'App name is required' });
      }

      const id = randomUUID();
      const api_key = randomBytes(32).toString('hex');
      const now = Math.floor(Date.now() / 1000);

      // Generate unique slug
      const slug = await createUniqueSlug(name.trim(), async (candidate) => {
        const existing = await db.findOne('apps', { slug: candidate });
        return !!existing;
      });

      const originsJson = JSON.stringify(Array.isArray(allowed_origins) ? allowed_origins : []);

      await db.insert('apps', {
        id,
        slug,
        name: name.trim(),
        description: description?.trim() || null,
        api_key,
        allowed_origins: originsJson,
        created_at: now,
      });

      // Create per-app tables
      await ensureAppTables(db, slug);

      logger.info({ appId: id, slug }, 'App created');
      return reply.status(201).send({
        id,
        slug,
        name: name.trim(),
        description: description?.trim() || null,
        api_key,
        allowed_origins: JSON.parse(originsJson),
        created_at: now,
      });
    }
  );

  // GET /api/apps/:slug
  server.get<{ Params: { slug: string } }>(
    '/api/apps/:slug',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = (await db.findOne('apps', { slug: (request.params as any).slug })) as App | null;
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const submissionsTable = getSubmissionsTableName(app.slug);
      const submission_count = await db.count(submissionsTable, {});

      return { ...parseApp(app), submission_count };
    }
  );

  // PUT /api/apps/:slug
  server.put<{ Params: { slug: string }; Body: { name?: string; description?: string; allowed_origins?: string[] } }>(
    '/api/apps/:slug',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = (await db.findOne('apps', { slug: (request.params as any).slug })) as App | null;
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const { name, description, allowed_origins } = (request.body as any) || {};
      const updates: Record<string, unknown> = {};

      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description?.trim() || null;
      if (allowed_origins !== undefined) {
        updates.allowed_origins = JSON.stringify(Array.isArray(allowed_origins) ? allowed_origins : []);
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      await db.update('apps', updates, { id: app.id });
      invalidateAppMetadataCacheForApp(app.slug);

      return parseApp({ ...app, ...updates } as App);
    }
  );

  // DELETE /api/apps/:slug
  server.delete<{ Params: { slug: string } }>(
    '/api/apps/:slug',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = (await db.findOne('apps', { slug: (request.params as any).slug })) as App | null;
      if (!app) return reply.status(404).send({ error: 'App not found' });

      // Drop app tables
      await dropAppTables(db, app.slug);

      // Delete app record
      await db.delete('apps', { id: app.id });

      // Invalidate caches
      invalidateSchemaCacheForApp(app.slug);
      invalidateAppMetadataCacheForApp(app.slug);

      logger.info({ appId: app.id, slug: app.slug }, 'App deleted');
      return reply.status(204).send();
    }
  );

  // POST /api/apps/:slug/rotate-key
  server.post<{ Params: { slug: string } }>(
    '/api/apps/:slug/rotate-key',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = (await db.findOne('apps', { slug: (request.params as any).slug })) as App | null;
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const api_key = randomBytes(32).toString('hex');
      await db.update('apps', { api_key }, { id: app.id });
      invalidateAppMetadataCacheForApp(app.slug);

      logger.info({ appId: app.id, slug: app.slug }, 'API key rotated');
      return { api_key };
    }
  );
}
