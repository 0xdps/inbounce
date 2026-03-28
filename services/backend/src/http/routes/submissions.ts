import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../../core/db.js';
import { authHook } from '../middleware/auth.js';

interface DailyStat {
  date: string;
  count: number;
}

interface Stats {
  total: number;
  today: number;
  week: number;
  month: number;
  daily: DailyStat[];
}

interface DistributionData {
  value: string;
  count: number;
}

interface Distribution {
  field: string;
  total: number;
  data: DistributionData[];
}

interface Submission {
  id: string;
  app_id: string;
  data: Record<string, unknown>;
  idempotency_key: string | null;
  ip: string | null;
  meta: Record<string, unknown> | null;
  created_at: number;
}

interface SubmissionsResponse {
  data: Submission[];
  total: number;
  page: number;
  limit: number;
}

export async function registerSubmissionsRoutes(server: FastifyInstance): Promise<void> {
  // GET /api/apps/:id/submissions/stats
  server.get<{ Params: { id: string } }>(
    '/api/apps/:id/submissions/stats',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await db.findById('apps', request.params.id);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const now = Math.floor(Date.now() / 1000);
      const todayStart = now - (now % 86400);
      const weekAgo = now - 7 * 86400;
      const monthAgo = now - 30 * 86400;

      const summaryResult = await db.exec(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today,
           SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS week,
           SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS month
         FROM submissions WHERE app_id = ?`,
        [todayStart, weekAgo, monthAgo, app.id]
      );

      const s = (summaryResult?.rows?.[0] ?? {}) as Record<string, number>;

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

      const stats: Stats = {
        total: Number(s.total ?? 0),
        today: Number(s.today ?? 0),
        week: Number(s.week ?? 0),
        month: Number(s.month ?? 0),
        daily: ((dailyResult?.rows as Array<{ date: string; count: number }>) ?? []).map((r) => ({
          date: r.date,
          count: Number(r.count),
        })),
      };
      return stats;
    }
  );

  // GET /api/apps/:id/submissions/distribution?field=X&limit=8&after=TS
  server.get<{ Params: { id: string }; Querystring: { field?: string; limit?: string; after?: string } }>(
    '/api/apps/:id/submissions/distribution',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await db.findById('apps', request.params.id);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const field = ((request.query.field as string) || '').trim();
      const limit = Math.min(20, Math.max(1, parseInt((request.query.limit as string) || '8', 10)));
      const after = (request.query.after as string) ? parseInt(request.query.after as string, 10) : null;

      if (!field || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
        return reply.status(400).send({ error: 'Invalid field name' });
      }

      const whereParts = ['app_id = ?', `json_extract(data, '$.${field}') IS NOT NULL`];
      const params: (string | number)[] = [app.id];
      if (after) {
        whereParts.push('created_at >= ?');
        params.push(after);
      }
      const whereClause = whereParts.join(' AND ');

      const result = await db.exec(
        `SELECT CAST(json_extract(data, '$.${field}') AS TEXT) AS value, COUNT(*) AS count
         FROM submissions WHERE ${whereClause}
         GROUP BY value ORDER BY count DESC LIMIT ?`,
        [...params, limit]
      );

      const rows = (result?.rows as Array<{ value: string; count: number }>) ?? [];
      const total = rows.reduce((s, r) => s + Number(r.count), 0);
      const distribution: Distribution = {
        field,
        total,
        data: rows.map((r) => ({ value: r.value, count: Number(r.count) })),
      };
      return distribution;
    }
  );

  // GET /api/apps/:id/submissions?page=1&limit=20&order=DESC&after=TS
  server.get<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string; order?: string; after?: string; filter_field?: string; filter_value?: string };
  }>(
    '/api/apps/:id/submissions',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await db.findById('apps', request.params.id);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const page = Math.max(1, parseInt((request.query.page as string) || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((request.query.limit as string) || '20', 10)));
      const order = (request.query.order as string) === 'ASC' ? 'ASC' : 'DESC';
      const offset = (page - 1) * limit;
      const after = (request.query.after as string) ? parseInt(request.query.after as string, 10) : null;

      const filterField = ((request.query.filter_field as string) || '').trim();
      const filterValue = ((request.query.filter_value as string) ?? '').trim();
      const hasFilter = filterField && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filterField);

      const whereParts = ['app_id = ?'];
      const baseParams: (string | number)[] = [app.id];
      if (hasFilter) {
        whereParts.push(`LOWER(CAST(json_extract(data, '$.${filterField}') AS TEXT)) LIKE LOWER(?)`);
        baseParams.push(`%${filterValue}%`);
      }
      if (after) {
        whereParts.push('created_at >= ?');
        baseParams.push(after);
      }
      const whereClause = whereParts.join(' AND ');

      const [rowResult, countResult] = await Promise.all([
        db.exec(`SELECT * FROM submissions WHERE ${whereClause} ORDER BY created_at ${order} LIMIT ? OFFSET ?`, [
          ...baseParams,
          limit,
          offset,
        ]),
        db.exec(`SELECT COUNT(*) AS n FROM submissions WHERE ${whereClause}`, baseParams),
      ]);

      const rows = (rowResult?.rows as Array<Record<string, unknown>>) ?? [];
      const total = Number((countResult?.rows?.[0] as Record<string, number> | undefined)?.n ?? 0);

      const data = rows.map((row) => ({
        ...row,
        data: JSON.parse((row.data as string) || '{}'),
        meta: row.meta ? JSON.parse(row.meta as string) : null,
      })) as Submission[];

      const response: SubmissionsResponse = { data, total, page, limit };
      return response;
    }
  );

  // DELETE /api/apps/:id/submissions/:sid
  server.delete<{ Params: { id: string; sid: string } }>(
    '/api/apps/:id/submissions/:sid',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await db.findById('apps', request.params.id);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const sub = await db.findOne('submissions', { id: request.params.sid, app_id: app.id });
      if (!sub) return reply.status(404).send({ error: 'Submission not found' });

      await db.delete('submissions', { id: request.params.sid });
      return reply.status(204).send();
    }
  );

  // DELETE /api/apps/:id/submissions  (clear all)
  server.delete<{ Params: { id: string }; Body: { confirm?: boolean } }>(
    '/api/apps/:id/submissions',
    { preHandler: [authHook] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const app = await db.findById('apps', request.params.id);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const { confirm } = request.body || {};
      if (confirm !== true) {
        return reply.status(400).send({ error: 'Pass { confirm: true } to delete all submissions' });
      }

      await db.delete('submissions', { app_id: app.id });
      return reply.status(204).send();
    }
  );
}
