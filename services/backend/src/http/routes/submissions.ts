import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authHook } from '../middleware/auth.js';
import { appRepository, submissionRepository } from '../../repositories/index.js';

interface Distribution {
  field: string;
  total: number;
  data: { value: string; count: number }[];
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
      const app = await appRepository.findBySlug((request.params as any).slug);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      return submissionRepository.stats(app.slug);
    },
  );

  // GET /api/apps/:slug/submissions/distribution?field=X&limit=8&after=TS
  server.get<{ Params: { slug: string }; Querystring: { field?: string; limit?: string; after?: string } }>(
    '/api/apps/:slug/submissions/distribution',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{ Params: { slug: string }; Querystring: { field?: string; limit?: string; after?: string } }>, reply: FastifyReply) => {
      const app = await appRepository.findBySlug((request.params as any).slug);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const query = request.query as any;
      const field = ((query.field as string) || '').trim();
      const limit = Math.min(20, Math.max(1, parseInt((query.limit as string) || '8', 10)));
      const after = (query.after as string) ? parseInt(query.after as string, 10) : null;

      if (!field || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field)) {
        return reply.status(400).send({ error: 'Invalid field name' });
      }

      const { total, data } = await submissionRepository.distribution(app.slug, field, { limit, after });
      const distribution: Distribution = { field, total, data };
      return distribution;
    },
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
      const app = await appRepository.findBySlug((request.params as any).slug);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const query = request.query as any;
      const page = Math.max(1, parseInt((query.page as string) || '1', 10));
      const limit = Math.min(100, Math.max(1, parseInt((query.limit as string) || '20', 10)));
      const order = (query.order as string) === 'ASC' ? 'ASC' : 'DESC';
      const after = (query.after as string) ? parseInt(query.after as string, 10) : null;
      const filterField = ((query.filter_field as string) || '').trim() || null;
      const filterValue = ((query.filter_value as string) ?? '').trim();

      const { data: rows, total } = await submissionRepository.list(app.slug, {
        page,
        limit,
        order: order as 'ASC' | 'DESC',
        after,
        filterField,
        filterValue,
      });

      const data = rows.map((row) => ({
        ...row,
        data: JSON.parse((row.data as string) || '{}'),
        meta: row.meta ? JSON.parse(row.meta as string) : null,
      })) as Submission[];

      const response: SubmissionsResponse = { data, total, page, limit };
      return response;
    },
  );

  // DELETE /api/apps/:slug/submissions/:sid
  server.delete<{ Params: { slug: string; sid: string } }>(
    '/api/apps/:slug/submissions/:sid',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{ Params: { slug: string; sid: string } }>, reply: FastifyReply) => {
      const app = await appRepository.findBySlug((request.params as any).slug);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const sub = await submissionRepository.findById(app.slug, (request.params as any).sid);
      if (!sub) return reply.status(404).send({ error: 'Submission not found' });

      await submissionRepository.delete(app.slug, sub.id);
      return reply.status(204).send();
    },
  );

  // DELETE /api/apps/:slug/submissions (clear all)
  server.delete<{ Params: { slug: string }; Body: { confirm?: boolean } }>(
    '/api/apps/:slug/submissions',
    { preHandler: [authHook] },
    async (request: FastifyRequest<{ Params: { slug: string }; Body: { confirm?: boolean } }>, reply: FastifyReply) => {
      const app = await appRepository.findBySlug((request.params as any).slug);
      if (!app) return reply.status(404).send({ error: 'App not found' });

      const { confirm } = (request.body as any) || {};
      if (confirm !== true) {
        return reply.status(400).send({ error: 'Pass { confirm: true } to delete all submissions' });
      }

      await submissionRepository.deleteAll(app.slug);
      return reply.status(204).send();
    },
  );
}
