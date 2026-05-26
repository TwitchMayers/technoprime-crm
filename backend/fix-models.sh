#!/bin/bash
set -euo pipefail

if [ "${ALLOW_DANGEROUS_SCRIPT:-}" != "true" ]; then
  echo "DANGEROUS LEGACY SCRIPT blocked. Set ALLOW_DANGEROUS_SCRIPT=true only for an audited local maintenance run." >&2
  exit 1
fi

echo "DANGEROUS LEGACY SCRIPT - DO NOT RUN IN PRODUCTION"

echo "Исправление имен моделей в коде..."

# Создаем резервную копию
backup_dir="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"
cp -r src "$backup_dir/"

# Исправляем имена моделей во всех .ts файлах
find src -name "*.ts" -type f -exec sed -i '' '
# Основные модели
s/techPrimeOrder/order/g
s/techPrimeClient/client/g
s/techPrimeProduct/product/g
s/techPrimeTask/task/g
s/techPrimeClientSlot/clientSlot/g
s/techPrimeOrderItem/orderItem/g
s/techPrimeOrderComment/orderComment/g

# Для include и where (с большой буквы)
s/TechPrimeClient/client/g
s/TechPrimeOrderItem/orderItem/g
s/TechPrimeClientId/clientId/g
' {} \;

echo "Замена завершена. Резервная копия в $backup_dir"
