export function normalizePhoneDigits(value: string) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  } else if (!digits.startsWith('7')) {
    digits = `7${digits}`;
  }
  return digits.slice(0, 11);
}

export function formatPhoneInput(value: string) {
  const digits = normalizePhoneDigits(value);
  if (!digits) return '';

  const local = digits.slice(1);
  let result = '+7';

  if (local.length > 0) {
    result += ` (${local.slice(0, 3)}`;
    if (local.length >= 3) result += ')';
  }
  if (local.length > 3) result += ` ${local.slice(3, 6)}`;
  if (local.length > 6) result += `-${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;

  return result;
}

export function toApiPhone(value: string) {
  const digits = normalizePhoneDigits(value);
  if (digits.length === 11) return `+${digits}`;
  return String(value || '').trim();
}

export function isCompleteRussianPhone(value: string) {
  const digits = normalizePhoneDigits(value);
  return digits.length === 11 && digits.startsWith('7');
}

export function isValidRussianMobilePhone(value: string) {
  const digits = normalizePhoneDigits(value);
  return /^79\d{9}$/.test(digits);
}

export function getRussianMobilePhoneError(value: string) {
  const rawDigits = String(value || '').replace(/\D/g, '');
  const digits = normalizePhoneDigits(value);

  if (!rawDigits) {
    return 'Укажите номер телефона.';
  }
  if (rawDigits.length < 11) {
    return 'Введите полный номер телефона: 11 цифр в формате +7 (9XX) XXX-XX-XX.';
  }
  if (digits.length !== 11 || !digits.startsWith('7')) {
    return 'Введите номер в формате +7 (9XX) XXX-XX-XX.';
  }
  if (!/^79/.test(digits)) {
    return 'Укажите действующий мобильный номер в формате +7 (9XX) XXX-XX-XX.';
  }
  return null;
}
