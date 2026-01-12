/**
 * Форматирует номер телефона в формат +7(XXX)XXX-XX-XX
 */
export function formatPhoneNumber(value: string): string {
  // Убираем всё кроме цифр и +
  const digits = value.replace(/\D/g, '');
  
  if (!digits) return '';
  
  // Если начинается с 8, меняем на 7
  let normalized = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
  
  // Если нет 7 в начале, добавляем
  if (!normalized.startsWith('7')) {
    normalized = '7' + normalized;
  }
  
  // Ограничиваем до 11 цифр (7 + 10 цифр номера)
  normalized = normalized.slice(0, 11);
  
  // Форматируем: +7(XXX)XXX-XX-XX
  if (normalized.length === 11) {
    return `+${normalized[0]}(${normalized.slice(1, 4)})${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
  }
  
  // Промежуточное форматирование при вводе
  if (normalized.length > 7) {
    return `+${normalized[0]}(${normalized.slice(1, 4)})${normalized.slice(4, 7)}-${normalized.slice(7, 9)}${normalized.length > 9 ? '-' + normalized.slice(9) : ''}`;
  }
  
  if (normalized.length > 4) {
    return `+${normalized[0]}(${normalized.slice(1, 4)})${normalized.slice(4)}`;
  }
  
  if (normalized.length > 1) {
    return `+${normalized[0]}(${normalized.slice(1)}`;
  }
  
  return `+${normalized}`;
}

/**
 * Убирает маску и возвращает чистый номер в формате +7XXXXXXXXXX
 */
export function cleanPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  
  if (!digits) return '';
  
  let normalized = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
  
  if (!normalized.startsWith('7')) {
    normalized = '7' + normalized;
  }
  
  normalized = normalized.slice(0, 11);
  
  return '+' + normalized;
}

/**
 * Проверяет валидность номера телефона
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = cleanPhoneNumber(phone);
  return cleaned.length === 12 && cleaned.startsWith('+7'); // +7 + 10 цифр
}