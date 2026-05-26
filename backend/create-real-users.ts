import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
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
      passwordHash: await bcrypt.hash('manager2025', 10),
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
      passwordHash: await bcrypt.hash('manager2025', 10),
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
      passwordHash: await bcrypt.hash('admin123', 10),
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
  console.log('👤 SUPER_ADMIN (тестовый):');
  console.log('   Логин: admin');
  console.log('   Пароль: admin123\n');
  
  console.log('👤 MANAGER:');
  console.log('   Логин: manager');
  console.log('   Пароль: manager2025\n');
}

main()
  .catch((e) => {
    console.error('❌ Ошибка:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
