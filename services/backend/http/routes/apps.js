import { randomUUID, randomBytes } from 'crypto';
import db from '../../core/db.js';
import logger from '../../core/logger.js';
import { authHook } from '../middleware/auth.js';
import { cacheDel } from '../../core/cache.js';

function parseApp(app) {
  return { ...app, allowed_origins: JSON.parse(app.allowed_origins || '[]') };
}

export async function registerAppsRoutes(server) {
  // GET /api/apps
  server.get('/api/apps', { preHandler: [authHook] }, async () => {
    const apps = await db.find('apps', {}, { orderBy: 'created_at', order: 'DESC' });
    const result = await Promise.all(
      apps.map(async (app) => ({
        ...parseApp(app),
        submission_count: await db.count('submissions', { app_id: app.id }),
      }))
    );
    return result;
  });

  // POST /api/apps
  server.post('/api/apps', { preHandler: [authHook] }, async (request, reply) => {
    const { name, description, allowed_origins } = request.body || {};

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return reply.status(400).send({ error: 'App name is required' });
    }

    const id = randomUUID();
    const api_key = randomBytes(32).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    const originsJson = JSON.stringify(
      Array.isArray(allowed_origins) ? allowed_origins : []
    );

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
  });

  // GET /api/apps/:id
  server.get('/api/apps/:id', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });
    const submission_count = await db.count('submissions', { app_id: app.id });
    return { ...parseApp(app), submission_count };
  });

  // PUT /api/apps/:id
  server.put('/api/apps/:id', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const { name, description, allowed_origins } = request.body || {};
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (allowed_origins !== undefined) {
      updates.allowed_origins = JSON.stringify(
        Array.isArray(allowed_origins) ? allowed_origins : []
      );
    }

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ error: 'No fields to update' });
    }

    await db.update('apps', updates, { id: request.params.id });
    cacheDel(`app:${app.api_key}`);
    return parseApp({ ...app, ...updates });
  });

  // DELETE /api/apps/:id
  server.delete('/api/apps/:id', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    await db.delete('submissions',    { app_id: app.id });
    await db.delete('schema_fields',  { app_id: app.id });
    await db.delete('apps',           { id: app.id });
    cacheDel(`app:${app.api_key}`);
    cacheDel(`schema:${app.id}`);

    logger.info({ appId: app.id }, 'App deleted');
    return reply.status(204).send();
  });

  // POST /api/apps/:id/rotate-key
  server.post('/api/apps/:id/rotate-key', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const api_key = randomBytes(32).toString('hex');
    await db.update('apps', { api_key }, { id: app.id });
    cacheDel(`app:${app.api_key}`);

    logger.info({ appId: app.id }, 'API key rotated');
    return { api_key };
  });
}
