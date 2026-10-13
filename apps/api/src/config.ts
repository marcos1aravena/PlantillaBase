import 'dotenv/config';
import { z } from 'zod';
import { sessionSeconds } from './session';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
  APP_LOCALE: z.enum(['es', 'en']).default('es'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  AUTH_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(1000).default(10),
  AUTH_WINDOW_SECONDS: z.coerce.number().int().min(1).max(86400).default(300),
  AUTH_BLOCK_SECONDS: z.coerce.number().int().min(1).max(86400).default(300),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
}
export const config = {
  ...parsed.data,
  frontendOrigin: new URL(parsed.data.FRONTEND_URL).origin,
  sessionSeconds: sessionSeconds(parsed.data.JWT_EXPIRES_IN),
};
