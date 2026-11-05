import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
if (!['integration', 'e2e'].includes(mode)) throw new Error('Choose integration or e2e.');
const compose = ['compose', '-f', 'docker-compose.test.yml', '-p', 'base-app-tests'];
const env = {
  ...process.env, NODE_ENV: 'test', TEST_DATABASE_URL: 'postgresql://test_user:test_password@127.0.0.1:55432/base_app_test?schema=public',
  DATABASE_URL: 'postgresql://test_user:test_password@127.0.0.1:55432/base_app_test?schema=public',
  JWT_SECRET: 'test-only-jwt-secret-not-for-production-123456789', JWT_EXPIRES_IN: '8h',
  FRONTEND_URL: 'http://localhost:3100', API_PORT: '4100', NEXT_PUBLIC_API_URL: 'http://localhost:4100',
  COOKIE_SECURE: 'false', AUTH_MAX_ATTEMPTS: '10', AUTH_WINDOW_SECONDS: '300', AUTH_BLOCK_SECONDS: '300',
};
function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, { cwd: root, env: { ...env, ...extraEnv }, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
}
let started = false;
const envTypesPath = path.join(root, 'apps/web/next-env.d.ts');
const originalEnvTypes = mode === 'e2e' ? readFileSync(envTypesPath, 'utf8') : null;
try {
  // Serial ownership: do not run integration and E2E simultaneously against this stack.
  started = true;
  run('docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '90']);
  run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma']);
  for (const locale of ['es', 'en']) {
    console.log(`\n${mode}: APP_LOCALE=${locale}`);
    if (mode === 'integration') run(process.execPath, ['node_modules/tsx/dist/cli.mjs', '--test', 'apps/api/test/integration/api.test.ts'], { APP_LOCALE: locale });
    else run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], { APP_LOCALE: locale });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (originalEnvTypes !== null) {
    const current = readFileSync(envTypesPath, 'utf8');
    // Restore only the known generated path change, never unrelated user edits.
    const normalize = (value) => value.replace(/\r\n/g, '\n');
    if (normalize(current.replace('./.next-test/types/routes.d.ts', './.next/types/routes.d.ts')) === normalize(originalEnvTypes)) writeFileSync(envTypesPath, originalEnvTypes);
  }
  if (started) {
    // Only this dedicated disposable stack is removed; application volumes are untouched.
    const result = spawnSync('docker', [...compose, 'down'], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) process.exitCode = 1;
  }
}
