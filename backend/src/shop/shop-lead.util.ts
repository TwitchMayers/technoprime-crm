export type ParsedShopLeadComment = {
  isShopLead: boolean;
  product: string | null;
  price: string | null;
  requestedPhone: string | null;
  city: string | null;
  address: string | null;
  comment: string | null;
  accountPhone: string | null;
  serialNumber: string | null;
};

type ShopLeadCommentInput = {
  product: string;
  price?: string | number | null;
  requestedPhone: string;
  city?: string | null;
  address?: string | null;
  comment?: string | null;
  accountPhone?: string | null;
  serialNumber?: string | null;
};

function normalizeText(value?: string | null) {
  const text = String(value || '').trim();
  return text || null;
}

export function formatShopLeadComment(input: ShopLeadCommentInput) {
  const price =
    input.price === null || input.price === undefined || input.price === ''
      ? null
      : String(input.price).trim();

  return [
    '[SHOP_LEAD]',
    `Товар: ${normalizeText(input.product) || '—'}`,
    price ? `Цена: ${price}` : null,
    `Телефон заявки: ${normalizeText(input.requestedPhone) || '—'}`,
    `Город: ${normalizeText(input.city) || '—'}`,
    `Адрес: ${normalizeText(input.address) || '—'}`,
    input.comment ? `Комментарий: ${normalizeText(input.comment)}` : null,
    input.serialNumber ? `Серийный номер: ${normalizeText(input.serialNumber)}` : null,
    input.accountPhone ? `Аккаунт магазина: ${normalizeText(input.accountPhone)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function parseShopLeadComment(comment?: string | null): ParsedShopLeadComment {
  const raw = String(comment || '');
  const lines = raw
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const read = (...prefixes: string[]) => {
    const line = lines.find(entry =>
      prefixes.some(prefix => entry.toLowerCase().startsWith(prefix.toLowerCase())),
    );
    if (!line) return null;
    const idx = line.indexOf(':');
    return idx >= 0 ? normalizeText(line.slice(idx + 1)) : null;
  };

  return {
    isShopLead: lines.some(line => line.includes('[SHOP_LEAD]')),
    product: read('Товар'),
    price: read('Цена'),
    requestedPhone: read('Телефон заявки', 'Телефон'),
    city: read('Город'),
    address: read('Адрес'),
    comment: read('Комментарий клиента', 'Комментарий'),
    accountPhone: read('Аккаунт магазина'),
    serialNumber: read('Серийный номер'),
  };
}

export function buildShopLeadTaskTitle(orderId: number, productName?: string | null) {
  const product = normalizeText(productName);
  return product ? `Предзаказ #${orderId} • ${product}` : `Предзаказ #${orderId}`;
}

export function buildShopLeadTaskComment(input: {
  clientName?: string | null;
  requestedPhone?: string | null;
  productName?: string | null;
  city?: string | null;
  address?: string | null;
  serialNumber?: string | null;
}) {
  return [
    normalizeText(input.clientName) || 'Клиент не указан',
    normalizeText(input.requestedPhone) || 'Телефон не указан',
    input.productName ? `Товар: ${input.productName}` : null,
    input.city ? `Город: ${normalizeText(input.city)}` : null,
    input.address ? `Адрес: ${normalizeText(input.address)}` : null,
    input.serialNumber ? `Серийный номер: ${normalizeText(input.serialNumber)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}
