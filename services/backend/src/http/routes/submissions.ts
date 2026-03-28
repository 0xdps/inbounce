import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import db from '../../core/db.js';
import { authHook } from '../middleware/auth.js';
import { getQuotedSubmissionsTableName } from '../../core/slug.js';

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
  // GET /api/apps/:slug/submissions/stats
  server.get<{ Params: { slug: string } }>(
    '/api/apps/:slug/submissions/stats',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
      const app = await db.findOne('apps', { slug: (request.params as any).slug });
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const tableName = getQuotedSubmissionsTableName((request.params as any).slug);
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
         FROM ${tableName}`,
        [todayStart, weekAgo, monthAgo]
      );

      const s = ((summaryResult as any)?.rows?.[0] ?? {}) as Record<string, number>;

      const dailyResult = await db.exec(
        `SELECT
           strftime('%Y-%m-%d', datetime(created_at, 'unixepoch')) AS date,
           COUNT(*) AS count
         FROM ${tableName}
         WHERE created_at >= ?
         GROUP BY date
         ORDER BY date ASC`,
        [monthAgo]
      );

      const stats: Stats = {
        total: Number(s.total ?? 0),
        today: Number(s.today ?? 0),
        week: Number(s.week ?? 0),
        month: Number(s.month ?? 0),
        daily: (((dailyResult as any)?.rows as Array<{ date: string; count: number }>) ?? []).map((r) => ({
          date: r.date,
          count: Number(r.count),
        })),
      };
      return stats;
    }
  );

  // GET /api/apps/:slug/submissions/distribution?field=X&limit=8&after=TS
  server.get<{ Params: { slug: string }; Querystring: { field?: string; limit?: string; after?: string } }>(
    '/api/apps/:slug/submissions/distribution',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{ Params: { slug: string }; Querystring: { field?: string; limit?: string; after?: string } }>, reply: FastifyReply) => {
      const app = await db.findOne('apps', { slug: (request.params as any).slug });
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const tableName = getQuotedSubmissionsTableName((request.params as any).slug);
      const query = (request.query as any);
      const field = ((query.field as string) || '').trim();
      const limit = Math.min(20, Math.max(1, parseInt((query.limit as string) || '8', 10)));
      const after = (query.after as string) ? parseInt(query.after as string, 10) : null;

      if (!field || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
        return reply.status(400).send({ error: 'Invalid field name' });
      }

      const whereParts = [`json_extract(data, '$.${field}') IS NOT NULL`];
      const params: (string | number)[] = [];
      if (after) {
        whereParts.push('created_at >= ?');
        params.push(after);
      }
      const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

      const result = await db.exec(
        `SELECT CAST(json_extract(data, '$.${field}') AS TEXT) AS value, COUNT(*) AS count
         FROM ${tableName} ${whereClause}
         GROUP BY value ORDER BY count DESC LIMIT ?`,
        [...params, limit]
      );

      const rows = (((result as any)?.rows as Array<{ value: string; count: number }>) ?? []);
      const total = rows.reduce((s, r) => s + Number(r.count), 0);
      const distribution: Distribution = {
        field,
        total,
        data: rows.map((r) => ({ value: r.value, count: Number(r.count) })),
      };
      return distribution;
    }
  );

  // GET /api/apps/:slug/submissions?page=1&limit=20&order=DESC&after=TS
  server.get<{
    Params: { slug: string };
    Querystring: { page?: string; limit?: string; order?: string; after?: string; filter_field?: string; filter_value?: string };
  }>(
    '/api/apps/:slug/submissions',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{
      Params: { slug: string };
      Querystring: { page?: string; limit?: string; order?: string; after?: string; filter_field?: string; filter_value?: string };
    }>, reply: FastifyReply) => {
      const app = await db.findOne('apps', { slug: (request.params as any).slug });
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const tableName = getQuotedSubmissionsTableName((request.params as any).slug);
      const query = (request.query as any);
      const page = Math.max(1, parseInt((query.page as string) || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((query.limit as string) || '20', 10)));
      const order = (query.order as string) === 'ASC' ? 'ASC' : 'DESC';
      const offset = (page - 1) * limit;
      const after = (query.after as string) ? parseInt(query.after as string, 10) : null;

      const filterField = ((query.filter_field as string) || '').trim();
      const filterValue = ((query.filter_value as string) ?? '').trim();
      const hasFilter = filterField && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(filterField);

      const whereParts: string[] = [];
      const baseParams: (string | number)[] = [];
      if (hasFilter) {
        whereParts.push(`LOWER(CAST(json_extract(data, '$.${filterField}') AS TEXT)) LIKE LOWER(?)`);
        baseParams.push(`%${filterValue}%`);
      }
      if (after) {
        whereParts.push('created_at >= ?');
        baseParams.push(after);
      }
      const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

      const [rowResult, countResult] = await Promise.all([
        db.exec(`SELECT * FROM ${tableName} ${whereClause} ORDER BY created_at ${order} LIMIT ? OFFSET ?`, [
          ...baseParams,
          limit,
          offset,
        ]),
        db.exec(`SELECT COUNT(*) AS n FROM ${tableName} ${whereClause}`, baseParams),
      ]);

      const rows = (((rowResult as any)?.rows as Array<Record<string, unknown>>) ?? []);
      const total = Number((((countResult as any)?.rows?.[0] as Record<string, number>) ?? {})?.n ?? 0);

      const data = rows.map((row) => ({
        ...row,
        data: JSON.parse((row.data as string) || '{}'),
        meta: row.meta ? JSON.parse(row.meta as string) : null,
      })) as Submission[];

      const response: SubmissionsResponse = { data, total, page, limit };
      return response;
    }
  );

  // DELETE /api/apps/:slug/submissions/:sid
  server.delete<{ Params: { slug: string; sid: string } }>(
    '/api/apps/:slug/submissions/:sid',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{ Params: { slug: string; sid: string } }>, reply: FastifyReply) => {
      const app = await db.findOne('apps', { slug: (request.params as any).slug });
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const tableName = getQuotedSubmissionsTableName((request.params as any).slug);
      const sub = await db.findOne(tableName, { id: (request.params as any).sid });
      if (!sub) return reply.status(404).send({ error: 'Submission not found' });

      await db.delete(tableName, { id: (request.params as any).sid });
      return reply.status(204).send();
    }
  );

  // DELETE /api/apps/:slug/submissions (clear all)
  server.delete<{ Params: { slug: string }; Body: { confirm?: boolean } }>(
    '/api/apps/:slug/submissions',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{ Params: { slug: string }; Body: { confirm?: boolean } }>, reply: FastifyReply) => {
      const app = await db.findOne('apps', { slug: (request.params as any).slug });
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const tableName = getQuotedSubmissionsTableName((request.params as any).slug);
      const { confirm } = (request.body as any) || {};
      if (confirm !== true) {
        return reply.status(400).send({ error: 'Pass { confirm: true } to delete all submissions' });
      }

      await db.delete(tableName, {});
      return reply.status(204).send();
    }
  );
}
