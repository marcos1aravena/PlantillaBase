import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SEED_SUPERADMIN_NAME;
  const email = process.env.SEED_SUPERADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!email || !password) throw new Error('Set SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD before seeding.');
  if (password.length < 12) throw new Error('SEED_SUPERADMIN_PASSWORD must contain at least 12 characters.');

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: name || 'Superadministrador', email, passwordHash, role: Role.SUPERADMIN },
  });
  console.log(`Superadministrator ensured: ${email}`);
}

main().finally(() => prisma.$disconnect());
