import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, client } from '../../web/app/api';

test('HTTP client distinguishes network, authentication and permissions failures', async (context) => {
  const mockFetch = context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Denied' }), { status: 403 }));
  await assert.rejects(client.users(), (err: unknown) => err instanceof ApiError && err.status === 403 && err.message === 'Denied');
  mockFetch.mock.mockImplementation(async () => new Response(JSON.stringify({ error: 'Expired' }), { status: 401 }));
  await assert.rejects(client.me(), (err: unknown) => err instanceof ApiError && err.status === 401);
  mockFetch.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(client.me(), (err: unknown) => err instanceof ApiError && err.status === 0);
});

test('HTTP client preserves rate-limit wait duration', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Wait', retryAfter: 300 }), { status: 429 }));
  await assert.rejects(client.me(), (err: unknown) => err instanceof ApiError && err.status === 429 && err.retryAfter === 300);
});
