// Простой тест без зависимостей
async function testEndpoints() {
  const baseUrl = 'http://localhost:4000/api';
  
  console.log('🔍 Тестирование эндпоинтов систем шеринга...\n');
  
  try {
    // Тест 1: Проверка GET /sharing-systems
    console.log('1. Тестируем GET /api/sharing-systems');
    const response1 = await fetch(`${baseUrl}/sharing-systems`);
    console.log('   Status:', response1.status, response1.statusText);
    console.log('   Content-Type:', response1.headers.get('content-type'));
    
    const text1 = await response1.text();
    if (text1.includes('<!DOCTYPE') || text1.includes('<html')) {
      console.log('   ❌ Получен HTML вместо JSON!');
      console.log('   Первые 500 символов:', text1.substring(0, 500));
    } else {
      console.log('   ✅ Получен JSON ответ');
      try {
        const json1 = JSON.parse(text1);
        console.log('   Данные:', JSON.stringify(json1, null, 2).substring(0, 300));
      } catch (e) {
        console.log('   ❌ Не удалось распарсить JSON:', text1.substring(0, 200));
      }
    }
    
    console.log('\n2. Проверяем доступные эндпоинты...');
    
    // Проверяем различные эндпоинты
    const endpoints = [
      '/sharing-systems',
      '/sharing-systems/stats',
      '/sharing-systems/available-slots',
      '/clients', // Этот должен работать для сравнения
      '/subscriptions'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`);
        console.log(`   ${endpoint}: ${response.status} ${response.statusText}`);
        
        if (response.status === 404) {
          console.log('   ❌ 404 - Эндпоинт не найден');
        } else if (response.status === 500) {
          const errorText = await response.text();
          console.log('   ❌ 500 - Ошибка сервера:', errorText.substring(0, 200));
        }
      } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log('❌ Общая ошибка:', error.message);
  }
}

// Запускаем тест
testEndpoints();