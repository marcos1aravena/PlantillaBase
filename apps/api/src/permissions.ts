import type { Role } from '@base/contracts';
import { AppError } from './errors';

export function canManage(actor: Role, target: Role) { return actor === 'SUPERADMIN' || (actor === 'ADMIN' && target === 'USER'); }
export function assertManage(actor: Role, target: Role) {
  if (!canManage(actor, target)) throw new AppError(403, 'Los administradores no pueden modificar cuentas de administrador.', 'Administrators cannot modify administrator accounts.');
}
export function assertAssignRole(actor: Role, role: Role) {
  if (actor !== 'SUPERADMIN' && role !== 'USER') throw new AppError(403, 'Solo un superadministrador puede asignar ese rol.', 'Only a super administrator can assign that role.');
}
