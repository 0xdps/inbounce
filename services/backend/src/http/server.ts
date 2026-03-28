import Fastify, { FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCompress from '@fastify/compress';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import config from '../core/config.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerAppsRoutes } from './routes/apps.js';
import { registerSchemaRoutes } from './routes/schema.js';
import { registerSubmissionsRoutes } from './routes/submissions.js';
import { registerInboundRoutes } from './routes/inbound.js';

async function createServer(): Promise<FastifyInstance> {
  const server: FastifyInstance = Fastify({ logger: false, trustProxy: true });

  // Security headers (CSP disabled — Caddy handles it in prod, avoids breaking SPA in dev)
  await server.register(fastifyHelmet, { contentSecurityPolicy: false });

  // CORS — only dashboard API needs restrictions; inbound sets its own headers per-app
  await server.register(fastifyCors, {
    origin: config.isDevelopment() ? true : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Global rate limit — tighter limits applied per-route where needed
  await server.register(fastifyRateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({ error: 'Too many requests — please slow down' }),
  });

  await server.register(fastifyCookie, { secret: config.sessionSecret });
  await server.register(fastifyCompress);

  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  await registerAuthRoutes(server);
  await registerAppsRoutes(server);
  await registerSchemaRoutes(server);
  await registerSubmissionsRoutes(server);
  await registerInboundRoutes(server);

  return server;
}

export default createServer;
