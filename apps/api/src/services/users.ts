import bcrypt from 'bcryptjs';
import type { User, CreateUserInput, UpdateUserInput, Role } from '@base/contracts';
import { prisma } from '../db';
import { AppError } from '../errors';
import { assertAssignRole, assertManage } from '../permissions';

export const publicSelect = { id: true, name: true, email: true, role: true, active: true, createdAt: true } as const;
export const publicUser = (user: Omit<User, 'createdAt'> & { createdAt: Date }): User => ({
  id: user.id, name: user.name, email: user.email, role: user.role, active: user.active, createdAt: user.createdAt.toISOString(),
});
export async function listUsers(): Promise<User[]> {
  return (await prisma.user.findMany({ orderBy: { createdAt: 'desc' }, select: publicSelect })).map(publicUser);
}
export async function createUser(actor: Role, input: CreateUserInput): Promise<User> {
  assertAssignRole(actor, input.role);
  const { password, ...fields } = input;
  return publicUser(await prisma.user.create({ data: { ...fields, passwordHash: await bcrypt.hash(password, 12) } }));
}
export async function updateUser(actor: Role, id: string, input: UpdateUserInput): Promise<User> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new AppError(404, 'Usuario no encontrado.', 'User not found.');
  assertManage(actor, target.role);
  if (input.role) assertAssignRole(actor, input.role);
  if (target.role === 'SUPERADMIN' && input.active === false) throw new AppError(403, 'No se puede desactivar un superadministrador.', 'A super administrator cannot be deactivated.');
  if (target.role === 'SUPERADMIN' && input.role && input.role !== 'SUPERADMIN') {
    const count = await prisma.user.count({ where: { role: 'SUPERADMIN', active: true } });
    if (count <= 1) throw new AppError(400, 'Debe existir al menos un superadministrador activo.', 'At least one active super administrator must exist.');
  }
  const { password, ...fields } = input;
  return publicUser(await prisma.user.update({ where: { id }, data: { ...fields, ...(password ? { passwordHash: await bcrypt.hash(password, 12), sessionVersion: { increment: 1 } } : {}) } }));
}
export async function deleteUser(actor: Role, id: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw new AppError(404, 'Usuario no encontrado.', 'User not found.');
  assertManage(actor, target.role);
  if (target.role === 'SUPERADMIN') throw new AppError(403, 'No se puede eliminar un superadministrador.', 'A super administrator cannot be deleted.');
  await prisma.user.delete({ where: { id } });
}
