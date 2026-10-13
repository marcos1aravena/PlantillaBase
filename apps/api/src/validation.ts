import { z } from 'zod';
import { fitsBcrypt } from './password';
import { AppError } from './errors';
import { securityMessage as t } from './security';

const name = z.string().trim().min(2).max(100);
const email = z.string().trim().email().transform((value) => value.toLowerCase());
const password = z.string().min(12).refine(fitsBcrypt);
const currentPassword = z.string().min(1).refine(fitsBcrypt);
const role = z.enum(['USER', 'ADMIN', 'SUPERADMIN']);

export const loginSchema = z.object({ email, password: currentPassword });
export const createUserSchema = z.object({ name, email, password, role });
export const updateUserSchema = z.object({
  name: name.optional(), email: email.optional(), password: password.optional(), role: role.optional(), active: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0);
export const profileSchema = z.object({ name: name.optional(), currentPassword: currentPassword.optional(), newPassword: password.optional() })
  .strict().refine((value) => Object.keys(value).length > 0)
  .refine((value) => Boolean(value.currentPassword) === Boolean(value.newPassword), { path: ['currentPassword'], message: 'passwordPair' });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function validate<T extends z.ZodTypeAny>(schema: T, input: unknown, detailed = true): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    if (!detailed) throw new AppError(400, 'Correo o contraseña incorrectos.', 'Incorrect email or password.');
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] || '_form');
      let message = t('Valor inválido.', 'Invalid value.');
      if (field === 'name') message = t('El nombre debe tener entre 2 y 100 caracteres.', 'Name must contain between 2 and 100 characters.');
      else if (field === 'email') message = t('Introduce un correo electrónico válido.', 'Enter a valid email address.');
      else if (field === 'password' || field === 'newPassword') message = t('La contraseña debe tener al menos 12 caracteres y como máximo 72 bytes UTF-8.', 'Password must contain at least 12 characters and at most 72 UTF-8 bytes.');
      else if (field === 'currentPassword') message = t('Indica la contraseña actual y la nueva; la actual no puede superar 72 bytes UTF-8.', 'Provide the current and new password; the current password must not exceed 72 UTF-8 bytes.');
      else if (field === 'role') message = t('Selecciona un rol válido.', 'Select a valid role.');
      else if (field === 'page') message = t('La página debe ser un entero entre 1 y 1000000.', 'Page must be an integer between 1 and 1000000.');
      else if (field === 'limit') message = t('El límite debe ser un entero entre 1 y 100.', 'Limit must be an integer between 1 and 100.');
      else if (issue.code === 'unrecognized_keys') message = t('El formulario contiene campos que no se pueden modificar.', 'The form contains fields that cannot be modified.');
      else if (field === '_form') message = t('Indica al menos un campo para actualizar.', 'Provide at least one field to update.');
      (fieldErrors[field] ||= []).push(message);
    }
    throw new AppError(400, 'Revisa los campos indicados.', 'Review the highlighted fields.', 'VALIDATION_ERROR', fieldErrors);
  }
  return result.data;
}
