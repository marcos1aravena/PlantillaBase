import type { ErrorRequestHandler } from 'express';
import { securityMessage as t } from './security';

export class AppError extends Error {
  constructor(public status: number, es: string, en: string, public code?: string, public fieldErrors?: Record<string, string[]>) {
    super(t(es, en));
  }
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof AppError) return res.status(error.status).json({ error: error.message, code: error.code, fieldErrors: error.fieldErrors });
  const code = (error as { code?: string })?.code;
  if (code === 'P2002') {
    const message = t('Ya existe un usuario con ese correo.', 'A user with that email already exists.');
    return res.status(409).json({ error: message, fieldErrors: { email: [message] } });
  }
  if (code === 'P2025') return res.status(404).json({ error: t('Usuario no encontrado.', 'User not found.') });
  if ((error as { type?: string })?.type === 'entity.parse.failed') return res.status(400).json({ error: t('Datos inválidos.', 'Invalid data.') });
  console.error(error);
  res.status(500).json({ error: t('Error interno del servidor.', 'Internal server error.') });
};
