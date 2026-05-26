import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function assertDangerousScriptAllowed() {
  if (process.env.ALLOW_DANGEROUS_SCRIPT !== 'true') {
    console.error(
      'DANGEROUS LEGACY SCRIPT blocked. Set ALLOW_DANGEROUS_SCRIPT=true only for an audited local maintenance run.',
    );
    process.exit(1);
  }
}

function requireEnv(name: string) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} is required for this dangerous maintenance script`);
  }
  return value;
}

async function main() {
  assertDangerousScriptAllowed();

  // Хешируем пароли
  const adminPassword = await bcrypt.hash(requireEnv('SEED_ADMIN_PASSWORD'), 10);
  const managerPassword = await bcrypt.hash(requireEnv('SEED_MANAGER_PASSWORD'), 10);
  const techPassword = await bcrypt.hash(requireEnv('SEED_TECH_PASSWORD'), 10);

  // Создаем админа
  const admin = await prisma.employee.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      login: 'admin',
      passwordHash: adminPassword,
      name: 'Администратор',
      firstName: 'Иван',
      lastName: 'Петров',
      role: 'ADMIN',
      position: 'OWNER',
    },
  });

  console.log('✅ Создан ADMIN:', {
    login: 'admin',
    role: 'ADMIN',
  });

  // Создаем менеджера
  const manager = await prisma.employee.upsert({
    where: { login: 'manager' },
    update: {},
    create: {
      login: 'manager',
      passwordHash: managerPassword,
      name: 'Менеджер',
      firstName: 'Алексей',
      lastName: 'Сидоров',
      role: 'MANAGER',
      position: 'MANAGER',
    },
  });

  console.log('✅ Создан MANAGER:', {
    login: 'manager',
    role: 'MANAGER',
  });

  // Создаем технического специалиста
  const tech = await prisma.employee.upsert({
    where: { login: 'tech' },
    update: {},
    create: {
      login: 'tech',
      passwordHash: techPassword,
      name: 'Техник',
      firstName: 'Дмитрий',
      lastName: 'Иванов',
      role: 'TECHNICAL_SPECIALIST',
      position: 'TECHNICIAN',
    },
  });

  console.log('✅ Создан TECHNICAL_SPECIALIST:', {
    login: 'tech',
    role: 'TECHNICAL_SPECIALIST',
  });

  console.log('\n📋 Сводка всех тестовых пользователей:');
  console.log('─────────────────────────────────────────');
  console.log('👤 ADMIN:');
  console.log('   Логин: admin');
  console.log('   Доступ: Все разделы + Дашборд\n');

  console.log('👤 MANAGER:');
  console.log('   Логин: manager');
  console.log('   Доступ: Клиенты, Товары, Заказы, Подписки\n');

  console.log('👤 TECHNICAL_SPECIALIST:');
  console.log('   Логин: tech');
  console.log('   Доступ: Товары (добавление), Задачи (только свои)\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
