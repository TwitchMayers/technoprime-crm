const http = require('http');

const endpoints = [
  '/',
  '/api',
  '/api/test',
  '/api/clients',
  '/api/subscriptions',
  '/api/sharing-systems',
  '/api/sharing-systems/test'
];

console.log('🔍 Проверка маршрутов бэкенда...\n');

endpoints.forEach(endpoint => {
  const options = {
    hostname: 'localhost',
    port: 4000,
    path: endpoint,
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log(`${endpoint}: ${res.statusCode} ${res.statusMessage}`);
      if (data.length > 0) {
        try {
          const json = JSON.parse(data);
          console.log('   Response:', JSON.stringify(json).substring(0, 100));
        } catch {
          console.log('   Response:', data.substring(0, 100));
        }
      }
      console.log('');
    });
  });

  req.on('error', (error) => {
    console.log(`${endpoint}: ❌ Ошибка - ${error.message}`);
    console.log('');
  });

  req.end();
  
  // Задержка между запросами
  setTimeout(() => {}, 100);
});