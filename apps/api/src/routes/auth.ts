import { Router } from 'express';
import type { UserResponse, ProfileResponse } from '@base/contracts';
import { authenticate, AuthRequest, cookieName, cookieOptions } from '../middleware/auth';
import { attemptLimiter } from '../security';
import { prisma } from '../db';
import { loginSchema, profileSchema, validate } from '../validation';
import * as auth from '../services/auth';

export const authRoutes = Router();
const loginLimit = attemptLimiter(prisma, 'login', (req) => typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : 'invalid');
const passwordLimit = attemptLimiter(prisma, 'password', (req) => (req as AuthRequest).user!.id);
authRoutes.post('/login', loginLimit, async (req, res) => {
  const result = await auth.login(validate(loginSchema, req.body));
  await res.locals.resetAttempts();
  res.cookie(cookieName, result.token, cookieOptions());
  res.json({ user: result.user } satisfies UserResponse);
});
authRoutes.post('/logout', (_req, res) => {
  res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});
authRoutes.get('/me', authenticate, async (req, res) => {
  res.json({ user: await auth.getUser((req as AuthRequest).user!.id) } satisfies UserResponse);
});
authRoutes.post('/revoke-sessions', authenticate, async (req, res) => {
  await auth.revokeSessions((req as AuthRequest).user!.id);
  res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});
authRoutes.patch('/profile', authenticate, (req, res, next) => req.body?.newPassword ? passwordLimit(req, res, next) : next(), async (req, res) => {
  const result: ProfileResponse = await auth.updateProfile((req as AuthRequest).user!.id, validate(profileSchema, req.body), () => res.locals.resetAttempts());
  if (result.sessionsRevoked) res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
  res.json(result);
});
