#!/bin/bash
set -euo pipefail

if [ "${ALLOW_DANGEROUS_SCRIPT:-}" != "true" ]; then
  echo "DANGEROUS LEGACY SCRIPT blocked. Set ALLOW_DANGEROUS_SCRIPT=true only for an audited local maintenance run." >&2
  exit 1
fi

echo "DANGEROUS LEGACY SCRIPT - DO NOT RUN IN PRODUCTION"

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
