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

  const managerPassword = requireEnv('CREATE_REAL_MANAGER_PASSWORD');
  const adminPassword = requireEnv('CREATE_REAL_ADMIN_PASSWORD');

  await prisma.employee.updateMany({
    where: {
      OR: [
        { login: { in: ['alexey', 'alexander', 'luka'] } },
        { name: { in: ['Алексей Мураитов', 'Александр Ануфриев', 'Иван Лукашин'] } },
      ],
    },
    data: {
      isActive: false,
    },
  });

  // Менеджер
  await prisma.employee.upsert({
    where: { login: 'manager' },
    update: {
      passwordHash: await bcrypt.hash(managerPassword, 10),
      name: 'Менеджер',
      firstName: 'Менеджер',
      lastName: 'TechnoPrime',
      role: 'MANAGER',
      position: 'MANAGER',
      tenant: 'TECHNOPRIME',
      isActive: true,
    },
    create: {
      login: 'manager',
      passwordHash: await bcrypt.hash(managerPassword, 10),
      name: 'Менеджер',
      firstName: 'Менеджер',
      lastName: 'TechnoPrime',
      role: 'MANAGER',
      position: 'MANAGER',
      tenant: 'TECHNOPRIME',
    },
  });

  // Дополнительный SUPER_ADMIN для тестирования
  await prisma.employee.upsert({
    where: { login: 'admin' },
    update: {
      passwordHash: await bcrypt.hash(adminPassword, 10),
      name: 'Администратор',
      firstName: 'Админ',
      lastName: 'Системы',
      role: 'SUPER_ADMIN',
      position: 'OWNER',
      tenant: null,
      isActive: true,
    },
    create: {
      login: 'admin',
      passwordHash: await bcrypt.hash(adminPassword, 10),
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
  console.log('👤 SUPER_ADMIN (тестовый):');
  console.log('   Логин: admin');
  
  console.log('👤 MANAGER:');
  console.log('   Логин: manager');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
