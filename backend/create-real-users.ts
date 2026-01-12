import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Алексей Мураитов - Супер Администратор
  await prisma.employee.upsert({
    where: { login: 'alexey' },
    update: {
      passwordHash: await bcrypt.hash('Alexey2025!', 10),
    },
    create: {
      login: 'alexey',
      passwordHash: await bcrypt.hash('Alexey2025!', 10),
      name: 'Алексей Мураитов',
      firstName: 'Алексей',
      lastName: 'Мураитов',
      role: 'SUPER_ADMIN',
      position: 'OWNER',
      tenant: null,
    },
  });

  // Александр Ануфриев - Технический специалист
  await prisma.employee.upsert({
    where: { login: 'alexander' },
    update: {
      passwordHash: await bcrypt.hash('Sasha2025!', 10),
    },
    create: {
      login: 'alexander',
      passwordHash: await bcrypt.hash('Sasha2025!', 10),
      name: 'Александр Ануфриев',
      firstName: 'Александр',
      lastName: 'Ануфриев',
      role: 'TECHNICAL_SPECIALIST',
      position: 'TECHNICIAN',
      tenant: 'TECHNOPRIME',
    },
  });

  // Менеджер
  await prisma.employee.upsert({
    where: { login: 'manager' },
    update: {
      passwordHash: await bcrypt.hash('manager2025', 10),
    },
    create: {
      login: 'manager',
      passwordHash: await bcrypt.hash('manager2025', 10),
      name: 'Менеджер',
      firstName: 'Менеджер',
      lastName: 'TechnoPrime',
      role: 'MANAGER',
      position: 'MANAGER',
      tenant: 'TECHNOPRIME',
    },
  });

  // CEO RichMarket
  await prisma.employee.upsert({
    where: { login: 'richceo' },
    update: {
      passwordHash: await bcrypt.hash('richceo2025', 10),
    },
    create: {
      login: 'richceo',
      passwordHash: await bcrypt.hash('richceo2025', 10),
      name: 'CEO RichMarket',
      firstName: 'Директор',
      lastName: 'RichMarket',
      role: 'RICHMARKET_CEO',
      position: 'CEO',
      tenant: 'RICHMARKET',
    },
  });

  // Дополнительный SUPER_ADMIN для тестирования
  await prisma.employee.upsert({
    where: { login: 'admin' },
    update: {
      passwordHash: await bcrypt.hash('admin123', 10),
    },
    create: {
      login: 'admin',
      passwordHash: await bcrypt.hash('admin123', 10),
      name: 'Администратор',
      firstName: 'Админ',
      lastName: 'Системы',
      role: 'SUPER_ADMIN',
      position: 'OWNER',
      tenant: null,
    },
  });

  console.log('✅ Пользователи созданы/обновлены успешно!');
  console.log('\n📋 Доступные логины и пароли:');
  console.log('─────────────────────────────────────────');
  console.log('👤 SUPER_ADMIN (полный доступ ко всему):');
  console.log('   Логин: alexey');
  console.log('   Пароль: Alexey2025!\n');
  
  console.log('👤 SUPER_ADMIN (тестовый):');
  console.log('   Логин: admin');
  console.log('   Пароль: admin123\n');
  
  console.log('👤 RICHMARKET_CEO:');
  console.log('   Логин: richceo');
  console.log('   Пароль: richceo2025\n');
  
  console.log('👤 MANAGER:');
  console.log('   Логин: manager');
  console.log('   Пароль: manager2025\n');
  
  console.log('👤 TECHNICAL_SPECIALIST:');
  console.log('   Логин: alexander');
  console.log('   Пароль: Sasha2025!\n');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });