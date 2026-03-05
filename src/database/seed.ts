import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin@edlight2026', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@edlight.org' },
    update: { mustChangePassword: true },
    create: {
      email: 'admin@edlight.org',
      password: hashedPassword,
      firstName: 'Edlight',
      lastName: 'Admin',
      role: Role.ADMIN,
      mustChangePassword: true,
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Create info admin user
  const infoPassword = await bcrypt.hash('info@edlight2026', 12);

  const infoAdmin = await prisma.user.upsert({
    where: { email: 'info@edlight.org' },
    update: { mustChangePassword: true },
    create: {
      email: 'info@edlight.org',
      password: infoPassword,
      firstName: 'Edlight',
      lastName: 'Info',
      role: Role.ADMIN,
      mustChangePassword: true,
    },
  });

  console.log(`✅ Admin user created: ${infoAdmin.email}`);

  console.log('🌱 Seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
