#!/bin/bash
echo "🚀 ФИКСИМ ВСЕ ОШИБКИ ПРЯМО СЕЙЧАС!"

# 1. Удаляем старые типы Prisma
rm -rf node_modules/.prisma
rm -rf node_modules/@prisma/client

# 2. Генерируем новые типы
npx prisma generate

# 3. Исправляем ВСЕ include запросы
find src -name "*.ts" -type f -exec sed -i '' '
  # TechPrime модели (основные)
  s/include: { orders: true }/include: { TechPrimeOrder: true }/g;
  s/include: { order: true }/include: { TechPrimeOrder: true }/g;
  s/include: { clients: true }/include: { TechPrimeClient: true }/g;
  s/include: { client: true }/include: { TechPrimeClient: true }/g;
  s/include: { subscriptions: true }/include: { Subscription: true }/g;
  s/include: { subscription: true }/include: { Subscription: true }/g;
  s/include: { items: true }/include: { TechPrimeOrderItem: true }/g;
  s/include: { item: true }/include: { TechPrimeOrderItem: true }/g;
  s/include: { products: true }/include: { TechPrimeProduct: true }/g;
  s/include: { product: true }/include: { TechPrimeProduct: true }/g;
  s/include: { tasks: true }/include: { TechPrimeTask: true }/g;
  s/include: { task: true }/include: { TechPrimeTask: true }/g;
  
  # RichMarket модели
  s/include: { richMarketSoldProduct: true }/include: { rich_market_sold_products: true }/g;
  s/include: { sizes: true }/include: { RichMarketProductSize: true }/g;
  s/include: { size: true }/include: { RichMarketProductSize: true }/g;
  
  # Employee связи
  s/include: { assignedTo: true }/include: { Employee: true }/g;
  s/include: { author: true }/include: { Employee: true }/g;
  s/include: { employee: true }/include: { Employee: true }/g;
  
  # Comment связи
  s/include: { orderComment: true }/include: { TechPrimeOrderComment: true }/g;
  s/include: { comment: true }/include: { TechPrimeOrderComment: true }/g;
' {} \;

# 4. Исправляем ВСЕ обращения к свойствам
find src -name "*.ts" -type f -exec sed -i '' '
  # TechPrime обращения
  s/client\.orders/client\.TechPrimeOrder/g;
  s/client\.order/client\.TechPrimeOrder/g;
  s/client\.subscriptions/client\.Subscription/g;
  s/client\.subscription/client\.Subscription/g;
  s/order\.client/order\.TechPrimeClient/g;
  s/order\.items/order\.TechPrimeOrderItem/g;
  s/order\.item/order\.TechPrimeOrderItem/g;
  s/product\.orders/product\.TechPrimeOrder/g;
  
  # RichMarket обращения
  s/richMarketOrder\.client/richMarketOrder\.RichMarketClient/g;
  s/richMarketOrder\.items/richMarketOrder\.RichMarketOrderItem/g;
  s/richMarketProduct\.sizes/richMarketProduct\.RichMarketProductSize/g;
  
  # Employee обращения
  s/task\.assignedTo/task\.Employee/g;
  s/comment\.author/comment\.Employee/g;
  
  # Prisma вызовы моделей
  s/this\.prisma\.order/this\.prisma\.techPrimeOrder/g;
  s/this\.prisma\.client/this\.prisma\.techPrimeClient/g;
  s/this\.prisma\.product/this\.prisma\.techPrimeProduct/g;
  s/this\.prisma\.task/this\.prisma\.techPrimeTask/g;
  s/this\.prisma\.richMarketSoldProduct/this\.prisma\.rich_market_sold_products/g;
  
  # where условия
  s/where\.client/where\.TechPrimeClient/g;
  s/where\.order/where\.TechPrimeOrder/g;
  s/where\.product/where\.TechPrimeProduct/g;
  
  # select запросы
  s/select: { client:/select: { TechPrimeClient:/g;
  s/select: { order:/select: { TechPrimeOrder:/g;
  s/select: { product:/select: { TechPrimeProduct:/g;
' {} \;

# 5. Исправляем особые случаи
find src -name "*.ts" -type f -exec sed -i '' '
  # WHERE условия с точкой
  s/"client"/"TechPrimeClient"/g;
  s/"order"/"TechPrimeOrder"/g;
  s/"product"/"TechPrimeProduct"/g;
  s/"task"/"TechPrimeTask"/g;
  
  # RichMarket WHERE
  s/"richMarketOrder"/"RichMarketOrder"/g;
  s/"richMarketClient"/"RichMarketClient"/g;
  s/"richMarketProduct"/"RichMarketProduct"/g;
' {} \;

# 6. Исправляем файлы по одному для самых частых ошибок
# clients.service.ts
sed -i '' '
  s/if (client\.orders\.length/if (client\.TechPrimeOrder\.length/g;
  s/if (client\.subscriptions\.length/if (client\.Subscription\.length/g;
  s/\${client\.orders\.length}/\${client\.TechPrimeOrder\.length}/g;
  s/\${client\.subscriptions\.length}/\${client\.Subscription\.length}/g;
' src/clients/clients.service.ts

# orders.service.ts
sed -i '' '
  s/order\.client\./order\.TechPrimeClient\./g;
  s/\${order\.client/\${order\.TechPrimeClient/g;
  s/order\.items\./order\.TechPrimeOrderItem\./g;
  s/order\.clientId/order\.TechPrimeClientId/g;
' src/orders/orders.service.ts

# richmarket файлы
find src/richmarket -name "*.ts" -type f -exec sed -i '' '
  s/include: { client: true }/include: { RichMarketClient: true }/g;
  s/include: { order: true }/include: { RichMarketOrder: true }/g;
  s/include: { product: true }/include: { RichMarketProduct: true }/g;
  s/order\.client/order\.RichMarketClient/g;
  s/client\.orders/client\.RichMarketOrder/g;
' {} \;

echo "✅ ВСЕ ИСПРАВЛЕНО! Запускаем приложение..."