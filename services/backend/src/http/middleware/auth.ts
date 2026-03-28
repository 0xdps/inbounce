import { FastifyRequest, FastifyReply } from 'fastify';
import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual } from 'crypto';
import config from '../../core/config.js';

const COOKIE_NAME = 'ib_session';
const ALG = 'HS256';
const EXPIRY = '7d';

function getSecret(): Uint8Array {
  return new TextEncoder().encode(config.sessionSecret);
}

export async function createSession(reply: FastifyReply): Promise<string> {
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());

  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.isProduction(),
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return token;
}

export function clearSession(reply: FastifyReply): void {
  reply.clearCookie(COOKIE_NAME, { path: '/' });
}

export function verifyAdminKey(providedKey: string): boolean {
  try {
    const a = Buffer.from(providedKey);
    const b = Buffer.from(config.adminKey);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies[COOKIE_NAME];
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
  try {
    const { payload } = await jwtVerify(token, getSecret());
    request.user = payload;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' });
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: unknown;
  }
}
