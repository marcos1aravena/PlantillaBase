import { defineConfig, devices } from '@playwright/test';

const locale = process.env.APP_LOCALE || 'es';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  expect: { timeout: 10000 },
  outputDir: `test-results/${locale}`,
  reporter: [['list'], ['html', { outputFolder: `playwright-report/${locale}`, open: 'never' }]],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node node_modules/tsx/dist/cli.mjs apps/api/src/server.ts', url: 'http://localhost:4100/api/health/ready', reuseExistingServer: false, timeout: 120000 },
    { command: 'npm run dev -w @base/web -- --port 3100', url: 'http://localhost:3100/api/health', reuseExistingServer: false, timeout: 120000, env: { TEST_WEB_DIST_DIR: '.next-test', NEXT_PUBLIC_API_URL: 'http://localhost:4100' } },
  ],
});
