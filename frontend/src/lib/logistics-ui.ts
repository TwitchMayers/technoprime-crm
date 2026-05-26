import {
  Box,
  Clock3,
  Link2,
  LucideIcon,
  PackageCheck,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';

export type MarketplacePlatformKey = 'AVITO' | 'OZON' | 'YANDEX_DELIVERY' | 'CDEK';

export type ShipmentCarrierKey =
  | 'AVITO_DELIVERY'
  | 'AVITO_CDEK'
  | 'AVITO_YANDEX'
  | 'AVITO_POST_RUSSIA'
  | 'CDEK_PERSONAL'
  | 'YANDEX_DELIVERY'
  | 'OZON_DELIVERY'
  | 'POST_RUSSIA'
  | 'OTHER';

export type ShipmentStatusKey =
  | 'AWAITING_SHIPMENT_DATA'
  | 'READY_FOR_HANDOVER'
  | 'HANDED_TO_CARRIER'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_PICKUP_POINT'
  | 'AWAITING_CUSTOMER_PICKUP'
  | 'RECEIVED_BY_CUSTOMER'
  | 'RETURN_IN_TRANSIT'
  | 'RETURNED_TO_SELLER'
  | 'DELIVERY_ISSUE'
  | 'CANCELED'
  | 'NOT_REQUIRED';

export type SettlementStatusKey =
  | 'NOT_REQUIRED'
  | 'AWAITING_PAYMENT'
  | 'PAID'
  | 'AWAITING_CUSTOMER_RECEIPT'
  | 'AWAITING_FUNDS_RECEIPT'
  | 'FUNDS_RECEIVED'
  | 'REFUND_PENDING'
  | 'REFUNDED'
  | 'CANCELED';

export type ProviderMeta = {
  platform: MarketplacePlatformKey;
  label: string;
  shortLabel: string;
  headline: string;
  description: string;
  capability: string;
  authModeLabel: string;
  statusCopy: string;
  accent: string;
  accentSoft: string;
  badgeClassName: string;
  icon: LucideIcon;
  formFields: Array<{
    key:
      | 'displayName'
      | 'externalAccountId'
      | 'clientId'
      | 'apiKey'
      | 'accessToken'
      | 'refreshToken'
      | 'scopes';
    label: string;
    placeholder: string;
    type?: 'text' | 'password';
    required?: boolean;
    helper?: string;
  }>;
};

export const providerMeta: Record<MarketplacePlatformKey, ProviderMeta> = {
  AVITO: {
    platform: 'AVITO',
    label: 'Avito',
    shortLabel: 'Avito',
    headline: 'Avito Доставка и заказы продавца',
    description:
      'Подключение аккаунта Avito для синхронизации заказов, штрихкодов, статусов передачи и получения.',
    capability: 'Автосинхронизация заказов и движения отправлений',
    authModeLabel: 'OAuth (Client ID + Client secret)',
    statusCopy:
      'CRM сохраняет Client ID и Client secret, после чего открывает OAuth-окно Avito и получает рабочий access token.',
    accent: 'from-cyan-500 via-sky-500 to-blue-600',
    accentSoft: 'from-cyan-500/10 via-sky-500/5 to-blue-600/10',
    badgeClassName: 'bg-cyan-500/15 text-cyan-100 border-cyan-400/35',
    icon: Link2,
    formFields: [
      {
        key: 'displayName',
        label: 'Название подключения',
        placeholder: 'Основной аккаунт Avito',
        required: true,
      },
      {
        key: 'externalAccountId',
        label: 'ID аккаунта / seller ID',
        placeholder: 'Например, seller_123456',
      },
      {
        key: 'clientId',
        label: 'Client ID',
        placeholder: 'ID приложения Avito',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'Client secret',
        placeholder: 'Секрет приложения Avito',
        type: 'password',
        required: true,
      },
      {
        key: 'scopes',
        label: 'Права доступа',
        placeholder: 'orders, messenger, stats',
        helper: 'Access token CRM получает автоматически после подключения по ключам приложения Avito.',
      },
    ],
  },
  OZON: {
    platform: 'OZON',
    label: 'Ozon',
    shortLabel: 'Ozon',
    headline: 'Кабинет продавца Ozon',
    description:
      'Подключение seller-кабинета Ozon для статусов отправлений, готовности к выдаче и внутренних posting-данных.',
    capability: 'Автосинхронизация по Seller API',
    authModeLabel: 'Client ID + API key',
    statusCopy: 'После подключения система забирает статусы постингов и фактическое движение выдачи.',
    accent: 'from-purple-500 via-fuchsia-500 to-pink-600',
    accentSoft: 'from-purple-500/10 via-fuchsia-500/5 to-pink-600/10',
    badgeClassName: 'bg-purple-500/15 text-purple-100 border-purple-400/35',
    icon: Sparkles,
    formFields: [
      {
        key: 'displayName',
        label: 'Название подключения',
        placeholder: 'Основной Ozon Seller',
        required: true,
      },
      {
        key: 'externalAccountId',
        label: 'Seller ID',
        placeholder: 'Внешний ID продавца',
      },
      {
        key: 'clientId',
        label: 'Client ID',
        placeholder: 'Client ID из кабинета Ozon',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API key',
        placeholder: 'Секретный ключ Ozon',
        type: 'password',
        required: true,
      },
    ],
  },
  YANDEX_DELIVERY: {
    platform: 'YANDEX_DELIVERY',
    label: 'Yandex Delivery',
    shortLabel: 'Yandex',
    headline: 'Яндекс Доставка',
    description:
      'Подключение интеграционного кабинета Яндекса для claim-статусов, ETA и движения заказа по доставке.',
    capability: 'Автосинхронизация ETA и статусов claim',
    authModeLabel: 'Токен интеграции',
    statusCopy: 'ETA и текущий этап подтягиваются после передачи заказа в службу доставки.',
    accent: 'from-amber-400 via-orange-500 to-red-500',
    accentSoft: 'from-amber-400/10 via-orange-500/5 to-red-500/10',
    badgeClassName: 'bg-amber-500/15 text-amber-100 border-amber-400/35',
    icon: Truck,
    formFields: [
      {
        key: 'displayName',
        label: 'Название подключения',
        placeholder: 'Основной кабинет Яндекс Доставки',
        required: true,
      },
      {
        key: 'externalAccountId',
        label: 'ID кабинета',
        placeholder: 'Идентификатор кабинета / компании',
      },
      {
        key: 'accessToken',
        label: 'Токен интеграции',
        placeholder: 'API token Яндекс Доставки',
        type: 'password',
        required: true,
      },
      {
        key: 'scopes',
        label: 'Права доступа',
        placeholder: 'claims.read, claims.write',
      },
    ],
  },
  CDEK: {
    platform: 'CDEK',
    label: 'CDEK',
    shortLabel: 'CDEK',
    headline: 'СДЭК / cdek id',
    description:
      'Подключение учётных данных СДЭК для отслеживания отправлений и последующего расширения синхронизации.',
    capability: 'Статусы отправления и трекинг по подключённому кабинету',
    authModeLabel: 'ID кабинета + токен/ключ',
    statusCopy: 'Система использует подключённый кабинет СДЭК для обновления статусов после передачи посылки.',
    accent: 'from-teal-400 via-cyan-500 to-sky-600',
    accentSoft: 'from-teal-400/10 via-cyan-500/5 to-sky-600/10',
    badgeClassName: 'bg-teal-500/15 text-teal-100 border-teal-400/35',
    icon: ShieldCheck,
    formFields: [
      {
        key: 'displayName',
        label: 'Название подключения',
        placeholder: 'Основной кабинет СДЭК',
        required: true,
      },
      {
        key: 'externalAccountId',
        label: 'CDEK ID / ID кабинета',
        placeholder: 'Идентификатор кабинета',
      },
      {
        key: 'clientId',
        label: 'Client ID / договор',
        placeholder: 'ID клиента или договора',
      },
      {
        key: 'accessToken',
        label: 'Токен доступа',
        placeholder: 'Токен или session key',
        type: 'password',
      },
      {
        key: 'apiKey',
        label: 'API key',
        placeholder: 'Ключ интеграции, если используется',
        type: 'password',
      },
    ],
  },
};

export const carrierLabels: Record<string, string> = {
  AVITO_DELIVERY: 'Avito Доставка',
  AVITO_CDEK: 'СДЭК через Avito',
  AVITO_YANDEX: 'Яндекс через Avito',
  AVITO_POST_RUSSIA: 'Почта через Avito',
  CDEK_PERSONAL: 'СДЭК',
  YANDEX_DELIVERY: 'Яндекс Доставка',
  OZON_DELIVERY: 'Ozon',
  POST_RUSSIA: 'Почта России',
  OTHER: 'Другая служба',
};

export const shipmentStatusLabels: Record<string, string> = {
  NOT_REQUIRED: 'Доставка не требуется',
  AWAITING_SHIPMENT_DATA: 'Ожидает данных отправки',
  READY_FOR_HANDOVER: 'Готов к передаче',
  HANDED_TO_CARRIER: 'Передан в службу',
  IN_TRANSIT: 'В пути',
  ARRIVED_AT_PICKUP_POINT: 'Прибыл в пункт выдачи',
  AWAITING_CUSTOMER_PICKUP: 'Ожидает получения',
  RECEIVED_BY_CUSTOMER: 'Получен клиентом',
  RETURN_IN_TRANSIT: 'Возврат в пути',
  RETURNED_TO_SELLER: 'Возвращён продавцу',
  DELIVERY_ISSUE: 'Проблема с доставкой',
  CANCELED: 'Доставка отменена',
};

export const settlementStatusLabels: Record<string, string> = {
  NOT_REQUIRED: 'Не требуется',
  AWAITING_PAYMENT: 'Ожидание оплаты',
  PAID: 'Оплачен',
  AWAITING_CUSTOMER_RECEIPT: 'Ожидание получения клиентом',
  AWAITING_FUNDS_RECEIPT: 'Ожидание поступления средств',
  FUNDS_RECEIVED: 'Средства поступили',
  REFUND_PENDING: 'Возврат средств',
  REFUNDED: 'Возвращено',
  CANCELED: 'Расчёт отменён',
};

export const marketplaceStatusLabels: Record<string, string> = {
  CONNECTED: 'Подключено',
  DISCONNECTED: 'Отключено',
  ERROR: 'Требует внимания',
};

export const marketplaceAuthLabels: Record<string, string> = {
  MANUAL: 'Ручной сценарий',
  OAUTH: 'Авторизация',
  API_KEY: 'API key',
};

export function shipmentPlatformFromCarrier(carrier?: string | null): MarketplacePlatformKey | null {
  switch (carrier) {
    case 'AVITO_DELIVERY':
    case 'AVITO_CDEK':
    case 'AVITO_YANDEX':
    case 'AVITO_POST_RUSSIA':
      return 'AVITO';
    case 'OZON_DELIVERY':
      return 'OZON';
    case 'YANDEX_DELIVERY':
      return 'YANDEX_DELIVERY';
    case 'CDEK_PERSONAL':
      return 'CDEK';
    default:
      return null;
  }
}

export function formatRuDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatRuDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shipmentStatusTone(status?: string | null) {
  if (status === 'DELIVERY_ISSUE' || status === 'CANCELED') {
    return 'bg-rose-500/15 text-rose-100 border-rose-400/35';
  }
  if (status === 'RETURN_IN_TRANSIT' || status === 'RETURNED_TO_SELLER') {
    return 'bg-amber-500/15 text-amber-100 border-amber-400/35';
  }
  if (status === 'RECEIVED_BY_CUSTOMER') {
    return 'bg-emerald-500/15 text-emerald-100 border-emerald-400/35';
  }
  return 'bg-cyan-500/15 text-cyan-100 border-cyan-400/35';
}

export function settlementTone(status?: string | null) {
  if (status === 'FUNDS_RECEIVED') {
    return 'bg-emerald-500/15 text-emerald-100 border-emerald-400/35';
  }
  if (status === 'CANCELED' || status === 'REFUNDED') {
    return 'bg-rose-500/15 text-rose-100 border-rose-400/35';
  }
  return 'bg-purple-500/15 text-purple-100 border-purple-400/35';
}

export function integrationHealthTone(status?: string | null, lastSyncError?: string | null) {
  if (lastSyncError || status === 'ERROR') {
    return 'bg-rose-500/15 text-rose-100 border-rose-400/35';
  }
  if (status === 'CONNECTED') {
    return 'bg-emerald-500/15 text-emerald-100 border-emerald-400/35';
  }
  return 'bg-slate-500/15 text-slate-200 border-slate-400/25';
}

export const logisticsKpis = [
  {
    key: 'handover',
    label: 'Ожидают передачи',
    icon: Box,
    gradient: 'from-cyan-500 to-sky-500',
  },
  {
    key: 'transit',
    label: 'В пути',
    icon: Truck,
    gradient: 'from-purple-500 to-fuchsia-500',
  },
  {
    key: 'pickup',
    label: 'Ожидают получения',
    icon: PackageCheck,
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    key: 'returns',
    label: 'Возвраты',
    icon: RotateCcw,
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    key: 'eta',
    label: 'ETA от служб',
    icon: Clock3,
    gradient: 'from-sky-500 to-blue-500',
  },
];
