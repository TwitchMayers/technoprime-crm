import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 Проверка пользователей в базе...\n');
    
    const users = await prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        login: true,
        role: true,
        passwordHash: true,
        createdAt: true
      }
    });

    console.log(`📊 Найдено пользователей: ${users.length}\n`);
    
    for (const user of users) {
      console.log(`👤 ${user.name} (${user.role})`);
      console.log(`   Логин: ${user.login}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Создан: ${user.createdAt.toLocaleString('ru-RU')}`);
      console.log(`   Хэш пароля: ${user.passwordHash.substring(0, 20)}...`);
      console.log('---');
    }

    // Проверим пароли
    console.log('\n🔐 Проверка паролей:\n');
    
    const testPasswords = [
      { login: 'alexey', password: 'Alexey2025!' },
      { login: 'admin', password: 'admin123' },
      { login: 'richceo', password: 'richceo2025' },
      { login: 'manager', password: 'manager2025' },
      { login: 'alexander', password: 'Sasha2025!' }
    ];

    for (const test of testPasswords) {
      const user = users.find(u => u.login === test.login);
      if (user) {
        const isValid = await bcrypt.compare(test.password, user.passwordHash);
        console.log(`✅ ${test.login}: ${isValid ? 'Пароль верный' : '❌ Пароль НЕВЕРНЫЙ'}`);
      } else {
        console.log(`❌ ${test.login}: Пользователь не найден`);
      }
    }

  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();