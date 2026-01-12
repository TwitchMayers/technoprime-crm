#!/bin/bash

echo "Исправление всех старых имен моделей..."

# Список замен
replacements=(
  "s/techPrimeOrder/order/g"
  "s/techPrimeClient/client/g"
  "s/techPrimeProduct/product/g"
  "s/techPrimeTask/task/g"
  "s/techPrimeClientSlot/clientSlot/g"
  "s/techPrimeOrderItem/orderItem/g"
  "s/techPrimeOrderComment/orderComment/g"
  "s/TechPrimeClient/client/g"
  "s/TechPrimeOrderItem/orderItem/g"
  "s/TechPrimeClientId/clientId/g"
)

# Применяем ко всем .ts файлам
for pattern in "${replacements[@]}"; do
  echo "Применяю: $pattern"
  find src -name "*.ts" -type f -exec sed -i '' "$pattern" {} \;
done

echo "Готово!"
