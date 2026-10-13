import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';
import helmet from 'helmet';
import { config } from './config';
import { attemptLimiter, csrfToken, protectWrites } from './security';
import { fitsBcrypt } from './password';

const app = express();
const prisma = new PrismaClient();
const port = config.API_PORT;
const jwtSecret = config.JWT_SECRET;
const appLocale = config.APP_LOCALE;
const translate = (spanish: string, english: string) => appLocale === 'en' ? english : spanish;
const sessionExpiresIn = config.sessionSeconds;
const sessionDuration = sessionExpiresIn * 1000;
const cookieName = 'session';

app.use(helmet());
app.use(cors({ origin: config.frontendOrigin, credentials: true, exposedHeaders: ['Retry-After'] }));
app.use(express.json());
app.use(cookieParser());
app.get('/api/auth/csrf', csrfToken);
app.use(protectWrites);

type AuthRequest = express.Request & { user?: { id: string; role: Role } };
const publicUser = (user: { id: string; name: string; email: string; role: Role; active: boolean; createdAt: Date }) => ({
  id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, createdAt: user.createdAt,
});

const authenticate: express.RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[cookieName];
  if (!token) return res.status(401).json({ error: translate('No autenticado.', 'Not authenticated.') });
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as JwtPayload;
    if (!payload.sub || !Number.isInteger(payload.sessionVersion)) throw new Error('Invalid session');
  } catch {
    res.clearCookie(cookieName, cookieOptions());
    return res.status(401).json({ error: translate('Sesión expirada o inválida.', 'Session expired or invalid.') });
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, active: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== payload.sessionVersion) {
    res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
    return res.status(401).json({ error: translate('Sesión expirada o inválida.', 'Session expired or invalid.') });
  }
  (req as AuthRequest).user = { id: user.id, role: user.role };
  next();
};

function cookieOptions() {
  return { httpOnly: true, secure: config.COOKIE_SECURE === 'true', sameSite: 'strict' as const, maxAge: sessionDuration, path: '/' };
}

const requireAdmin: express.RequestHandler = (req, res, next) => {
  if (!['ADMIN', 'SUPERADMIN'].includes((req as AuthRequest).user?.role || '')) return res.status(403).json({ error: translate('No tienes permisos para esta acción.', 'You are not allowed to perform this action.') });
  next();
};

const passwordSchema = z.string().min(12).refine(fitsBcrypt, {
  message: translate('La contraseña no puede superar 72 bytes UTF-8.', 'Password must not exceed 72 UTF-8 bytes.'),
});
const currentPasswordSchema = z.string().min(1).refine(fitsBcrypt);
const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100), email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: passwordSchema, role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']),
});
const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(), email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  password: passwordSchema.optional(), role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']).optional(), active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, translate('Indica al menos un campo para actualizar.', 'Provide at least one field to update.'));
const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  currentPassword: currentPasswordSchema.optional(),
  newPassword: passwordSchema.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, translate('Indica los datos que deseas actualizar.', 'Provide the profile details you want to update.'))
  .refine((value) => Boolean(value.currentPassword) === Boolean(value.newPassword), {
    message: translate('Para cambiar la contraseña debes indicar la contraseña actual y la nueva.', 'Enter both your current and new password to change your password.'),
  });

app.get('/api/config', (_req, res) => res.json({ locale: appLocale }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

const loginLimit = attemptLimiter(prisma, 'login', (req) => typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : 'invalid');
const passwordLimit = attemptLimiter(prisma, 'password', (req) => (req as AuthRequest).user!.id);
app.post('/api/auth/login', loginLimit, async (req, res) => {
  const parsed = z.object({ email: z.string().trim().email(), password: currentPasswordSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: translate('Correo o contraseña inválidos.', 'Invalid email or password.') });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: translate('Correo o contraseña incorrectos.', 'Incorrect email or password.') });
  }
  await res.locals.resetAttempts();
  const token = jwt.sign({ sessionVersion: user.sessionVersion }, jwtSecret, { algorithm: 'HS256', subject: user.id, expiresIn: sessionExpiresIn });
  res.cookie(cookieName, token, cookieOptions());
  return res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});

app.post('/api/auth/revoke-sessions', authenticate, async (req, res) => {
  await prisma.user.update({ where: { id: (req as AuthRequest).user!.id }, data: { sessionVersion: { increment: 1 } } });
  res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
  res.status(204).end();
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: (req as AuthRequest).user!.id } });
  if (!user?.active) {
    res.clearCookie(cookieName, cookieOptions());
    return res.status(401).json({ error: translate('La cuenta no está activa.', 'This account is inactive.') });
  }
  return res.json({ user: publicUser(user) });
});

app.patch('/api/auth/profile', authenticate, (req, res, next) => req.body?.newPassword ? passwordLimit(req, res, next) : next(), async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: translate('Datos inválidos.', 'Invalid data.') });

  const userId = (req as AuthRequest).user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.active) return res.status(401).json({ error: translate('La cuenta no está activa.', 'This account is inactive.') });

  if (parsed.data.newPassword && !(await bcrypt.compare(parsed.data.currentPassword!, user.passwordHash))) {
    return res.status(400).json({ error: translate('La contraseña actual es incorrecta.', 'Current password is incorrect.') });
  }
  if (parsed.data.newPassword) await res.locals.resetAttempts();

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.newPassword ? { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12), sessionVersion: { increment: 1 } } : {}),
    },
  });
  if (parsed.data.newPassword) res.clearCookie(cookieName, { ...cookieOptions(), maxAge: undefined });
  return res.json({ user: publicUser(updated), sessionsRevoked: Boolean(parsed.data.newPassword) });
});

app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return res.json({ users: users.map(publicUser) });
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: translate('Datos inválidos.', 'Invalid data.') });
  const actor = (req as AuthRequest).user!;
  if (actor.role !== Role.SUPERADMIN && parsed.data.role !== Role.USER) return res.status(403).json({ error: translate('Solo un superadministrador puede crear administradores.', 'Only a super administrator can create administrators.') });
  try {
    const { password, ...userData } = parsed.data;
    const user = await prisma.user.create({ data: { ...userData, passwordHash: await bcrypt.hash(password, 12) } });
    return res.status(201).json({ user: publicUser(user) });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return res.status(409).json({ error: translate('Ya existe un usuario con ese correo.', 'A user with that email already exists.') });
    throw error;
  }
});

app.patch('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: translate('Datos inválidos.', 'Invalid data.') });
  const actor = (req as AuthRequest).user!;
  const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!target) return res.status(404).json({ error: translate('Usuario no encontrado.', 'User not found.') });
  if (actor.role !== Role.SUPERADMIN && target.role !== Role.USER) return res.status(403).json({ error: translate('Los administradores no pueden modificar cuentas de administrador.', 'Administrators cannot modify administrator accounts.') });
  if (actor.role !== Role.SUPERADMIN && parsed.data.role && parsed.data.role !== Role.USER) return res.status(403).json({ error: translate('Solo un superadministrador puede asignar ese rol.', 'Only a super administrator can assign that role.') });
  if (target.role === Role.SUPERADMIN && parsed.data.active === false) return res.status(403).json({ error: translate('No se puede desactivar un superadministrador.', 'A super administrator cannot be deactivated.') });
  if (target.role === Role.SUPERADMIN && parsed.data.role && parsed.data.role !== Role.SUPERADMIN) {
    const count = await prisma.user.count({ where: { role: Role.SUPERADMIN, active: true } });
    if (count <= 1) return res.status(400).json({ error: translate('Debe existir al menos un superadministrador activo.', 'At least one active super administrator must exist.') });
  }
  const { password, ...fields } = parsed.data;
  try {
    const user = await prisma.user.update({ where: { id: target.id }, data: { ...fields, ...(password ? { passwordHash: await bcrypt.hash(password, 12), sessionVersion: { increment: 1 } } : {}) } });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') return res.status(409).json({ error: translate('Ya existe un usuario con ese correo.', 'A user with that email already exists.') });
    throw error;
  }
});

app.delete('/api/users/:id', authenticate, requireAdmin, async (req, res) => {
  const actor = (req as AuthRequest).user!;
  const target = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
  if (!target) return res.status(404).json({ error: translate('Usuario no encontrado.', 'User not found.') });
  if (actor.role !== Role.SUPERADMIN && target.role !== Role.USER) return res.status(403).json({ error: translate('Los administradores solo pueden eliminar usuarios normales.', 'Administrators can only delete regular users.') });
  if (target.role === Role.SUPERADMIN) return res.status(403).json({ error: translate('No se puede eliminar un superadministrador.', 'A super administrator cannot be deleted.') });
  await prisma.user.delete({ where: { id: target.id } });
  return res.status(204).end();
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: translate('Error interno del servidor.', 'Internal server error.') });
});

app.listen(port, () => console.log(`API listening on port ${port}`));
