import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { z } from 'zod';

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.API_PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
const appLocale = process.env.APP_LOCALE?.toLowerCase() === 'en' ? 'en' : 'es';
const translate = (spanish: string, english: string) => appLocale === 'en' ? english : spanish;
const sessionDuration = 8 * 60 * 60 * 1000;
const cookieName = 'session';

if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be set and contain at least 32 characters.');

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

type AuthRequest = express.Request & { user?: { id: string; role: Role } };
const publicUser = (user: { id: string; name: string; email: string; role: Role; active: boolean; createdAt: Date }) => ({
  id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, createdAt: user.createdAt,
});

const authenticate: express.RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[cookieName];
  if (!token) return res.status(401).json({ error: translate('No autenticado.', 'Not authenticated.') });
  try {
    const payload = jwt.verify(token, jwtSecret!) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true, role: true, active: true } });
    if (!user?.active) {
      res.clearCookie(cookieName, cookieOptions());
      return res.status(401).json({ error: translate('La cuenta no está activa.', 'This account is inactive.') });
    }
    (req as AuthRequest).user = { id: user.id, role: user.role };
    next();
  } catch {
    res.clearCookie(cookieName, cookieOptions());
    return res.status(401).json({ error: translate('Sesión expirada o inválida.', 'Session expired or invalid.') });
  }
};

function cookieOptions() {
  return { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'strict' as const, maxAge: sessionDuration, path: '/' };
}

const requireAdmin: express.RequestHandler = (req, res, next) => {
  if (!['ADMIN', 'SUPERADMIN'].includes((req as AuthRequest).user?.role || '')) return res.status(403).json({ error: translate('No tienes permisos para esta acción.', 'You are not allowed to perform this action.') });
  next();
};

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100), email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128), role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']),
});
const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(), email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  password: z.string().min(12).max(128).optional(), role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']).optional(), active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, translate('Indica al menos un campo para actualizar.', 'Provide at least one field to update.'));
const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(12).max(128).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, translate('Indica los datos que deseas actualizar.', 'Provide the profile details you want to update.'))
  .refine((value) => Boolean(value.currentPassword) === Boolean(value.newPassword), {
    message: translate('Para cambiar la contraseña debes indicar la contraseña actual y la nueva.', 'Enter both your current and new password to change your password.'),
  });

app.get('/api/config', (_req, res) => res.json({ locale: appLocale }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', async (req, res) => {
  const parsed = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: translate('Correo o contraseña inválidos.', 'Invalid email or password.') });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: translate('Correo o contraseña incorrectos.', 'Incorrect email or password.') });
  }
  const token = jwt.sign({ role: user.role }, jwtSecret!, { subject: user.id, expiresIn: '8h' });
  res.cookie(cookieName, token, cookieOptions());
  return res.json({ user: publicUser(user) });
});

app.post('/api/auth/logout', (_req, res) => {
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

app.patch('/api/auth/profile', authenticate, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: translate('Datos inválidos.', 'Invalid data.') });

  const userId = (req as AuthRequest).user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.active) return res.status(401).json({ error: translate('La cuenta no está activa.', 'This account is inactive.') });

  if (parsed.data.newPassword && !(await bcrypt.compare(parsed.data.currentPassword!, user.passwordHash))) {
    return res.status(400).json({ error: translate('La contraseña actual es incorrecta.', 'Current password is incorrect.') });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.newPassword ? { passwordHash: await bcrypt.hash(parsed.data.newPassword, 12) } : {}),
    },
  });
  return res.json({ user: publicUser(updated) });
});

app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  const actorRole = (req as AuthRequest).user!.role;
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  return res.json({ users: users.filter((user) => actorRole === Role.SUPERADMIN || user.role === Role.USER).map(publicUser) });
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
    const user = await prisma.user.update({ where: { id: target.id }, data: { ...fields, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) } });
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
