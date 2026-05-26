export type ShopProduct = {
  id: number;
  name: string;
  slug?: string | null;
  category?: string | null;
  condition?: 'NEW' | 'USED';
  storeCategory?: string | null;
  storefrontCategory?: string | null;
  catalogMainKey?: string | null;
  catalogSubKey?: string | null;
  catalogFamilyKey?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  coverImage?: string | null;
  previewImage?: string | null;
  gallery?: unknown;
  variants?: Array<{
    key: string;
    label: string;
    memoryGb?: number | null;
    price: number;
    originalPrice?: number | null;
    promoPrice?: number | null;
    promoOldPrice?: number | null;
    promoEndsAt?: string | null;
    promoRemainingSec?: number;
    isPromo?: boolean;
    costPrice?: number | null;
    stock?: number;
    inStock?: boolean;
    isDefault?: boolean;
  }> | null;
  price: number | string;
  originalPrice?: number | string | null;
  promoPrice?: number | string | null;
  promoOldPrice?: number | string | null;
  promoEndsAt?: string | null;
  promoRemainingSec?: number;
  isPromo?: boolean;
  promoVariantKey?: string | null;
  promoVariantLabel?: string | null;
  costPrice?: number | string;
  stock?: number;
  brand?: string | null;
  model?: string | null;
  version?: string | null;
  isAlwaysAvailable?: boolean;
  inStock?: boolean | null;
  adSku?: string | null;
  viewCount?: number;
};

export type ShopFeatured = {
  id: number;
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  priceOverride?: string | null;
  promoBlock?: boolean;
  promoEnabled?: boolean;
  promoPrice?: string | null;
  promoOldPrice?: string | null;
  promoVariantKey?: string | null;
  promoVariantLabel?: string | null;
  promoEndsAt?: string | null;
  promoRemainingSec?: number;
  isPromo?: boolean;
  product?: {
    id: number;
    name: string;
    price: string;
    coverImage?: string | null;
    previewImage?: string | null;
    brand?: string | null;
    model?: string | null;
    version?: string | null;
  } | null;
  kit?: {
    id: number;
    name: string;
    tier?: string | null;
  } | null;
};

import { backendUrl, shopApiKey } from '@/lib/backend';

const backendOrigin = backendUrl.replace(/\/api\/?$/, '');
const shopOrigin = (
  process.env.NEXT_PUBLIC_SHOP_PUBLIC_URL ||
  process.env.SHOP_PUBLIC_URL ||
  'https://technoprimestore.ru'
).replace(/\/$/, '');

function isUnsafeLocalOrigin(value: string) {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.nip.io') ||
      host.endsWith('.lhr.life')
    );
  } catch {
    return false;
  }
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  // Public media is proxied by nginx through the same storefront domain.
  if (url.startsWith('/')) return `${shopOrigin}${url}`;
  if (isUnsafeLocalOrigin(backendOrigin)) {
    return `${shopOrigin}/${url.replace(/^\/+/, '')}`;
  }
  return `${backendOrigin}/${url.replace(/^\/+/, '')}`;
}

export function normalizeGallery(value: unknown, coverImage?: string | null): string[] {
  let list: string[] = [];

  if (Array.isArray(value)) {
    list = value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  } else if (typeof value === 'string') {
    const raw = value.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed
            .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            .map((item) => item.trim());
        } else {
          list = [raw];
        }
      } catch {
        list = [raw];
      }
    }
  }

  const withCover = coverImage && !list.includes(coverImage) ? [coverImage, ...list] : list;
  return Array.from(new Set(withCover.map((item) => resolveMediaUrl(item)).filter(Boolean))) as string[];
}

export type ShopProductsQuery = {
  q?: string;
  category?: string;
  storeCategory?: string;
  limit?: number;
};

function toQueryString(query?: ShopProductsQuery) {
  if (!query) return '';
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.category) params.set('category', query.category);
  if (query.storeCategory) params.set('storeCategory', query.storeCategory);
  if (query.limit) params.set('limit', String(query.limit));
  const raw = params.toString();
  return raw ? `?${raw}` : '';
}

export async function fetchShopProducts(query?: ShopProductsQuery): Promise<ShopProduct[]> {
  try {
    const res = await fetch(`${backendUrl}/shop/products${toQueryString(query)}`, {
      cache: 'no-store',
      headers: shopApiKey ? { 'x-shop-key': shopApiKey } : undefined,
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((item: ShopProduct) => ({
      ...item,
      coverImage: resolveMediaUrl(item.coverImage),
      previewImage: resolveMediaUrl(item.previewImage),
      gallery: normalizeGallery(item.gallery, item.coverImage),
    }));
  } catch {
    return [];
  }
}

export async function fetchTopViewedProducts(limit = 3, days = 30): Promise<ShopProduct[]> {
  try {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('days', String(days));

    const res = await fetch(`${backendUrl}/shop/products/top-viewed?${params.toString()}`, {
      cache: 'no-store',
      headers: shopApiKey ? { 'x-shop-key': shopApiKey } : undefined,
    });
    if (!res.ok) return [];

    const data = await res.json().catch(() => ({ items: [] }));
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((item: ShopProduct) => ({
      ...item,
      coverImage: resolveMediaUrl(item.coverImage),
      previewImage: resolveMediaUrl(item.previewImage),
      gallery: normalizeGallery(item.gallery, item.coverImage),
    }));
  } catch {
    return [];
  }
}

export async function trackShopProductView(payload: { productId: number; cookieId?: string | null }) {
  const res = await fetch('/api/shop/products/views', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ success: false }));
}

export async function fetchShopProductBySlug(slug: string): Promise<ShopProduct | null> {
  try {
    const res = await fetch(`${backendUrl}/shop/products/slug/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      headers: shopApiKey ? { 'x-shop-key': shopApiKey } : undefined,
    });
    if (!res.ok) return null;
    const item = (await res.json()) as ShopProduct;
    return {
      ...item,
      coverImage: resolveMediaUrl(item.coverImage),
      previewImage: resolveMediaUrl(item.previewImage),
      gallery: normalizeGallery(item.gallery, item.coverImage),
    };
  } catch {
    return null;
  }
}

export type ShopStoreCategory = {
  value: string;
  label: string;
  count?: number;
  isDefault?: boolean;
};

export async function fetchShopStoreCategories(): Promise<ShopStoreCategory[]> {
  try {
    const res = await fetch(`${backendUrl}/shop/products/store-categories`, {
      cache: 'no-store',
      headers: shopApiKey ? { 'x-shop-key': shopApiKey } : undefined,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export type ShopCheckoutPayload = {
  phone: string;
  name?: string;
  city?: string;
  address?: string;
  comment?: string;
  paymentMethod?: 'CASH' | 'TRANSFER' | 'TRADE_IN';
  items: { productId: number; qty: number; variantKey?: string | null }[];
};

export type ShopOrder = {
  id: number;
  status: string;
  source?: 'STORE' | 'MANUAL';
  salesChannel?: string | null;
  fulfillmentMethod?: string | null;
  settlementStatus?: string | null;
  shipment?: {
    id: number;
    carrier: string;
    status: string;
    receiverPoint?: string | null;
    expectedDeliveryAt?: string | null;
    handedOverAt?: string | null;
    arrivedAt?: string | null;
    receivedAt?: string | null;
    returnedAt?: string | null;
    customerNote?: string | null;
    events?: Array<{
      id: number;
      status: string;
      title: string;
      createdAt: string;
    }>;
  } | null;
  reserveUntil?: string | null;
  cancellationReason?: string | null;
  paymentState?: 'AWAITING_PAYMENT' | 'PAID' | 'CANCELED' | 'PROCESSING' | null;
  canResumePayment?: boolean;
  paymentUrl?: string | null;
  date: string;
  totalPrice: string;
  paymentMethod: string;
  manager?: { id: number; name: string } | null;
  items: {
    id: number;
    qty: number;
    lineTotal: string;
    variantKey?: string | null;
    variantLabel?: string | null;
    serialNumber?: string | null;
    product?: { id: number; name: string; slug?: string | null; coverImage?: string | null } | null;
  }[];
};

export async function submitCheckout(payload: ShopCheckoutPayload) {
  const res = await fetch('/api/shop/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchMyOrders(): Promise<ShopOrder[]> {
  const res = await fetch('/api/shop/orders', { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.items) ? data.items : [];
}

export async function fetchMyOrder(orderId: number): Promise<ShopOrder | null> {
  const res = await fetch(`/api/shop/orders/${orderId}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  return data && typeof data === 'object' ? (data as ShopOrder) : null;
}

export async function claimOrderLink(token: string) {
  const res = await fetch('/api/shop/orders/link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  const data = await res.json().catch(() => ({ success: false, message: 'Не удалось привязать заказ.' }));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Не удалось привязать заказ.');
  }
  return data;
}

export async function submitLeaveLead(payload: {
  productId: number;
  phone: string;
  name?: string;
  city?: string;
  address?: string;
  comment?: string;
}) {
  const res = await fetch('/api/shop/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ success: false, message: 'Не удалось обработать заявку.' }));
  if (!res.ok) {
    throw new Error(data?.message || 'Не удалось отправить заявку.');
  }
  return data;
}

export async function fetchShopFeatured(): Promise<ShopFeatured[]> {
  try {
    const res = await fetch(`${backendUrl}/shop/featured`, {
      cache: 'no-store',
      headers: shopApiKey ? { 'x-shop-key': shopApiKey } : undefined,
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    return items.map((item: ShopFeatured) => ({
      ...item,
      product: item.product
        ? {
            ...item.product,
            coverImage: resolveMediaUrl(item.product.coverImage),
            previewImage: resolveMediaUrl(item.product.previewImage),
          }
        : null,
    }));
  } catch {
    return [];
  }
}

export type ShopAccountUser = {
  id: number;
  phone?: string | null;
  telegramId?: string | null;
  vkId?: string | null;
  maxId?: string | null;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  deliveryCity?: string | null;
  deliveryAddress?: string | null;
  notifyOrderStatus?: boolean;
  notifySubscription?: boolean;
  notifyService?: boolean;
  notifyMarketing?: boolean;
  marketingConsent?: boolean;
  cookieConsentAt?: string | null;
  cookieConsentVersion?: string | null;
  cookieConsentAnalytics?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
};

export type ShopLinkedAccounts = {
  telegram: {
    connected: boolean;
    username?: string | null;
  };
  vk: {
    connected: boolean;
    id?: string | null;
    comingSoon?: boolean;
  };
};

export type ShopSubscriptionOverview = {
  id: number;
  type: string;
  typeLabel: string;
  status: string;
  accountType: string;
  accountTypeLabel: string;
  subscriptionPeriod: string;
  subscriptionPeriodLabel: string;
  consoleType?: string | null;
  startDate: string;
  endDate: string;
  emailLogin?: string | null;
  emailPassword?: string | null;
  accountPassword?: string | null;
  accessGroups?: Array<{
    title: string;
    fields: Array<{
      label: string;
      value: string;
    }>;
  }>;
  daysLeft: number;
  isActive: boolean;
  canRenew: boolean;
};

export type ShopAccountOverview = {
  user: ShopAccountUser;
  linkedAccounts: ShopLinkedAccounts;
  stats: {
    storeOrdersCount: number;
    subscriptionsCount: number;
    activeSubscriptionsCount: number;
    nextSubscriptionExpireAt?: string | null;
  };
  subscriptions: ShopSubscriptionOverview[];
};

export type ShopInstructionSection = {
  key: string;
  title: string;
  content: string;
  sortOrder?: number;
};

export type ShopInstruction = {
  id: number;
  consoleKey: string;
  consoleLabel: string;
  title: string;
  subtitle?: string | null;
  searchAliases?: string[];
  sections: ShopInstructionSection[];
};

export type ShopAccountInstructionsPayload = {
  items: ShopInstruction[];
  total: number;
};

export type ShopConsultationHistoryItem = {
  id: string;
  direction: 'CUSTOMER' | 'MANAGER' | 'SYSTEM';
  source: 'CHAT' | 'LEAD' | 'CRM' | 'SYSTEM';
  title?: string;
  text: string;
  sentAt: string;
  channel?: 'WEBSITE' | 'TELEGRAM' | 'VK';
  status?: 'SENT' | 'FAILED';
  errorMessage?: string | null;
  createdBy?: { id: number; name: string } | null;
  attachments?: Array<{
    fileName: string;
    mimeType?: string | null;
    size?: number | null;
  }>;
};

export type ShopConsultationHistoryPayload = {
  items: ShopConsultationHistoryItem[];
  conversation?: {
    status: 'OPEN' | 'CLOSED';
    queueState?: 'WAITING_MANAGER' | 'WAITING_CUSTOMER';
    slaMinutes?: number;
  };
};

export async function fetchAccountOverview(): Promise<ShopAccountOverview | null> {
  const res = await fetch('/api/account/overview', { cache: 'no-store' });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.user) return null;
  return data as ShopAccountOverview;
}

export async function fetchAccountInstructions(): Promise<ShopAccountInstructionsPayload> {
  const res = await fetch('/api/account/instructions', { cache: 'no-store' });
  if (!res.ok) {
    return { items: [], total: 0 };
  }
  const data = await res.json().catch(() => ({ items: [], total: 0 })) as ShopAccountInstructionsPayload;
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    total: Number(data?.total || 0),
  };
}

export async function updateAccountProfile(payload: {
  firstName?: string | null;
  lastName?: string | null;
  birthDate?: string | null;
  deliveryCity?: string | null;
  deliveryAddress?: string | null;
  notifyOrderStatus?: boolean;
  notifySubscription?: boolean;
  notifyService?: boolean;
  notifyMarketing?: boolean;
  marketingConsent?: boolean;
}) {
  const res = await fetch('/api/account/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function unlinkTelegramAccount() {
  const res = await fetch('/api/account/linked/telegram/unlink', {
    method: 'POST',
  });
  return res.json();
}

export async function unlinkVkAccount() {
  const res = await fetch('/api/account/linked/vk/unlink', {
    method: 'POST',
  });
  return res.json();
}

export async function createVkLinkCode() {
  const res = await fetch('/api/account/linked/vk/code', {
    method: 'POST',
  });
  return res.json();
}

export async function saveCookieConsent(payload: { analytics: boolean; version?: string }) {
  const res = await fetch('/api/account/cookie-consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function logoutAllSessions() {
  const res = await fetch('/api/auth/logout-all', { method: 'POST' });
  return res.json();
}

export async function fetchConsultationHistory(): Promise<ShopConsultationHistoryPayload> {
  const res = await fetch('/api/account/consultation/history', { cache: 'no-store' });
  if (!res.ok) {
    return { items: [] };
  }
  const data = await res.json().catch(() => ({ items: [] })) as ShopConsultationHistoryPayload;
  return {
    items: Array.isArray(data?.items) ? (data.items as ShopConsultationHistoryItem[]) : [],
    conversation: data?.conversation,
  };
}

export async function sendConsultationMessage(payload: { text: string }) {
  const res = await fetch('/api/account/consultation/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
