import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { ConfigResponse } from '@base/contracts';
import { config } from './config';
import { prisma } from './db';
import { csrfToken, protectWrites } from './security';
import { errorHandler } from './errors';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';

export const app = express();
app.use(helmet());
app.use(cors({ origin: config.frontendOrigin, credentials: true, exposedHeaders: ['Retry-After'] }));
app.use(express.json());
app.use(cookieParser());
app.get('/api/auth/csrf', csrfToken);
app.use(protectWrites);
app.get('/api/config', (_req, res) => res.json({ locale: config.APP_LOCALE } satisfies ConfigResponse));
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health/ready', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ready' }); }
  catch { res.status(503).json({ status: 'unavailable' }); }
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
app.use(errorHandler);
