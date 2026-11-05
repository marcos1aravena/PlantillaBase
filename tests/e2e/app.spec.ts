import { test, expect, Page } from '@playwright/test';
import type { Role } from '@base/contracts';
import { testDatabase, resetDatabase, accounts, password, newPassword } from '../fixtures';
import { es, TranslationKey } from '../../apps/web/app/locales/es';
import { en } from '../../apps/web/app/locales/en';

const db = testDatabase();
const locale = process.env.APP_LOCALE === 'en' ? 'en' : 'es';
const dictionary = locale === 'en' ? en : es;
const t = (key: TranslationKey) => dictionary[key];
const loginError = locale === 'en' ? 'Incorrect email or password.' : 'Correo o contraseña incorrectos.';
async function login(page: Page, role: Role, credential = password) {
  await page.goto('/login');
  await page.getByLabel(t('fields.email')).fill(accounts[role]);
  await page.getByLabel(t('fields.password'), { exact: true }).fill(credential);
  await page.getByRole('button', { name: t('login.submit'), exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
}
test.beforeEach(async () => { await resetDatabase(db); });
test.afterAll(async () => { await db.$disconnect(); });

test('login rejects invalid credentials generically in the configured language', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(t('fields.email')).fill(accounts.USER);
  await page.getByLabel(t('fields.password'), { exact: true }).fill('wrong');
  await page.getByRole('button', { name: t('login.submit'), exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toHaveText(loginError);
  await page.getByLabel(t('fields.email')).fill('missing@test.example');
  await page.getByRole('button', { name: t('login.submit'), exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toHaveText(loginError);
  await page.getByLabel(t('fields.email')).fill(accounts.USER);
  await page.getByLabel(t('fields.password'), { exact: true }).fill(password);
  await page.getByRole('button', { name: t('login.submit'), exact: true }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: `${t('home.greeting')} USER` })).toBeVisible();
});

for (const role of ['SUPERADMIN', 'ADMIN', 'USER'] as Role[]) {
  test(`${role}: sidebar and administrative controls respect permissions`, async ({ page }) => {
    await login(page, role);
    await expect(page.getByRole('link', { name: t('nav.profile'), exact: true })).toBeVisible();
    if (role === 'USER') {
      await expect(page.getByRole('link', { name: t('nav.users'), exact: true })).toHaveCount(0);
      await page.goto('/home/users'); await expect(page.locator('main [role="alert"]')).toHaveText(t('errors.forbidden'));
    } else {
      await page.getByRole('link', { name: t('nav.users'), exact: true }).click();
      const peer = page.getByRole('row').filter({ hasText: accounts.ADMIN });
      await expect(peer).toBeVisible();
      if (role === 'ADMIN') {
        await expect(peer.getByRole('button', { name: t('users.edit'), exact: true })).toBeDisabled();
        await expect(peer.getByRole('button', { name: t('users.delete'), exact: true })).toBeDisabled();
      } else await expect(peer.getByRole('button', { name: t('users.edit'), exact: true })).toBeEnabled();
      const normal = page.getByRole('row').filter({ hasText: accounts.USER });
      await expect(normal.getByRole('button', { name: t('users.edit'), exact: true })).toBeEnabled();
    }
  });
}

test('profile shows immutable email/role, validates name and updates shared sidebar state', async ({ page }) => {
  await login(page, 'USER'); await page.getByRole('link', { name: t('nav.profile'), exact: true }).click();
  await expect(page.getByText(accounts.USER, { exact: true })).toBeVisible();
  await expect(page.getByLabel(t('fields.email'))).toHaveCount(0);
  await expect(page.getByLabel(t('fields.role'))).toHaveCount(0);
  await page.getByLabel(t('fields.name'), { exact: true }).fill('  ');
  await page.getByRole('button', { name: t('profile.saveName'), exact: true }).click();
  const validation = locale === 'en' ? 'Name must contain between 2 and 100 characters.' : 'El nombre debe tener entre 2 y 100 caracteres.';
  await expect(page.getByText(validation, { exact: true })).toBeVisible();
  await page.getByLabel(t('fields.name'), { exact: true }).fill('Updated profile');
  await page.getByRole('button', { name: t('profile.saveName'), exact: true }).click();
  await expect(page.getByRole('status')).toHaveText(t('profile.nameSaved'));
  await expect(page.locator('aside').getByText('Updated profile', { exact: true })).toBeVisible();
});

test('password change closes the session and accepts only the new password', async ({ page }) => {
  await login(page, 'USER'); await page.getByRole('link', { name: t('nav.profile'), exact: true }).click();
  await page.getByLabel(t('profile.currentPassword'), { exact: true }).fill(password);
  await page.getByLabel(t('profile.newPassword'), { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: t('profile.changePassword'), exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel(t('fields.email')).fill(accounts.USER);
  await page.getByLabel(t('fields.password'), { exact: true }).fill(password);
  await page.getByRole('button', { name: t('login.submit'), exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toHaveText(loginError);
  await login(page, 'USER', newPassword);
});

test('explicit session revocation returns to login', async ({ page }) => {
  await login(page, 'USER'); await page.getByRole('link', { name: t('nav.profile'), exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: t('profile.revoke'), exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/home'); await expect(page).toHaveURL(/\/login$/);
});

test('administrator creates, edits and deactivates a normal user; pagination control is available', async ({ page }) => {
  await login(page, 'ADMIN'); await page.getByRole('link', { name: t('nav.users'), exact: true }).click();
  await page.getByRole('button', { name: t('users.create'), exact: true }).click();
  await page.getByLabel(t('fields.name'), { exact: true }).fill('Browser user');
  await page.getByLabel(t('fields.email'), { exact: true }).fill('browser@test.example');
  await page.getByLabel(t('users.passwordLabel'), { exact: true }).fill(password);
  await page.getByRole('button', { name: t('users.save'), exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: 'browser@test.example' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: t('users.edit'), exact: true }).click();
  await page.getByLabel(t('fields.name'), { exact: true }).fill('Edited browser user');
  await page.getByRole('button', { name: t('users.save'), exact: true }).click();
  await expect(row.getByText('Edited browser user', { exact: true })).toBeVisible();
  await row.getByRole('button', { name: t('status.active'), exact: true }).click();
  await expect(row.getByRole('button', { name: t('status.inactive'), exact: true })).toBeVisible();
  await page.getByLabel(t('pagination.limit')).selectOption('10');
  await expect(page.getByRole('button', { name: t('pagination.previous'), exact: true })).toBeDisabled();
});

test('language is not guessed while runtime config loads', async ({ page }) => {
  let release!: () => void; let requested!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const seen = new Promise<void>((resolve) => { requested = resolve; });
  await page.route('**/api/config', async (route) => { requested(); await gate; await route.continue(); });
  await page.goto('/login'); await seen;
  await expect(page.getByRole('heading')).toHaveCount(0);
  await expect(page.getByText(locale === 'en' ? es['login.welcome'] : en['login.welcome'], { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByRole('heading', { name: t('login.welcome'), exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
});

test('language load failure is visible and retry restores the UI', async ({ page }) => {
  await page.route('**/api/config', (route) => route.abort(), { times: 1 });
  await page.goto('/login'); await expect(page.locator('main [role="alert"]')).toContainText('Could not load language');
  await page.getByRole('button', { name: 'Reintentar / Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: t('login.welcome'), exact: true })).toBeVisible();
});
