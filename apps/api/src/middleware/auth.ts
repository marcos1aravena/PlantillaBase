import type { Request, RequestHandler } from 'express';
import type { Role } from '@base/contracts';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { prisma } from '../db';
import { config } from '../config';
import { AppError } from '../errors';

export type AuthRequest = Request & { user?: { id: string; role: Role } };
export const cookieName = 'session';
export const cookieOptions = () => ({ httpOnly: true, secure: config.COOKIE_SECURE === 'true', sameSite: 'strict' as const, maxAge: config.sessionSeconds * 1000, path: '/' });
export const authenticate: RequestHandler = async (req, res, next) => {
  let payload: JwtPayload;
  try {
    payload = jwt.verify(req.cookies?.[cookieName] || '', config.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    if (!payload.sub || !Number.isInteger(payload.sessionVersion)) throw new Error('Invalid session');
  } catch {
    res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
    throw new AppError(401, 'Sesión expirada o inválida.', 'Session expired or invalid.');
  }
  // Database failures must propagate as server errors, not invalid credentials.
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, active: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== payload.sessionVersion) {
    res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
    throw new AppError(401, 'Sesión expirada o inválida.', 'Session expired or invalid.');
  }
  (req as AuthRequest).user = { id: user.id, role: user.role };
  next();
};
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!['ADMIN', 'SUPERADMIN'].includes((req as AuthRequest).user?.role || '')) throw new AppError(403, 'No tienes permisos para esta acción.', 'You are not allowed to perform this action.');
  next();
};
