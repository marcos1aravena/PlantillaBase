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

test('permission matrix prevents administrators from mutating peer accounts', async () => {
  const { canManage, assertManage, assertAssignRole } = await import('../src/permissions');
  assert.equal(canManage('ADMIN', 'USER'), true);
  assert.equal(canManage('ADMIN', 'ADMIN'), false);
  assert.equal(canManage('ADMIN', 'SUPERADMIN'), false);
  assert.equal(canManage('USER', 'USER'), false);
  assert.equal(canManage('SUPERADMIN', 'ADMIN'), true);
  assert.throws(() => assertManage('ADMIN', 'ADMIN'));
  assert.throws(() => assertAssignRole('ADMIN', 'ADMIN'));
  assert.doesNotThrow(() => assertAssignRole('SUPERADMIN', 'ADMIN'));
});

test('profile validation forbids email and role and pairs password fields', async () => {
  const { validate, profileSchema } = await import('../src/validation');
  assert.deepEqual(validate(profileSchema, { name: 'New name' }), { name: 'New name' });
  assert.throws(() => validate(profileSchema, { email: 'new@example.com' }));
  assert.throws(() => validate(profileSchema, { role: 'ADMIN' }));
  assert.throws(() => validate(profileSchema, { newPassword: 'long-new-password' }));
  assert.throws(() => validate(profileSchema, { currentPassword: 'old', newPassword: 'á'.repeat(37) }));
});

test('validation details are field-specific except for login', async () => {
  const { validate, createUserSchema, loginSchema } = await import('../src/validation');
  const { AppError } = await import('../src/errors');
  assert.throws(() => validate(createUserSchema, { name: 'x', email: 'bad', password: 'short', role: 'USER' }), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.ok(error.fieldErrors?.name);
    assert.ok(error.fieldErrors?.email);
    assert.ok(error.fieldErrors?.password);
    return true;
  });
  assert.throws(() => validate(loginSchema, { email: 'bad', password: '' }, false), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.message, 'Incorrect email or password.');
    assert.equal(error.fieldErrors, undefined);
    return true;
  });
});

test('pagination validates defaults, bounds and integer values', async () => {
  const { validate, paginationSchema } = await import('../src/validation');
  assert.deepEqual(validate(paginationSchema, {}), { page: 1, limit: 20 });
  assert.deepEqual(validate(paginationSchema, { page: '2', limit: '100' }), { page: 2, limit: 100 });
  for (const query of [{ page: '0' }, { page: '1.5' }, { limit: '101' }, { limit: '-1' }, { limit: 'bad' }]) assert.throws(() => validate(paginationSchema, query));
});

test('user pagination clamps pages and selects only public fields', async () => {
  const { listUsers } = await import('../src/services/users');
  let total = 21;
  let query: { skip: number; take: number; select: Record<string, boolean> } | undefined;
  const tx = { user: {
    count: async () => total,
    findMany: async (input: typeof query) => { query = input; return []; },
  } };
  const database = { $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
  const result = await listUsers(99, 20, database);
  assert.deepEqual(result.pagination, { page: 2, limit: 20, total: 21, totalPages: 2 });
  assert.equal(query?.skip, 20);
  assert.equal(query?.take, 20);
  assert.equal(query?.select.passwordHash, undefined);
  assert.equal(query?.select.sessionVersion, undefined);
  total = 0;
  assert.deepEqual((await listUsers(5, 20, database)).pagination, { page: 1, limit: 20, total: 0, totalPages: 1 });
});

test('refactored app preserves health endpoints and rejects unauthenticated/CSRF requests', async () => {
  const { app } = await import('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(`${url}/api/health`)).status, 200);
    assert.equal((await fetch(`${url}/api/auth/me`)).status, 401);
    assert.equal((await fetch(`${url}/api/users`)).status, 401);
    const rejected = await fetch(`${url}/api/auth/logout`, { method: 'POST', headers: { Origin: 'http://localhost:3000' } });
    assert.equal(rejected.status, 403);
    assert.equal((await rejected.json()).code, 'CSRF_INVALID');
    const csrf = await fetch(`${url}/api/auth/csrf`);
    const { token } = await csrf.json();
    const cookie = csrf.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await fetch(`${url}/api/auth/logout`, { method: 'POST', headers: { Origin: 'http://localhost:3000', Cookie: cookie, 'X-CSRF-Token': token } })).status, 204);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
