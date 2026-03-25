import db from '../../core/db.js';
import { authHook } from '../middleware/auth.js';

export async function registerSubmissionsRoutes(server) {
  // GET /api/apps/:id/submissions?page=1&limit=20&order=DESC
  server.get('/api/apps/:id/submissions', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const page  = Math.max(1, parseInt(request.query.page  || '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
    const order = request.query.order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      db.find('submissions', { app_id: app.id }, {
        orderBy: 'created_at',
        order,
        limit,
        offset,
      }),
      db.count('submissions', { app_id: app.id }),
    ]);

    // Parse JSON data and meta fields for each row
    const data = rows.map((row) => ({
      ...row,
      data: JSON.parse(row.data || '{}'),
      meta: row.meta ? JSON.parse(row.meta) : null,
    }));

    return { data, total, page, limit };
  });

  // DELETE /api/apps/:id/submissions/:sid
  server.delete('/api/apps/:id/submissions/:sid', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const sub = await db.findOne('submissions', { id: request.params.sid, app_id: app.id });
    if (!sub) return reply.status(404).send({ error: 'Submission not found' });

    await db.delete('submissions', { id: request.params.sid });
    return reply.status(204).send();
  });

  // DELETE /api/apps/:id/submissions  (clear all)
  server.delete('/api/apps/:id/submissions', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const { confirm } = request.body || {};
    if (confirm !== true) {
      return reply.status(400).send({ error: 'Pass { confirm: true } to delete all submissions' });
    }

    await db.delete('submissions', { app_id: app.id });
    return reply.status(204).send();
  });
}
