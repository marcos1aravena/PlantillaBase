import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const password = 'Test-password-12345';
export const newPassword = 'New-password-67890';
export const accounts = {
  SUPERADMIN: 'super@test.example', ADMIN: 'admin@test.example', USER: 'user@test.example',
};

export function testDatabase() {
  const url = new URL(process.env.TEST_DATABASE_URL || '');
  if (url.hostname !== '127.0.0.1' || url.port !== '55432' || url.pathname !== '/base_app_test' || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error('Refusing test cleanup: an isolated TEST_DATABASE_URL is required.');
  }
  return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}
export async function resetDatabase(db: PrismaClient) {
  // Guard even when callers provide their own client.
  const guard = testDatabase(); await guard.$disconnect();
  await db.authAttempt.deleteMany();
  await db.user.deleteMany();
  const passwordHash = await bcrypt.hash(password, 12);
  for (const role of Object.keys(accounts) as Role[]) {
    await db.user.create({ data: { email: accounts[role], name: role, role, passwordHash } });
  }
}
