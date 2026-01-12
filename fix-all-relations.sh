#!/bin/bash

echo "Исправление всех отношений..."

# Основные замены отношений
replacements=(
  # Для отношений в include
  "s/include: { donor: true }/include: { donorAccount: true }/g"
  "s/include: { donor: true,/include: { donorAccount: true,/g"
  "s/include: { client: true }/include: { client: true }/g"
  "s/include: { Client: true }/include: { client: true }/g"
  "s/include: { subscription: true }/include: { subscription: true }/g"
  "s/include: { subscriptions: true }/include: { subscriptions: true }/g"
  "s/include: { orders: true }/include: { orders: true }/g"
  "s/include: { order: true }/include: { order: true }/g"
  
  # Для обращений к полям
  "s/system\.donor\./system.donorAccount./g"
  "s/order\.donor\./order.donorAccount./g"
  "s/s\.donor\./s.donorAccount./g"
  
  # Для where
  "s/where\.client = /where.client = /g"
  "s/where\.Client = /where.client = /g"
  
  # Для полей в объектах
  "s/order\.client\./order.client./g"
  "s/order\.Client\./order.client./g"
  "s/system\.clientSlots\./system.clientSlots./g"
  "s/client\.orders\./client.orders./g"
  
  # Убираем старые имена
  "s/TechPrimeOrder/order/g"
  "s/TechPrimeClient/client/g"
  "s/TechPrimeProduct/product/g"
  "s/TechPrimeTask/task/g"
  "s/TechPrimeOrderItem/orderItem/g"
  "s/TechPrimeOrderComment/orderComment/g"
)

# Применяем замены ко всем файлам в src
for pattern in "${replacements[@]}"; do
  echo "Применяю: $pattern"
  find src -name "*.ts" -type f -exec sed -i '' "$pattern" {} \;
done

echo "Готово!"
