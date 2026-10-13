import { z } from 'zod';
import { fitsBcrypt } from './password';
import { AppError } from './errors';

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
  .refine((value) => Boolean(value.currentPassword) === Boolean(value.newPassword));

export function validate<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, 'Datos inválidos.', 'Invalid data.');
  return result.data;
}
