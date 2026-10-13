import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { RequestHandler } from 'express';
import { PrismaClient } from '@prisma/client';
import { config } from './config';

export const securityMessage = (es: string, en: string) => config.APP_LOCALE === 'en' ? en : es;
const signature = (value: string) => createHmac('sha256', config.JWT_SECRET).update(`csrf:${value}`).digest('hex');

export const csrfToken: RequestHandler = (_req, res) => {
  const nonce = randomBytes(32).toString('hex');
  const token = `${nonce}.${signature(nonce)}`;
  res.setHeader('Cache-Control', 'no-store');
  res.cookie('csrf', token, { httpOnly: true, secure: config.COOKIE_SECURE === 'true', sameSite: 'strict', path: '/', maxAge: config.sessionSeconds * 1000 });
  res.json({ token });
};

export const protectWrites: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('origin') !== config.frontendOrigin) {
    return res.status(403).json({ error: securityMessage('Origen no permitido.', 'Origin not allowed.') });
  }
  const token = req.get('x-csrf-token');
  const cookie = req.cookies?.csrf;
  if (typeof token !== 'string' || typeof cookie !== 'string' || token !== cookie || !/^[a-f0-9]{64}\.[a-f0-9]{64}$/.test(token)) {
    return res.status(403).json({ error: securityMessage('Token CSRF inválido. Recarga la página.', 'Invalid CSRF token. Reload the page.'), code: 'CSRF_INVALID' });
  }
  const [nonce, mac] = token.split('.');
  if (!timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(signature(nonce), 'hex'))) {
    return res.status(403).json({ error: securityMessage('Token CSRF inválido. Recarga la página.', 'Invalid CSRF token. Reload the page.'), code: 'CSRF_INVALID' });
  }
  next();
};

/** Atomic reservations ensure simultaneous requests cannot bypass the limit. */
export function attemptLimiter(prisma: PrismaClient, scope: string, identity: (req: Parameters<RequestHandler>[0]) => string): RequestHandler {
  return async (req, res, next) => {
    const keys = [
      createHash('sha256').update(`${scope}:ip:${req.ip}`).digest('hex'),
      createHash('sha256').update(`${scope}:account:${identity(req)}`).digest('hex'),
    ].sort();
    let retryAfter = 0;
    await prisma.$transaction(async (tx) => {
      for (const key of keys) {
        await tx.$executeRaw`INSERT INTO "AuthAttempt" ("key", "count", "windowStartedAt", "updatedAt") VALUES (${key}, 0, NOW(), NOW()) ON CONFLICT ("key") DO NOTHING`;
        const [row] = await tx.$queryRaw<Array<{ count: number; windowStartedAt: Date; blockedUntil: Date | null }>>`SELECT "count", "windowStartedAt", "blockedUntil" FROM "AuthAttempt" WHERE "key" = ${key} FOR UPDATE`;
        const now = Date.now();
        if (row.blockedUntil && row.blockedUntil.getTime() > now) {
          retryAfter = Math.max(retryAfter, Math.ceil((row.blockedUntil.getTime() - now) / 1000));
          continue;
        }
        const expired = Boolean(row.blockedUntil) || now - row.windowStartedAt.getTime() >= config.AUTH_WINDOW_SECONDS * 1000;
        const count = (expired ? 0 : row.count) + 1;
        const blockedUntil = count >= config.AUTH_MAX_ATTEMPTS ? new Date(now + config.AUTH_BLOCK_SECONDS * 1000) : null;
        await tx.authAttempt.update({ where: { key }, data: { count, blockedUntil, ...(expired ? { windowStartedAt: new Date(now) } : {}) } });
      }
    });
    if (retryAfter) {
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: securityMessage(`Demasiados intentos. Vuelve a intentarlo en ${retryAfter} segundos.`, `Too many attempts. Try again in ${retryAfter} seconds.`), retryAfter });
    }
    // A successful credential verification removes its reservation, not other failures.
    res.locals.resetAttempts = async () => {
      for (const key of keys) {
        await prisma.$executeRaw`UPDATE "AuthAttempt" SET "count" = GREATEST("count" - 1, 0), "blockedUntil" = CASE WHEN "count" <= ${config.AUTH_MAX_ATTEMPTS} THEN NULL ELSE "blockedUntil" END, "updatedAt" = NOW() WHERE "key" = ${key}`;
      }
    };
    next();
  };
}
