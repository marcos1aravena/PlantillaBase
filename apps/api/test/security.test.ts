import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Request, Response } from 'express';
import { sessionSeconds } from '../src/session';
import { fitsBcrypt } from '../src/password';
import type { PrismaClient } from '@prisma/client';

Object.assign(process.env, {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-only-secret-at-least-32-characters-long',
  FRONTEND_URL: 'http://localhost:3000',
  COOKIE_SECURE: 'false', APP_LOCALE: 'en', JWT_EXPIRES_IN: '8h',
  AUTH_MAX_ATTEMPTS: '10', AUTH_WINDOW_SECONDS: '300', AUTH_BLOCK_SECONDS: '300',
});

test('bcrypt limit measures UTF-8 bytes, not character count', () => {
  assert.equal(fitsBcrypt('a'.repeat(72)), true);
  assert.equal(fitsBcrypt('a'.repeat(73)), false);
  assert.equal(fitsBcrypt('á'.repeat(36)), true);
  assert.equal(fitsBcrypt('á'.repeat(37)), false);
  assert.equal(fitsBcrypt('😀'.repeat(19)), false);
});

test('attempt limiter blocks after ten attempts, persists across instances and recovers after timeout', async () => {
  const { attemptLimiter } = await import('../src/security');
  const rows = new Map<string, { count: number; windowStartedAt: Date; blockedUntil: Date | null }>();
  const tx = {
    async $executeRaw(_sql: TemplateStringsArray, key: string) {
      if (!rows.has(key)) rows.set(key, { count: 0, windowStartedAt: new Date(), blockedUntil: null });
    },
    async $queryRaw(_sql: TemplateStringsArray, key: string) { return [rows.get(key)]; },
    authAttempt: { async update({ where, data }: { where: { key: string }; data: object }) { Object.assign(rows.get(where.key)!, data); } },
  };
  const prisma = { async $transaction(fn: (tx: unknown) => Promise<void>) { await fn(tx); } } as unknown as PrismaClient;
  const request = { ip: '127.0.0.1', body: { email: 'test@example.com' } } as Request;
  let allowed = 0;
  let status = 0;
  const response = { locals: {}, setHeader() {}, status(code: number) { status = code; return this; }, json() {} } as unknown as Response;
  const limiter = attemptLimiter(prisma, 'login', (req) => req.body.email);
  for (let i = 0; i < 10; i++) await limiter(request, response, () => { allowed++; });
  assert.equal(allowed, 10);
  const restartedLimiter = attemptLimiter(prisma, 'login', (req) => req.body.email);
  await restartedLimiter(request, response, () => { allowed++; });
  assert.equal(status, 429);
  assert.equal(allowed, 10);
  for (const row of rows.values()) row.blockedUntil = new Date(Date.now() - 1000);
  await restartedLimiter(request, response, () => { allowed++; });
  assert.equal(allowed, 11);
});

test('session duration never exceeds eight hours', () => {
  assert.equal(sessionSeconds('8h'), 28800);
  assert.equal(sessionSeconds('30m'), 1800);
  for (const value of ['9h', '0s', '-1h', '8', 'invalid']) assert.throws(() => sessionSeconds(value));
});

test('signed CSRF token allows only matching cookie, header and origin', async () => {
  const { csrfToken, protectWrites } = await import('../src/security');
  let token = '';
  const res = {
    setHeader() {}, cookie(_name: string, value: string) { token = value; }, json() {},
    status(code: number) { assert.equal(code, 403); return this; },
  } as unknown as Response;
  csrfToken({} as Request, res, () => {});
  assert.match(token, /^[a-f0-9]{64}\.[a-f0-9]{64}$/);
  let allowed = false;
  const request = (origin: string, header: string, cookie: string) => ({
    method: 'POST', cookies: { csrf: cookie }, get(name: string) { return name === 'origin' ? origin : header; },
  }) as unknown as Request;
  protectWrites(request('http://localhost:3000', token, token), res, () => { allowed = true; });
  assert.equal(allowed, true);
  allowed = false;
  protectWrites(request('http://attacker.example', token, token), res, () => { allowed = true; });
  assert.equal(allowed, false);
  protectWrites(request('http://localhost:3000', 'bad', token), res, () => { allowed = true; });
  assert.equal(allowed, false);
  const forged = `${'a'.repeat(64)}.${'b'.repeat(64)}`;
  protectWrites(request('http://localhost:3000', forged, forged), res, () => { allowed = true; });
  assert.equal(allowed, false);
});
