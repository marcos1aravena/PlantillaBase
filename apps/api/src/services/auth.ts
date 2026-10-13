import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { LoginInput, ProfileInput, ProfileResponse, User } from '@base/contracts';
import { prisma } from '../db';
import { config } from '../config';
import { AppError } from '../errors';
import { publicSelect, publicUser } from './users';

export async function login(input: LoginInput): Promise<{ token: string; user: User }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user?.active || !(await bcrypt.compare(input.password, user.passwordHash))) throw new AppError(401, 'Correo o contraseña incorrectos.', 'Incorrect email or password.');
  return { token: jwt.sign({ sessionVersion: user.sessionVersion }, config.JWT_SECRET, { algorithm: 'HS256', subject: user.id, expiresIn: config.sessionSeconds }), user: publicUser(user) };
}
export async function getUser(id: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id }, select: publicSelect });
  if (!user?.active) throw new AppError(401, 'La cuenta no está activa.', 'This account is inactive.');
  return publicUser(user);
}
export async function updateProfile(id: string, input: ProfileInput, verified: () => Promise<void>): Promise<ProfileResponse> {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user?.active) throw new AppError(401, 'La cuenta no está activa.', 'This account is inactive.');
  if (input.newPassword) {
    if (!(await bcrypt.compare(input.currentPassword!, user.passwordHash))) throw new AppError(400, 'La contraseña actual es incorrecta.', 'Current password is incorrect.', 'VALIDATION_ERROR', { currentPassword: [config.APP_LOCALE === 'en' ? 'Current password is incorrect.' : 'La contraseña actual es incorrecta.'] });
    await verified();
  }
  const updated = await prisma.user.update({ where: { id }, data: {
    ...(input.name ? { name: input.name } : {}),
    ...(input.newPassword ? { passwordHash: await bcrypt.hash(input.newPassword, 12), sessionVersion: { increment: 1 } } : {}),
  } });
  return { user: publicUser(updated), sessionsRevoked: Boolean(input.newPassword) };
}
export async function revokeSessions(id: string): Promise<void> {
  await prisma.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });
}
