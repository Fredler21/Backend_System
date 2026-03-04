import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('admin@edlight2026', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@edlight.io' },
    update: {},
    create: {
      email: 'admin@edlight.io',
      password: hashedPassword,
      firstName: 'Edlight',
      lastName: 'Admin',
      role: Role.ADMIN,
    },
  });

  console.log(`✅ Admin user created: ${admin.email}`);

  // Create sample student
  const studentPassword = await bcrypt.hash('student@edlight2026', 12);

  const student = await prisma.user.upsert({
    where: { email: 'student@edlight.io' },
    update: {},
    create: {
      email: 'student@edlight.io',
      password: studentPassword,
      firstName: 'Sample',
      lastName: 'Student',
      role: Role.STUDENT,
    },
  });

  console.log(`✅ Student user created: ${student.email}`);

  // Create sample developer
  const devPassword = await bcrypt.hash('developer@edlight2026', 12);

  const developer = await prisma.user.upsert({
    where: { email: 'developer@edlight.io' },
    update: {},
    create: {
      email: 'developer@edlight.io',
      password: devPassword,
      firstName: 'Sample',
      lastName: 'Developer',
      role: Role.DEVELOPER,
    },
  });

  console.log(`✅ Developer user created: ${developer.email}`);

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
