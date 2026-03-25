import db from '../../core/db.js';
import { authHook } from '../middleware/auth.js';

export async function registerSubmissionsRoutes(server) {
  // GET /api/apps/:id/submissions/stats
  server.get('/api/apps/:id/submissions/stats', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const now        = Math.floor(Date.now() / 1000);
    const todayStart = now - (now % 86400);
    const weekAgo    = now - 7  * 86400;
    const monthAgo   = now - 30 * 86400;

    const summaryResult = await db.exec(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS week,
         SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS month
       FROM submissions WHERE app_id = ?`,
      [todayStart, weekAgo, monthAgo, app.id]
    );

    const s = summaryResult?.rows?.[0] ?? {};

    const dailyResult = await db.exec(
      `SELECT
         strftime('%Y-%m-%d', datetime(created_at, 'unixepoch')) AS date,
         COUNT(*) AS count
       FROM submissions
       WHERE app_id = ? AND created_at >= ?
       GROUP BY date
       ORDER BY date ASC`,
      [app.id, monthAgo]
    );

    return {
      total: Number(s.total ?? 0),
      today: Number(s.today ?? 0),
      week:  Number(s.week  ?? 0),
      month: Number(s.month ?? 0),
      daily: (dailyResult?.rows ?? []).map(r => ({ date: r.date, count: Number(r.count) })),
    };
  });

  // GET /api/apps/:id/submissions/distribution?field=X&limit=8&after=TS
  server.get('/api/apps/:id/submissions/distribution', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const field = (request.query.field || '').trim();
    const limit = Math.min(20, Math.max(1, parseInt(request.query.limit || '8', 10)));
    const after = request.query.after ? parseInt(request.query.after, 10) : null;

    if (!field || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
      return reply.status(400).send({ error: 'Invalid field name' });
    }

    const whereParts = ['app_id = ?', `json_extract(data, '$.${field}') IS NOT NULL`];
    const params = [app.id];
    if (after) { whereParts.push('created_at >= ?'); params.push(after); }
    const whereClause = whereParts.join(' AND ');

    const result = await db.exec(
      `SELECT CAST(json_extract(data, '$.${field}') AS TEXT) AS value, COUNT(*) AS count
       FROM submissions WHERE ${whereClause}
       GROUP BY value ORDER BY count DESC LIMIT ?`,
      [...params, limit]
    );

    const rows = result?.rows ?? [];
    const total = rows.reduce((s, r) => s + Number(r.count), 0);
    return { field, total, data: rows.map(r => ({ value: r.value, count: Number(r.count) })) };
  });

  // GET /api/apps/:id/submissions?page=1&limit=20&order=DESC&after=TS
  server.get('/api/apps/:id/submissions', { preHandler: [authHook] }, async (request, reply) => {
    const app = await db.findById('apps', request.params.id);
    if (!app) return reply.status(404).send({ error: 'App not found' });

    const page  = Math.max(1, parseInt(request.query.page  || '1',  10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
    const order = request.query.order === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;
    const after = request.query.after ? parseInt(request.query.after, 10) : null;

    // Optional field-level filter — whitelist field name to prevent SQL injection
    const filterField = (request.query.filter_field || '').trim();
    const filterValue = (request.query.filter_value ?? '').trim();
    const hasFilter = filterField && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filterField);

    // Build dynamic WHERE
    const whereParts = ['app_id = ?'];
    const baseParams = [app.id];
    if (hasFilter) {
      whereParts.push(`LOWER(CAST(json_extract(data, '$.${filterField}') AS TEXT)) LIKE LOWER(?)`);
      baseParams.push(`%${filterValue}%`);
    }
    if (after) { whereParts.push('created_at >= ?'); baseParams.push(after); }
    const whereClause = whereParts.join(' AND ');

    const [rowResult, countResult] = await Promise.all([
      db.exec(
        `SELECT * FROM submissions WHERE ${whereClause} ORDER BY created_at ${order} LIMIT ? OFFSET ?`,
        [...baseParams, limit, offset]
      ),
      db.exec(
        `SELECT COUNT(*) AS n FROM submissions WHERE ${whereClause}`,
        baseParams
      ),
    ]);

    const rows  = rowResult?.rows ?? [];
    const total = Number(countResult?.rows?.[0]?.n ?? 0);

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
