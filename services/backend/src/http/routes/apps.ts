import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID, randomBytes } from 'crypto';
import logger from '../../core/logger.js';
import { authHook } from '../middleware/auth.js';
import { createUniqueSlug } from '../../core/slug.js';
import { invalidateSchemaCacheForApp, invalidateAppMetadataCacheForApp } from '../../core/caches.js';
import { appRepository, tableManager } from '../../repositories/index.js';
import type { App } from '../../repositories/interfaces.js';

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
    updated_at: app.updated_at,
  };
}

export async function registerAppsRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/apps
  server.get('/api/apps', { preHandler: [authHook] }, async () => {
    const apps = await appRepository.findAll();
    const result = await Promise.all(
      apps.map(async (app) => ({
        ...parseApp(app),
        submission_count: await appRepository.submissionCount(app.slug),
      })),
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
        return !!(await appRepository.findBySlug(candidate));
      });

      const originsJson = JSON.stringify(Array.isArray(allowed_origins) ? allowed_origins : []);

      await appRepository.create({
        id,
        slug,
        name: name.trim(),
        description: description?.trim() || null,
        api_key,
        allowed_origins: originsJson,
        created_at: now,
        updated_at: now,
      });

      // Create per-app tables
      await tableManager.ensureAppTables(slug);

      logger.info({ appId: id, slug }, 'App created');
      return reply.status(201).send({
        id,
        slug,
        name: name.trim(),
        description: description?.trim() || null,
        api_key,
        allowed_origins: JSON.parse(originsJson),
        created_at: now,
        updated_at: now,
      });
    },
  );

  // GET /api/apps/:slug
  server.get<{ Params: { slug: string } }>(
    '/api/apps/:slug',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await appRepository.findBySlug((request.params as any).slug);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const submission_count = await appRepository.submissionCount(app.slug);
      return { ...parseApp(app), submission_count };
    },
  );

  // PUT /api/apps/:slug
  server.put<{ Params: { slug: string }; Body: { name?: string; description?: string; allowed_origins?: string[] } }>(
    '/api/apps/:slug',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await appRepository.findBySlug((request.params as any).slug);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const { name, description, allowed_origins } = (request.body as any) || {};
      const updates: Partial<App> = {};

      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description?.trim() || null;
      if (allowed_origins !== undefined) {
        updates.allowed_origins = JSON.stringify(
          Array.isArray(allowed_origins) ? allowed_origins : [],
        );
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      updates.updated_at = Math.floor(Date.now() / 1000);

      await appRepository.update(app.id, updates);
      invalidateAppMetadataCacheForApp(app.slug);

      return parseApp({ ...app, ...updates } as App);
    },
  );

  // DELETE /api/apps/:slug
  server.delete<{ Params: { slug: string } }>(
    '/api/apps/:slug',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await appRepository.findBySlug((request.params as any).slug);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      await tableManager.dropAppTables(app.slug);
      await appRepository.delete(app.id);

      invalidateSchemaCacheForApp(app.slug);
      invalidateAppMetadataCacheForApp(app.slug);

      logger.info({ appId: app.id, slug: app.slug }, 'App deleted');
      return reply.status(204).send();
    },
  );

  // POST /api/apps/:slug/rotate-key
  server.post<{ Params: { slug: string } }>(
    '/api/apps/:slug/rotate-key',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await appRepository.findBySlug((request.params as any).slug);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const api_key = randomBytes(32).toString('hex');
      const now = Math.floor(Date.now() / 1000);
      await appRepository.update(app.id, { api_key, updated_at: now });
      invalidateAppMetadataCacheForApp(app.slug);

      logger.info({ appId: app.id, slug: app.slug }, 'API key rotated');
      return { api_key };
    },
  );
}
