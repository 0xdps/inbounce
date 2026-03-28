import { randomUUID, randomBytes } from 'crypto';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../../core/db.js';
import logger from '../../core/logger.js';
import { authHook } from '../middleware/auth.js';
import { cacheDel } from '../../core/cache.js';

interface App {
  id: string;
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
  return { ...app, allowed_origins: JSON.parse(app.allowed_origins || '[]') };
}

export async function registerAppsRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/apps
  server.get('/api/apps', { preHandler: [authHook] }, async () => {
    const apps = (await db.find('apps', {}, { orderBy: 'created_at', order: 'DESC' })) as App[];
    const result = await Promise.all(
      apps.map(async (app) => ({
        ...parseApp(app),
        submission_count: await db.count('submissions', { app_id: app.id }),
      }))
    );
    return result;
  });

  // POST /api/apps
  server.post<{ Body: { name: string; description?: string; allowed_origins?: string[] } }>(
    '/api/apps',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { name, description, allowed_origins } = request.body || {};

      if (!name || typeof name !== 'string' || name.trim() === '') {
        return reply.status(400).send({ error: 'App name is required' });
      }

      const id = randomUUID();
      const api_key = randomBytes(32).toString('hex');
      const now = Math.floor(Date.now() / 1000);
      const originsJson = JSON.stringify(Array.isArray(allowed_origins) ? allowed_origins : []);

      await db.insert('apps', {
        id,
        name: name.trim(),
        description: description?.trim() || null,
        api_key,
        allowed_origins: originsJson,
        created_at: now,
      });

      logger.info({ appId: id }, 'App created');
      return reply.status(201).send({
        id,
        name: name.trim(),
        description: description?.trim() || null,
        api_key,
        allowed_origins: JSON.parse(originsJson),
        created_at: now,
      });
    }
  );

  // GET /api/apps/:id
  server.get<{ Params: { id: string } }>(
    '/api/apps/:id',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = (await db.findById('apps', request.params.id)) as App | null;
      if (!app) return reply.status(404).send({ error: 'App not found' });
      const submission_count = await db.count('submissions', { app_id: app.id });
      return { ...parseApp(app), submission_count };
    }
  );

  // PUT /api/apps/:id
  server.put<{ Params: { id: string }; Body: { name?: string; description?: string; allowed_origins?: string[] } }>(
    '/api/apps/:id',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = (await db.findById('apps', request.params.id)) as App | null;
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const { name, description, allowed_origins } = request.body || {};
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name.trim();
      if (description !== undefined) updates.description = description?.trim() || null;
      if (allowed_origins !== undefined) {
        updates.allowed_origins = JSON.stringify(Array.isArray(allowed_origins) ? allowed_origins : []);
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ error: 'No fields to update' });
      }

      await db.update('apps', updates, { id: request.params.id });
      cacheDel(`app:${app.api_key}`);
      return parseApp({ ...app, ...updates } as App);
    }
  );

  // DELETE /api/apps/:id
  server.delete<{ Params: { id: string } }>(
    '/api/apps/:id',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = (await db.findById('apps', request.params.id)) as App | null;
      if (!app) return reply.status(404).send({ error: 'App not found' });

      await db.delete('submissions', { app_id: app.id });
      await db.delete('schema_fields', { app_id: app.id });
      await db.delete('apps', { id: app.id });
      cacheDel(`app:${app.api_key}`);
      cacheDel(`schema:${app.id}`);

      logger.info({ appId: app.id }, 'App deleted');
      return reply.status(204).send();
    }
  );

  // POST /api/apps/:id/rotate-key
  server.post<{ Params: { id: string } }>(
    '/api/apps/:id/rotate-key',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = (await db.findById('apps', request.params.id)) as App | null;
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const api_key = randomBytes(32).toString('hex');
      await db.update('apps', { api_key }, { id: app.id });
      cacheDel(`app:${app.api_key}`);

      logger.info({ appId: app.id }, 'API key rotated');
      return { api_key };
    }
  );
}
