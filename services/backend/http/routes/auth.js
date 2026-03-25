import { createSession, clearSession, verifyAdminKey, authHook } from '../middleware/auth.js';
import logger from '../../core/logger.js';

export async function registerAuthRoutes(server) {
  // POST /api/auth/login
  server.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({
          error: 'Too many login attempts — try again in 15 minutes',
        }),
      },
    },
  }, async (request, reply) => {
    const { key } = request.body || {};
    if (!key || typeof key !== 'string') {
      return reply.status(400).send({ error: 'Missing or invalid key' });
    }

    if (!verifyAdminKey(key)) {
      logger.warn('Failed login attempt');
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    await createSession(reply);
    logger.info('Admin logged in');
    return { admin: true, message: 'Logged in successfully' };
  });

  // DELETE /api/auth/logout
  server.delete('/api/auth/logout', { preHandler: [authHook] }, async (request, reply) => {
    clearSession(reply);
    return reply.status(204).send();
  });

  // GET /api/auth/me
  server.get('/api/auth/me', { preHandler: [authHook] }, async (request) => {
    return { admin: true };
  });
}
