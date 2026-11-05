import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';
import type { Role } from '@base/contracts';
import { testDatabase, resetDatabase, password, newPassword, accounts } from '../../../../tests/fixtures';

const db = testDatabase();
let server: Server;
let base: string;
const english = process.env.APP_LOCALE === 'en';
const genericLogin = english ? 'Incorrect email or password.' : 'Correo o contraseña incorrectos.';

class Session {
  cookies = new Map<string, string>();
  csrf = '';
  async request(path: string, method = 'GET', body?: object) {
    if (method !== 'GET' && !this.csrf) {
      const response = await this.request('/auth/csrf'); this.csrf = (await response.json()).token;
    }
    const response = await fetch(`${base}/api${path}`, {
      method, headers: { Origin: process.env.FRONTEND_URL!, Cookie: [...this.cookies].map(([key, value]) => `${key}=${value}`).join('; '), 'X-CSRF-Token': this.csrf, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'); const equal = pair.indexOf('='); this.cookies.set(pair.slice(0, equal), pair.slice(equal + 1));
    }
    return response;
  }
}
async function login(role: Role) {
  const session = new Session();
  assert.equal((await session.request('/auth/login', 'POST', { email: accounts[role], password })).status, 200);
  return session;
}
async function id(role: Role) { return (await db.user.findUniqueOrThrow({ where: { email: accounts[role] } })).id; }

before(async () => {
  const { app } = await import('../../src/app');
  server = app.listen(0, '127.0.0.1'); await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => resetDatabase(db));
after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await db.$disconnect();
  const { prisma } = await import('../../src/db'); await prisma.$disconnect();
});

test('login uses HttpOnly cookies, correct credentials and generic errors without account clues', async () => {
  const session = await login('USER');
  const me = await session.request('/auth/me'); assert.equal(me.status, 200);
  const user = (await me.json()).user; assert.equal(user.email, accounts.USER); assert.equal(user.passwordHash, undefined);
  for (const input of [{ email: accounts.USER, password: 'wrong' }, { email: 'missing@test.example', password }, { email: 'bad', password: '' }]) {
    const response = await session.request('/auth/login', 'POST', input);
    assert.ok([400, 401].includes(response.status));
    const result = await response.json(); assert.equal(result.error, genericLogin); assert.equal(result.fieldErrors, undefined);
  }
  const response = await session.request('/auth/login', 'POST', { email: accounts.USER, password });
  assert.match(response.headers.get('set-cookie') || '', /HttpOnly/i);
});

test('expired JWT is rejected without waiting for real expiry', async () => {
  const session = new Session();
  session.cookies.set('session', jwt.sign({ sessionVersion: 0 }, process.env.JWT_SECRET!, { subject: await id('USER'), expiresIn: -1 }));
  assert.equal((await session.request('/auth/me')).status, 401);
});

test('all three roles follow the full consultation and mutation permission matrix', async () => {
  for (const actor of ['SUPERADMIN', 'ADMIN', 'USER'] as Role[]) {
    const session = await login(actor);
    assert.equal((await session.request('/users')).status, actor === 'USER' ? 403 : 200);
    for (const target of ['SUPERADMIN', 'ADMIN', 'USER'] as Role[]) {
      const allowed = actor === 'SUPERADMIN' || (actor === 'ADMIN' && target === 'USER');
      assert.equal((await session.request(`/users/${await id(target)}`, 'PATCH', { name: `${target} edited` })).status, allowed ? 200 : 403);
    }
    for (const role of ['SUPERADMIN', 'ADMIN', 'USER'] as Role[]) {
      const allowed = actor === 'SUPERADMIN' || (actor === 'ADMIN' && role === 'USER');
      assert.equal((await session.request('/users', 'POST', { name: 'Created', email: `${actor}-${role}@test.example`, password, role })).status, allowed ? 201 : 403);
    }
  }
  const admin = await login('ADMIN');
  const listing = await (await admin.request('/users')).json();
  assert.ok(listing.users.some((user: { role: string }) => user.role === 'ADMIN'));
  assert.equal((await admin.request(`/users/${await id('USER')}`, 'PATCH', { role: 'ADMIN' })).status, 403);
  assert.equal((await admin.request(`/users/${await id('ADMIN')}`, 'DELETE')).status, 403);
  for (const actor of ['SUPERADMIN', 'ADMIN', 'USER'] as Role[]) {
    const session = await login(actor);
    for (const role of ['SUPERADMIN', 'ADMIN', 'USER'] as Role[]) {
      const target = await db.user.create({ data: { name: 'Delete target', email: `delete-${actor}-${role}@test.example`, role, passwordHash: 'unused-test-hash' } });
      const allowed = (actor === 'SUPERADMIN' && role !== 'SUPERADMIN') || (actor === 'ADMIN' && role === 'USER');
      assert.equal((await session.request(`/users/${target.id}`, 'DELETE')).status, allowed ? 204 : 403);
    }
  }
});

test('profile refuses email and role for every role and exposes translated field errors', async () => {
  for (const role of ['SUPERADMIN', 'ADMIN', 'USER'] as Role[]) {
    const session = await login(role);
    for (const body of [{ email: 'changed@test.example' }, { role: 'SUPERADMIN' }]) assert.equal((await session.request('/auth/profile', 'PATCH', body)).status, 400);
    const invalid = await (await session.request('/auth/profile', 'PATCH', { name: ' ' })).json();
    assert.equal(invalid.fieldErrors.name[0], english ? 'Name must contain between 2 and 100 characters.' : 'El nombre debe tener entre 2 y 100 caracteres.');
    assert.equal((await session.request('/auth/profile', 'PATCH', { name: 'Updated name' })).status, 200);
    assert.equal((await db.user.findUniqueOrThrow({ where: { id: await id(role) } })).role, role);
  }
});

test('password change revokes current and other sessions and rejects the old password', async () => {
  const first = await login('USER'); const second = await login('USER');
  assert.equal((await first.request('/auth/profile', 'PATCH', { currentPassword: 'wrong', newPassword })).status, 400);
  assert.equal((await second.request('/auth/me')).status, 200);
  assert.equal((await first.request('/auth/profile', 'PATCH', { currentPassword: password, newPassword })).status, 200);
  assert.equal((await first.request('/auth/me')).status, 401); assert.equal((await second.request('/auth/me')).status, 401);
  const fresh = new Session();
  assert.equal((await fresh.request('/auth/login', 'POST', { email: accounts.USER, password })).status, 401);
  assert.equal((await fresh.request('/auth/login', 'POST', { email: accounts.USER, password: newPassword })).status, 200);
});

test('manual revocation and administrative password reset invalidate all existing tokens', async () => {
  const first = await login('USER'); const second = await login('USER');
  assert.equal((await first.request('/auth/revoke-sessions', 'POST')).status, 204);
  assert.equal((await first.request('/auth/me')).status, 401); assert.equal((await second.request('/auth/me')).status, 401);
  const third = await login('USER'); const superadmin = await login('SUPERADMIN');
  assert.equal((await superadmin.request(`/users/${await id('USER')}`, 'PATCH', { password: newPassword })).status, 200);
  assert.equal((await third.request('/auth/me')).status, 401);
});

test('CRUD, role changes, deactivation and pagination use only public fields', async () => {
  const session = await login('SUPERADMIN');
  const create = await session.request('/users', 'POST', { name: 'Created', email: 'created@test.example', password, role: 'USER' }); assert.equal(create.status, 201);
  const target = (await create.json()).user;
  assert.equal((await session.request(`/users/${target.id}`, 'PATCH', { name: 'Edited', email: 'edited@test.example', role: 'ADMIN' })).status, 200);
  const targetSession = new Session(); assert.equal((await targetSession.request('/auth/login', 'POST', { email: 'edited@test.example', password })).status, 200);
  assert.equal((await session.request(`/users/${target.id}`, 'PATCH', { active: false })).status, 200);
  assert.equal((await targetSession.request('/auth/me')).status, 401);
  assert.equal((await targetSession.request('/auth/login', 'POST', { email: 'edited@test.example', password })).status, 401);
  const list = await (await session.request('/users?page=2&limit=2')).json(); assert.equal(list.users.length, 2); assert.equal(list.pagination.total, 4);
  for (const user of list.users) { assert.equal(user.passwordHash, undefined); assert.equal(user.sessionVersion, undefined); }
  assert.equal((await session.request(`/users/${target.id}`, 'DELETE')).status, 204); assert.equal(await db.user.count(), 3);
});

test('last superadministrator cannot be demoted, disabled or deleted', async () => {
  const session = await login('SUPERADMIN'); const target = await id('SUPERADMIN');
  assert.equal((await session.request(`/users/${target}`, 'PATCH', { role: 'ADMIN' })).status, 400);
  assert.equal((await session.request(`/users/${target}`, 'PATCH', { active: false })).status, 403);
  assert.equal((await session.request(`/users/${target}`, 'DELETE')).status, 403);
  assert.equal(await db.user.count({ where: { role: 'SUPERADMIN', active: true } }), 1);
});

test('concurrent demotions preserve at least one active superadministrator', async () => {
  const session = await login('SUPERADMIN');
  const second = await db.user.create({ data: { name: 'Second super', email: 'second@test.example', role: 'SUPERADMIN', passwordHash: (await db.user.findUniqueOrThrow({ where: { email: accounts.SUPERADMIN } })).passwordHash } });
  // Widen the race in the isolated database, so both counts precede their writes.
  await db.$executeRawUnsafe(`CREATE FUNCTION test_delay_demotion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.role = 'SUPERADMIN' AND NEW.role <> 'SUPERADMIN' THEN PERFORM pg_sleep(0.5); END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER test_demotion_delay BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION test_delay_demotion()`);
  try {
    const results = await Promise.all([
      session.request(`/users/${await id('SUPERADMIN')}`, 'PATCH', { role: 'ADMIN' }),
      session.request(`/users/${second.id}`, 'PATCH', { role: 'ADMIN' }),
    ]);
    assert.ok(results.some((response) => response.status === 200));
    assert.ok(results.some((response) => response.status === 400 || response.status === 403));
    assert.equal(await db.user.count({ where: { role: 'SUPERADMIN', active: true } }), 1);
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER test_demotion_delay ON "User"`);
    await db.$executeRawUnsafe('DROP FUNCTION test_delay_demotion()');
  }
});
