import { randomUUID, randomBytes } from 'crypto';
import { z } from 'zod';
import db from '../../core/db.js';

const bodySchema = z.object({
  email: z.string().email().max(512).transform(v => v.toLowerCase().trim()),
});

export async function registerWaitlistRoutes(server) {
  // CORS preflight for cross-origin landing page POSTs
  server.options('/api/waitlist', async (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type')
      .status(204)
      .send();
  });

  server.post('/api/waitlist', {
    config: {
      rateLimit: { max: 8, timeWindow: '10 minutes' },
    },
  }, async (request, reply) => {
    reply
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Methods', 'POST, OPTIONS')
      .header('Access-Control-Allow-Headers', 'Content-Type');

    const result = bodySchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ ok: false, error: 'Invalid email address' });
    }

    const { email } = result.data;

    // Return existing token if already signed up
    const existing = await db.findOne('waitlist_signups', { email });
    if (existing) {
      return reply.send({ ok: true, already: true, token: existing.token });
    }

    const token = randomBytes(14).toString('hex');
    await db.insert('waitlist_signups', {
      id:         randomUUID(),
      email,
      token,
      created_at: Date.now(),
    });

    return reply.status(201).send({ ok: true, already: false, token });
  });
}
