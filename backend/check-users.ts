import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function assertDangerousScriptAllowed() {
  if (process.env.ALLOW_DANGEROUS_SCRIPT !== 'true') {
    console.error(
      'DANGEROUS LEGACY SCRIPT blocked. Set ALLOW_DANGEROUS_SCRIPT=true only for an audited local maintenance run.',
    );
    process.exit(1);
  }
}

async function checkUsers() {
  assertDangerousScriptAllowed();

  try {
    console.log('🔍 Проверка пользователей в базе...\n');
    
    const users = await prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        createdAt: true
      }
    });

    console.log(`📊 Найдено пользователей: ${users.length}\n`);
    
    for (const user of users) {
      console.log(`👤 ${user.name} (${user.role})`);
      console.log(`   Логин: ${user.login}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Создан: ${user.createdAt.toLocaleString('ru-RU')}`);
      console.log('---');
    }

  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
