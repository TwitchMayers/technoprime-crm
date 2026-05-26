import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  FulfillmentMethod,
  InventoryUnitStatus,
  MarketplaceAccountStatus,
  MarketplaceAuthType,
  MarketplacePlatform,
  OrderStatus,
  OrderSource,
  PaymentMethod,
  Prisma,
  Role,
  SalesChannel,
  SettlementStatus,
  ShipmentCarrier,
  ShipmentStatus,
  ShipmentSyncMode,
  TaskStatus,
  TaskType,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { EventsService } from '../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';

type Actor = {
  id?: number;
  role?: Role | string;
};

type AvitoOAuthStatePayload = {
  accountId: number;
  actorId: number;
  redirectTo: string;
  iat: number;
  nonce: string;
};

type AvitoRemoteOrder = {
  id?: string;
  marketplaceId?: string | null;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: Array<{
    title?: string;
    count?: number;
  }>;
  prices?: {
    commission?: number;
    delivery?: number;
    discount?: number;
    price?: number;
    total?: number;
  } | null;
  delivery?: {
    serviceName?: string;
    serviceType?: string;
    dispatchNumber?: string;
    trackingNumber?: string;
    terminalInfo?: {
      address?: string | null;
      code?: string | null;
    } | null;
    buyerInfo?: {
      fullName?: string | null;
      phoneNumber?: string | null;
    } | null;
  } | null;
  schedules?: {
    deliveryDate?: string | null;
    deliveryDateMaх?: string | null;
    deliveryDateMax?: string | null;
    deliveryDateMin?: string | null;
    shipTill?: string | null;
  } | null;
};

function avitoServiceTitle(value: unknown) {
  const labels: Record<string, string> = {
    bbip: 'Пакет продвижения',
    xl: 'XL-размещение',
    xxl: 'XXL-размещение',
    x10_1: 'Поднятие x10',
    x5_1: 'Поднятие x5',
    x2_1: 'Поднятие x2',
    vip: 'VIP-размещение',
    premium: 'Премиум-размещение',
    turbo_sale: 'Турбо-продажа',
  };
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    const code = String(
      candidate.vas_id ||
        candidate.vasId ||
        candidate.service_id ||
        candidate.serviceId ||
        candidate.slug ||
        candidate.code ||
        '',
    )
      .trim()
      .toLowerCase();
    return String(
      candidate.title ||
        candidate.type ||
        candidate.serviceType ||
        (code ? labels[code] || `Услуга ${code}` : null) ||
        'Продвижение',
    );
  }
  return 'Продвижение';
}

type AvitoRemoteChat = {
  id?: string;
  created?: number;
  updated?: number;
  unread_count?: number;
  users?: Array<{
    id?: number | string;
    name?: string | null;
    public_user_profile?: {
      avatar?: {
        default?: string | null;
        images?: Record<string, string>;
      } | null;
    } | null;
  }>;
  context?: {
    type?: string;
    value?: {
      id?: number | string;
      title?: string | null;
      price_string?: string | null;
      url?: string | null;
      user_id?: number | string | null;
      images?: {
        count?: number;
        main?: Record<string, string>;
      } | null;
    } | null;
  } | null;
  last_message?: {
    id?: string;
    type?: string;
    created?: number;
    direction?: 'in' | 'out' | string;
    author_id?: number | string | null;
    content?: Record<string, any> | null;
  } | null;
};

type AvitoRemoteMessage = {
  id?: string;
  type?: string;
  created?: number;
  direction?: 'in' | 'out' | string;
  author_id?: number | string | null;
  is_read?: boolean;
  read?: number | null;
  content?: Record<string, any> | null;
  quote?: {
    id?: string;
    type?: string;
    author_id?: number | string | null;
    created?: number;
    content?: Record<string, any> | null;
  } | null;
};

type AvitoAnalyticsDailyMetric = {
  date: string;
  uniqViews: number;
  uniqFavorites: number;
  uniqContacts: number;
  payload: Record<string, any> | null;
};

type AvitoAnalyticsListing = {
  externalItemId: string;
  title: string;
  url?: string | null;
  priceLabel?: string | null;
  statusLabel?: string | null;
  services?: any[] | null;
  startAt?: string | null;
  finishAt?: string | null;
  payload?: Record<string, any> | null;
  dailyMetrics: AvitoAnalyticsDailyMetric[];
};

type AvitoLearningExample = {
  chatId: string;
  messageExternalId: string;
  itemExternalId?: string | null;
  itemTitle?: string | null;
  priceLabel?: string | null;
  counterpartName?: string | null;
  direction: string;
  messageType?: string | null;
  text?: string | null;
  hasImage: boolean;
  messageAt: string;
  payload?: Record<string, any> | null;
};

type AvitoBalanceOperation = {
  operationKey: string;
  paidAt: string;
  itemExternalId?: string | null;
  operationName?: string | null;
  operationType?: string | null;
  serviceId?: number | null;
  serviceName?: string | null;
  serviceType?: string | null;
  amountRub: number;
  amountBonus: number;
  amountTotal: number;
  payload?: Record<string, any> | null;
};

type ExternalTrackingStatusBucket =
  | 'CREATED'
  | 'IN_TRANSIT'
  | 'AT_PICKUP'
  | 'DELIVERED'
  | 'RETURNED'
  | 'ISSUE'
  | 'UNKNOWN';

type ExternalTrackingEvent = {
  at: string;
  status: string;
  location: string | null;
  details: string | null;
};

type ExternalTrackingSnapshot = {
  provider: 'TRACKTRY' | 'HEURISTIC';
  reference: string;
  carrierCode?: string | null;
  carrierName?: string | null;
  statusCode?: string | null;
  statusLabel?: string | null;
  statusBucket: ExternalTrackingStatusBucket;
  senderPoint?: string | null;
  receiverPoint?: string | null;
  expectedDeliveryAt?: string | null;
  events: ExternalTrackingEvent[];
};

@Injectable()
export class LogisticsService {
  private readonly logger = new Logger(LogisticsService.name);
  private readonly avitoPinnedChatsLimit = 3;
  private readonly avitoAccountListCacheTtlMs = 30_000;
  private readonly avitoChatsCacheTtlMs = 10_000;
  private readonly avitoMessagesCacheTtlMs = 6_000;
  private readonly externalTrackingCacheTtlMs = 90_000;
  private readonly avitoRequestCache = new Map<
    string,
    { expiresAt: number; value?: any; promise?: Promise<any> }
  >();
  private readonly externalTrackingCache = new Map<
    string,
    {
      expiresAt: number;
      value?: ExternalTrackingSnapshot | null;
      promise?: Promise<ExternalTrackingSnapshot | null>;
    }
  >();
  private avitoShipmentSyncRunning = false;
  private externalTrackingSyncRunning = false;
  private readonly avitoLiveKnownChats = new Map<string, string>();
  private readonly avitoLiveLoggedMessageKeys = new Map<string, number>();
  private avitoLivePollRunning = false;
  private avitoLivePrimed = false;

  constructor(
    private prisma: PrismaService,
    private inventory: InventoryService,
    private events: EventsService,
    private notifications: NotificationsService,
  ) {}

  private getCachedAvitoValue<T>(key: string) {
    const cached = this.avitoRequestCache.get(key);
    if (cached?.value !== undefined && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    return null;
  }

  private getCachedAvitoPromise<T>(key: string) {
    const cached = this.avitoRequestCache.get(key);
    return (cached?.promise || null) as Promise<T> | null;
  }

  private setCachedAvitoValue(key: string, ttlMs: number, value: any) {
    this.avitoRequestCache.set(key, {
      expiresAt: Date.now() + ttlMs,
      value,
    });
  }

  private setCachedAvitoPromise<T>(key: string, promise: Promise<T>) {
    this.avitoRequestCache.set(key, {
      expiresAt: 0,
      promise,
    });
  }

  private invalidateAvitoCache(prefix: string) {
    for (const key of this.avitoRequestCache.keys()) {
      if (key.startsWith(prefix)) {
        this.avitoRequestCache.delete(key);
      }
    }
  }

  private text(value?: string | null) {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private date(value?: string | Date | null) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private money(value: any) {
    if (value === undefined || value === null || value === '') return undefined;
    const number = Number(value);
    if (!Number.isFinite(number)) return undefined;
    return new Prisma.Decimal(number.toFixed(2));
  }

  private moneyOrZero(value: any) {
    return this.money(value) || new Prisma.Decimal('0.00');
  }

  private enumValue<T extends Record<string, string>>(
    enumObject: T,
    value: any,
    fallback: T[keyof T],
  ): T[keyof T] {
    const key = String(value || '').toUpperCase();
    return (enumObject as unknown as Record<string, T[keyof T]>)[key] || fallback;
  }

  private safeOrderId(value: any) {
    const orderId = Number(value);
    if (!Number.isFinite(orderId) || orderId <= 0) {
      throw new BadRequestException('Некорректный номер заказа');
    }
    return orderId;
  }

  private customerShipment(shipment: any) {
    if (!shipment) return null;
    return {
      id: shipment.id,
      carrier: shipment.carrier,
      status: shipment.status,
      receiverPoint: shipment.receiverPoint,
      expectedDeliveryAt: shipment.expectedDeliveryAt,
      handedOverAt: shipment.handedOverAt,
      arrivedAt: shipment.arrivedAt,
      receivedAt: shipment.receivedAt,
      returnedAt: shipment.returnedAt,
      customerNote: shipment.customerNote,
      events: (shipment.events || []).map((event: any) => ({
        id: event.id,
        status: event.status,
        title: event.title,
        createdAt: event.createdAt,
      })),
    };
  }

  mapShipmentForCustomer(shipment: any) {
    return this.customerShipment(shipment);
  }

  private normalizePhone(input?: string | null) {
    const digits = String(input || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
    return digits.length >= 11 ? digits.slice(-11) : digits;
  }

  private buildPhoneVariants(phone?: string | null) {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return [] as string[];
    const last10 = normalized.slice(-10);
    return Array.from(new Set([normalized, `+${normalized}`, last10, `7${last10}`, `+7${last10}`]));
  }

  private normalizeTrackingReference(value?: string | null) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();
  }

  private getExternalTrackingCache(key: string) {
    const cached = this.externalTrackingCache.get(key);
    if (!cached) return undefined;
    if (cached.value !== undefined && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    return undefined;
  }

  private getExternalTrackingPending(key: string) {
    const cached = this.externalTrackingCache.get(key);
    return cached?.promise || null;
  }

  private setExternalTrackingCacheValue(
    key: string,
    value: ExternalTrackingSnapshot | null,
    ttlMs = this.externalTrackingCacheTtlMs,
  ) {
    this.externalTrackingCache.set(key, {
      expiresAt: Date.now() + ttlMs,
      value,
    });
  }

  private setExternalTrackingPending(
    key: string,
    promise: Promise<ExternalTrackingSnapshot | null>,
  ) {
    this.externalTrackingCache.set(key, {
      expiresAt: 0,
      promise,
    });
  }

  private tracktryApiKey() {
    return this.text(
      process.env.TRACKTRY_API_KEY ||
        process.env.EXTERNAL_TRACKING_API_KEY ||
        process.env.TRACKING_API_KEY,
    );
  }

  private tracktryBaseUrl() {
    return String(process.env.TRACKTRY_BASE_URL || 'https://api.tracktry.com')
      .trim()
      .replace(/\/+$/, '');
  }

  private normalizeTracktryPayload(payload: any) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.data !== undefined) return payload.data;
    if (payload.result !== undefined) return payload.result;
    if (payload.results !== undefined) return payload.results;
    return payload;
  }

  private asArray<T = any>(value: any): T[] {
    if (Array.isArray(value)) return value as T[];
    if (!value) return [];
    if (Array.isArray(value?.items)) return value.items as T[];
    if (Array.isArray(value?.data)) return value.data as T[];
    return [value as T];
  }

  private mapExternalStatusBucket(
    statusCode?: string | null,
    statusLabel?: string | null,
  ): ExternalTrackingStatusBucket {
    const normalized = `${String(statusCode || '')
      .trim()
      .toLowerCase()} ${String(statusLabel || '')
      .trim()
      .toLowerCase()}`;

    if (!normalized.trim()) return 'UNKNOWN';

    if (/(delivered|signed|received|вручен|доставлен|получен|success delivery)/.test(normalized)) {
      return 'DELIVERED';
    }
    if (
      /(pickup|ready for pickup|awaiting pickup|пвз|пункт выдачи|ожидает выдачи|в пункте выдачи)/.test(
        normalized,
      )
    ) {
      return 'AT_PICKUP';
    }
    if (/(return|returned|возврат|возвращен|возвращён)/.test(normalized)) {
      return 'RETURNED';
    }
    if (
      /(exception|failed|undelivered|problem|issue|lost|hold|blocked|ошибка|проблем|задерж|неудач|утер)/.test(
        normalized,
      )
    ) {
      return 'ISSUE';
    }
    if (
      /(transit|in transit|moving|linehaul|depart|arriv|в пути|покинул|прибыл|перевозк|транспортировк|sorting)/.test(
        normalized,
      )
    ) {
      return 'IN_TRANSIT';
    }
    if (
      /(pending|created|manifest|registered|accepted|принят|создан|оформлен|зарегистрирован)/.test(
        normalized,
      )
    ) {
      return 'CREATED';
    }

    return 'UNKNOWN';
  }

  private mapExternalBucketToShipmentStatus(bucket: ExternalTrackingStatusBucket): ShipmentStatus {
    switch (bucket) {
      case 'CREATED':
        return ShipmentStatus.READY_FOR_HANDOVER;
      case 'IN_TRANSIT':
        return ShipmentStatus.IN_TRANSIT;
      case 'AT_PICKUP':
        return ShipmentStatus.AWAITING_CUSTOMER_PICKUP;
      case 'DELIVERED':
        return ShipmentStatus.RECEIVED_BY_CUSTOMER;
      case 'RETURNED':
        return ShipmentStatus.RETURNED_TO_SELLER;
      case 'ISSUE':
        return ShipmentStatus.DELIVERY_ISSUE;
      default:
        return ShipmentStatus.AWAITING_SHIPMENT_DATA;
    }
  }

  private mapCarrierHintToShipmentCarrier(
    carrierCode?: string | null,
    carrierName?: string | null,
    hint?: string | null,
  ): ShipmentCarrier | null {
    const normalized = `${String(carrierCode || '').toLowerCase()} ${String(
      carrierName || '',
    ).toLowerCase()} ${String(hint || '').toLowerCase()}`;
    const avitoHint = /avito/.test(normalized);

    if (/cdek|сдэк/.test(normalized)) {
      return avitoHint ? ShipmentCarrier.AVITO_CDEK : ShipmentCarrier.CDEK_PERSONAL;
    }
    if (/yandex|яндекс/.test(normalized)) {
      return avitoHint ? ShipmentCarrier.AVITO_YANDEX : ShipmentCarrier.YANDEX_DELIVERY;
    }
    if (/ozon|озон/.test(normalized)) {
      return ShipmentCarrier.OZON_DELIVERY;
    }
    if (/post|почта|russian post|pochta|почты россии|почта россии/.test(normalized)) {
      return avitoHint ? ShipmentCarrier.AVITO_POST_RUSSIA : ShipmentCarrier.POST_RUSSIA;
    }
    if (/avito/.test(normalized)) {
      return ShipmentCarrier.AVITO_DELIVERY;
    }

    return null;
  }

  private detectTrackingCarrierHeuristic(reference: string) {
    const value = this.normalizeTrackingReference(reference);

    if (!value) return null;
    if (/^AVITO[-_A-Z0-9]+$/.test(value)) return { code: 'avito', label: 'Avito Delivery' };
    if (/^(YA|YANDEX|YD)[-_A-Z0-9]+$/.test(value))
      return { code: 'yandex', label: 'Yandex Delivery' };
    if (/^(OZ|OZN|OZON)[-_A-Z0-9]+$/.test(value)) return { code: 'ozon', label: 'Ozon Delivery' };
    if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(value))
      return { code: 'russian_post', label: 'Почта России' };
    if (/^\d{10,16}$/.test(value)) return { code: 'cdek', label: 'CDEK' };

    return null;
  }

  private buildHeuristicTracking(
    reference: string,
    hint?: string | null,
  ): ExternalTrackingSnapshot | null {
    const detected = this.detectTrackingCarrierHeuristic(reference);
    if (!detected) return null;
    return {
      provider: 'HEURISTIC',
      reference,
      carrierCode: detected.code,
      carrierName: detected.label,
      statusCode: null,
      statusLabel: 'Статус НУЖНО ПОДТВЕРДИТЬ у службы доставки',
      statusBucket: 'UNKNOWN',
      senderPoint: null,
      receiverPoint: null,
      expectedDeliveryAt: null,
      events: hint
        ? [
            {
              at: new Date().toISOString(),
              status: `Подсказка: ${hint}`,
              location: null,
              details: null,
            },
          ]
        : [],
    };
  }

  private async fetchTracktryJson(path: string, body: Record<string, any>, apiKey: string) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`${this.tracktryBaseUrl()}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Tracktry-Api-Key': apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          this.text(payload?.message) ||
            this.text(payload?.error) ||
            `Tracktry HTTP ${response.status}`,
        );
      }

      if (payload?.meta?.code && Number(payload.meta.code) !== 200) {
        throw new Error(
          this.text(payload?.meta?.message) || `Tracktry error ${payload?.meta?.code}`,
        );
      }

      return payload;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async resolveTracktryTracking(
    reference: string,
  ): Promise<ExternalTrackingSnapshot | null> {
    const apiKey = this.tracktryApiKey();
    if (!apiKey) return null;

    const detectPayload = await this.fetchTracktryJson(
      '/v1/carriers/detect',
      {
        tracking_number: reference,
      },
      apiKey,
    );

    const detectData = this.normalizeTracktryPayload(detectPayload);
    const carriers = this.asArray<any>(detectData);
    const detectedCarrier = carriers[0] || null;
    const carrierCode = this.text(
      detectedCarrier?.courier_code || detectedCarrier?.code || detectedCarrier?.slug,
    );
    const carrierName = this.text(
      detectedCarrier?.courier_name || detectedCarrier?.name || detectedCarrier?.title,
    );

    const realtimePayload = await this.fetchTracktryJson(
      '/v1/trackings/realtime',
      {
        tracking_number: reference,
        ...(carrierCode ? { courier_code: carrierCode } : {}),
      },
      apiKey,
    );

    const realtimeData = this.normalizeTracktryPayload(realtimePayload);
    const realtimeItem =
      this.asArray<any>(realtimeData)[0] ||
      realtimeData?.tracking ||
      realtimeData?.shipment ||
      realtimeData;

    if (!realtimeItem || typeof realtimeItem !== 'object') {
      return null;
    }

    const rawStatusCode = this.text(
      realtimeItem?.status ||
        realtimeItem?.status_code ||
        realtimeItem?.track_status ||
        realtimeItem?.delivery_status,
    );
    const rawStatusLabel = this.text(
      realtimeItem?.status_description ||
        realtimeItem?.status_label ||
        realtimeItem?.status_text ||
        realtimeItem?.track_info,
    );

    const checkpoints = this.asArray<any>(
      realtimeItem?.origin_info?.trackinfo ||
        realtimeItem?.trackinfo ||
        realtimeItem?.events ||
        realtimeItem?.checkpoints,
    );

    const events: ExternalTrackingEvent[] = checkpoints
      .map(event => {
        const at =
          this.date(
            event?.checkpoint_time ||
              event?.time ||
              event?.date ||
              event?.status_time ||
              event?.Date,
          )?.toISOString() || null;
        const status =
          this.text(
            event?.status_description ||
              event?.status ||
              event?.state ||
              event?.StatusDescription ||
              event?.checkpoint_status,
          ) || '';

        if (!at || !status) return null;
        return {
          at,
          status,
          location: this.text(
            event?.location || event?.city || event?.checkpoint_location || event?.Details,
          ),
          details: this.text(event?.details || event?.context),
        };
      })
      .filter((event): event is ExternalTrackingEvent => Boolean(event))
      .slice(0, 30);

    const statusCode = rawStatusCode || this.text(checkpoints[0]?.status) || null;
    const statusLabel =
      rawStatusLabel ||
      this.text(checkpoints[0]?.status_description || checkpoints[0]?.state) ||
      null;

    const statusBucket = this.mapExternalStatusBucket(statusCode, statusLabel);
    const senderPoint = this.text(
      realtimeItem?.origin_info?.from || realtimeItem?.sender || realtimeItem?.from,
    );
    const receiverPoint = this.text(
      realtimeItem?.origin_info?.to || realtimeItem?.recipient || realtimeItem?.destination,
    );
    const expectedDeliveryAt =
      this.date(
        realtimeItem?.scheduled_delivery_date ||
          realtimeItem?.expected_delivery ||
          realtimeItem?.estimated_delivery_date,
      )?.toISOString() || null;

    if (!carrierCode && !carrierName && statusBucket === 'UNKNOWN' && !events.length) {
      return null;
    }

    return {
      provider: 'TRACKTRY',
      reference,
      carrierCode,
      carrierName,
      statusCode,
      statusLabel,
      statusBucket,
      senderPoint,
      receiverPoint,
      expectedDeliveryAt,
      events,
    };
  }

  private async resolveExternalTracking(reference: string, hint?: string | null) {
    const normalized = this.normalizeTrackingReference(reference);
    if (!normalized || normalized.length < 6) return null;

    const cacheKey = `tracking:${normalized}:${String(hint || '').toLowerCase()}`;
    const cached = this.getExternalTrackingCache(cacheKey);
    if (cached !== undefined) return cached;

    const pending = this.getExternalTrackingPending(cacheKey);
    if (pending) return pending;

    const request = (async () => {
      try {
        const fromProvider = await this.resolveTracktryTracking(normalized).catch((error: any) => {
          this.logger.warn(
            `External tracking lookup failed for ${normalized}: ${String(error?.message || error)}`,
          );
          return null;
        });

        if (fromProvider) {
          this.setExternalTrackingCacheValue(cacheKey, fromProvider);
          return fromProvider;
        }

        const heuristic = this.buildHeuristicTracking(normalized, hint);
        this.setExternalTrackingCacheValue(cacheKey, heuristic);
        return heuristic;
      } catch (error) {
        this.externalTrackingCache.delete(cacheKey);
        throw error;
      }
    })();

    this.setExternalTrackingPending(cacheKey, request);
    return request;
  }

  private secretKey() {
    const raw = String(
      process.env.MARKETPLACE_SECRET ||
        process.env.DATA_ENCRYPTION_KEY ||
        process.env.JWT_SECRET ||
        '',
    );
    if (!raw.trim()) return null;
    return crypto.createHash('sha256').update(raw).digest();
  }

  private encryptSecret(value?: string | null) {
    const plain = this.text(value);
    if (!plain) return null;
    const key = this.secretKey();
    if (!key) return Buffer.from(plain, 'utf8').toString('base64');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  private hasSecret(value?: string | null) {
    return Boolean(String(value || '').trim());
  }

  private decryptSecret(value?: string | null) {
    const encrypted = this.text(value);
    if (!encrypted) return null;

    if (!encrypted.startsWith('v1:')) {
      try {
        return Buffer.from(encrypted, 'base64').toString('utf8');
      } catch {
        return encrypted;
      }
    }

    const key = this.secretKey();
    if (!key) return null;

    try {
      const [, ivEncoded, tagEncoded, payloadEncoded] = encrypted.split(':');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(ivEncoded, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payloadEncoded, 'base64')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      return null;
    }
  }

  private avitoCredentialState(account: {
    clientId?: string | null;
    apiKeyEncrypted?: string | null;
    accessTokenEncrypted?: string | null;
    expiresAt?: Date | null;
  }) {
    const clientId = this.text(account.clientId);
    const clientSecret = this.decryptSecret(account.apiKeyEncrypted);
    const accessToken = this.decryptSecret(account.accessTokenEncrypted);
    const expiresAt = this.date(account.expiresAt);
    const hasLiveAccessToken =
      Boolean(accessToken) &&
      Boolean(expiresAt) &&
      expiresAt!.getTime() > Date.now() + 5 * 60 * 1000;

    return {
      hasClientId: Boolean(clientId),
      hasClientSecret: Boolean(clientSecret),
      hasAccessToken: Boolean(accessToken),
      hasLiveAccessToken,
      requiresReconnect: !clientId || !clientSecret,
      message:
        !clientId || !clientSecret
          ? 'Для Avito не сохранены Client ID или Client secret. Переподключите аккаунт в настройках.'
          : null,
    };
  }

  private getMarketplaceSigningKey() {
    const key = this.secretKey();
    if (!key) {
      throw new InternalServerErrorException(
        'OAuth для площадок не настроен: нет секретного ключа приложения',
      );
    }
    return key;
  }

  private encodeSignedState(payload: AvitoOAuthStatePayload) {
    const serialized = JSON.stringify(payload);
    const body = Buffer.from(serialized, 'utf8').toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.getMarketplaceSigningKey())
      .update(body)
      .digest('base64url');
    return `${body}.${signature}`;
  }

  private decodeSignedState(input?: string | null): AvitoOAuthStatePayload | null {
    const raw = this.text(input);
    if (!raw) return null;

    const [body, signature] = raw.split('.');
    if (!body || !signature) return null;

    const expected = crypto
      .createHmac('sha256', this.getMarketplaceSigningKey())
      .update(body)
      .digest('base64url');

    const expectedBuffer = Buffer.from(expected);
    const actualBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length !== actualBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
      if (!parsed?.accountId || !parsed?.actorId || !parsed?.redirectTo || !parsed?.iat) {
        return null;
      }

      const ageMs = Date.now() - Number(parsed.iat || 0);
      if (ageMs < 0 || ageMs > 30 * 60 * 1000) {
        return null;
      }

      return parsed as AvitoOAuthStatePayload;
    } catch {
      return null;
    }
  }

  private getCrmPublicUrl() {
    return String(process.env.CRM_PUBLIC_URL || 'https://crm.technoprimestore.ru')
      .trim()
      .replace(/\/+$/, '');
  }

  private getAvitoAuthorizeUrl() {
    return 'https://www.avito.ru/oauth';
  }

  private getAvitoTokenUrl() {
    return 'https://api.avito.ru/token';
  }

  private normalizeAvitoRedirectTarget(input?: string | null) {
    const fallback = '/settings/integrations';
    const raw = this.text(input);
    if (!raw) return fallback;

    try {
      const crm = new URL(this.getCrmPublicUrl());
      const parsed = raw.startsWith('http') ? new URL(raw) : new URL(raw, crm);
      if (parsed.origin !== crm.origin) {
        return fallback;
      }

      return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
    } catch {
      return fallback;
    }
  }

  private isAvitoClientCredentialsUnsupported(message: string) {
    const text = String(message || '').toLowerCase();
    return (
      text.includes('not authorized to request a token using this method') ||
      text.includes('unsupported_grant_type') ||
      text.includes('unauthorized_client')
    );
  }

  private isAvitoFatalConnectionError(message: string) {
    const text = String(message || '').toLowerCase();
    return (
      this.isAvitoClientCredentialsUnsupported(message) ||
      text.includes('не сохранены client id') ||
      text.includes('не сохранены client secret') ||
      text.includes('invalid client') ||
      text.includes('invalid token') ||
      text.includes('token expired') ||
      text.includes('access denied') ||
      text.includes('forbidden') ||
      text.includes('401')
    );
  }

  private isAvitoBusinessDeliveryRestriction(message?: string | null) {
    const text = String(message || '').toLowerCase();
    return (
      text.includes('api работает только с авито доставкой для бизнеса') ||
      text.includes('нужно указать реквизиты компании') ||
      text.includes('настроить тариф')
    );
  }

  private buildAvitoAuthorizationRedirect(options: {
    accountId: number;
    actorId: number;
    clientId: string;
    scopes?: string | null;
    redirectTo?: string | null;
  }) {
    const redirectTo = this.normalizeAvitoRedirectTarget(options.redirectTo);
    const state = this.encodeSignedState({
      accountId: options.accountId,
      actorId: options.actorId,
      redirectTo,
      iat: Date.now(),
      nonce: crypto.randomBytes(8).toString('hex'),
    });

    const params = new URLSearchParams();
    params.set('response_type', 'code');
    params.set('client_id', options.clientId);
    params.set('redirect_uri', this.getAvitoRedirectUrl());
    params.set('state', state);

    const scopes = this.text(options.scopes);
    if (scopes) {
      params.set('scope', scopes);
    }

    return {
      redirectTo,
      state,
      redirectUrl: `${this.getAvitoAuthorizeUrl()}?${params.toString()}`,
    };
  }

  getAvitoRedirectUrl() {
    return `${this.getCrmPublicUrl()}/api/logistics/oauth/avito/callback`;
  }

  private buildOAuthResultUrl(redirectTo: string, params: Record<string, string>) {
    const base = redirectTo.startsWith('http')
      ? new URL(redirectTo)
      : new URL(redirectTo, this.getCrmPublicUrl());

    Object.entries(params).forEach(([key, value]) => {
      if (value) base.searchParams.set(key, value);
    });
    return base.toString();
  }

  renderOAuthCallbackPage(options: {
    ok: boolean;
    title: string;
    message: string;
    redirectUrl: string;
  }) {
    const safeTitle = String(options.title || 'OAuth');
    const safeMessage = String(options.message || '');
    const safeRedirect = String(options.redirectUrl || this.getCrmPublicUrl());

    return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:#07111f;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
      .card{width:min(560px,100%);background:linear-gradient(180deg,rgba(15,23,42,.92),rgba(2,6,23,.96));border:1px solid rgba(148,163,184,.18);border-radius:28px;padding:32px;box-shadow:0 30px 90px rgba(2,6,23,.55)}
      .badge{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;background:${options.ok ? 'rgba(16,185,129,.14)' : 'rgba(244,63,94,.14)'};border:1px solid ${options.ok ? 'rgba(52,211,153,.28)' : 'rgba(251,113,133,.28)'};color:${options.ok ? '#bbf7d0' : '#fecdd3'}}
      h1{margin:18px 0 10px;font-size:28px;line-height:1.2}
      p{margin:0;color:#94a3b8;line-height:1.7}
      a{display:inline-flex;margin-top:22px;padding:13px 18px;border-radius:14px;background:linear-gradient(90deg,#7c3aed,#06b6d4);color:#fff;text-decoration:none;font-weight:700}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">${options.ok ? 'Подключено' : 'Ошибка'}</div>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <a href="${safeRedirect}">Вернуться в CRM</a>
    </div>
    <script>setTimeout(function(){ window.location.replace(${JSON.stringify(safeRedirect)}); }, 1800);</script>
  </body>
</html>`;
  }

  private async upsertAvitoAccountDraft(body: any, actor: Actor) {
    if (actor?.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Подключать площадки может только супер-админ');
    }

    const displayName = this.text(body?.displayName);
    const clientId = this.text(body?.clientId);
    const clientSecret = this.text(body?.apiKey);

    if (!displayName) {
      throw new BadRequestException('Укажите название подключения');
    }
    if (!clientId) {
      throw new BadRequestException('Укажите Client ID приложения Avito');
    }
    if (!clientSecret) {
      throw new BadRequestException('Укажите Client secret приложения Avito');
    }

    const data: Prisma.MarketplaceAccountUncheckedCreateInput = {
      platform: MarketplacePlatform.AVITO,
      displayName,
      authType: MarketplaceAuthType.API_KEY,
      status: MarketplaceAccountStatus.DISCONNECTED,
      externalAccountId: this.text(body?.externalAccountId),
      clientId,
      scopes: this.text(body?.scopes),
      apiKeyEncrypted: this.encryptSecret(clientSecret),
      connectedById: actor?.id || null,
      disconnectedAt: null,
      lastSyncError: null,
    };

    if (body?.accountId) {
      const existing = await this.prisma.marketplaceAccount.findFirst({
        where: {
          id: Number(body.accountId),
          tenant: 'TECHNOPRIME',
          platform: MarketplacePlatform.AVITO,
        },
        select: { id: true },
      });
      if (!existing) {
        throw new NotFoundException('Аккаунт Avito для переподключения не найден');
      }

      return this.prisma.marketplaceAccount.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.marketplaceAccount.create({ data });
  }

  private async requestAvitoToken(tokenBody: URLSearchParams) {
    const tokenRes = await fetch(this.getAvitoTokenUrl(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    }).catch(() => null);

    const tokenData = tokenRes ? await tokenRes.json().catch(() => null) : null;

    if (!tokenRes?.ok || !tokenData || tokenData?.error || !tokenData?.access_token) {
      const message =
        String(tokenData?.error_description || tokenData?.error || '').trim() ||
        `Avito вернул ошибку выдачи access token${tokenRes ? ` (${tokenRes.status})` : ''}`;
      throw new BadRequestException(message);
    }

    const expiresIn = Number(tokenData.expires_in || 0);
    const expiresAt =
      Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

    return {
      accessToken: String(tokenData.access_token || ''),
      refreshToken: this.text(tokenData.refresh_token) || null,
      expiresAt,
      raw: tokenData,
    };
  }

  private async issueAvitoClientCredentialsToken(options: {
    clientId: string;
    clientSecret: string;
    scopes?: string | null;
  }) {
    const tokenBody = new URLSearchParams();
    tokenBody.set('grant_type', 'client_credentials');
    tokenBody.set('client_id', options.clientId);
    tokenBody.set('client_secret', options.clientSecret);
    const scopes = this.text(options.scopes);
    if (scopes) {
      tokenBody.set('scope', scopes);
    }

    return this.requestAvitoToken(tokenBody);
  }

  private async issueAvitoAuthorizationCodeToken(options: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    scopes?: string | null;
  }) {
    const tokenBody = new URLSearchParams();
    tokenBody.set('grant_type', 'authorization_code');
    tokenBody.set('client_id', options.clientId);
    tokenBody.set('client_secret', options.clientSecret);
    tokenBody.set('code', options.code);
    tokenBody.set('redirect_uri', options.redirectUri);

    const scopes = this.text(options.scopes);
    if (scopes) {
      tokenBody.set('scope', scopes);
    }

    return this.requestAvitoToken(tokenBody);
  }

  async startAvitoOAuth(body: any, actor: Actor) {
    const account = await this.upsertAvitoAccountDraft(body, actor);
    const clientSecret = this.decryptSecret(account.apiKeyEncrypted);
    const actorId = Number(actor?.id || 0);
    const oauthMode = this.text(body?.oauthMode)?.toLowerCase() || 'auto';
    const wantsAuthorizationCode =
      oauthMode === 'authorization_code' || oauthMode === 'oauth' || oauthMode === 'personal';

    if (!account.clientId || !clientSecret) {
      throw new BadRequestException('Для Avito не сохранены Client ID или Client secret');
    }
    if (!actorId || Number.isNaN(actorId)) {
      throw new BadRequestException('Не удалось определить сотрудника для OAuth-подключения Avito');
    }

    if (wantsAuthorizationCode) {
      const oauth = this.buildAvitoAuthorizationRedirect({
        accountId: account.id,
        actorId,
        clientId: account.clientId,
        scopes: account.scopes,
        redirectTo: body?.redirectTo,
      });

      return {
        success: true,
        mode: 'authorization_code',
        redirectUrl: oauth.redirectUrl,
        accountId: account.id,
      };
    }

    try {
      const token = await this.issueAvitoClientCredentialsToken({
        clientId: account.clientId,
        clientSecret,
        scopes: account.scopes,
      });

      const updated = await this.prisma.marketplaceAccount.update({
        where: { id: account.id },
        data: {
          authType: MarketplaceAuthType.API_KEY,
          status: MarketplaceAccountStatus.CONNECTED,
          accessTokenEncrypted: this.encryptSecret(token.accessToken),
          refreshTokenEncrypted: null,
          expiresAt: token.expiresAt,
          disconnectedAt: null,
          lastSyncAt: new Date(),
          lastSyncError: null,
          connectedById: actor?.id || null,
        },
        include: { connectedBy: { select: { id: true, name: true, login: true } } },
      });

      return {
        success: true,
        mode: 'client_credentials',
        account: this.mapMarketplaceAccount(updated),
      };
    } catch (error: any) {
      const message = error?.message || 'Не удалось получить access token Avito';

      if (this.isAvitoClientCredentialsUnsupported(message)) {
        const oauth = this.buildAvitoAuthorizationRedirect({
          accountId: account.id,
          actorId,
          clientId: account.clientId,
          scopes: account.scopes,
          redirectTo: body?.redirectTo,
        });

        await this.prisma.marketplaceAccount.update({
          where: { id: account.id },
          data: {
            authType: MarketplaceAuthType.OAUTH,
            status: MarketplaceAccountStatus.DISCONNECTED,
            accessTokenEncrypted: null,
            refreshTokenEncrypted: null,
            expiresAt: null,
            lastSyncError: 'Требуется OAuth-авторизация через окно Avito.',
            connectedById: actorId,
          },
        });

        return {
          success: true,
          mode: 'authorization_code',
          reason: 'client_credentials_unsupported',
          redirectUrl: oauth.redirectUrl,
          accountId: account.id,
          message: 'Для этого приложения Avito требуется персональная OAuth-авторизация.',
        };
      }

      await this.prisma.marketplaceAccount.update({
        where: { id: account.id },
        data: {
          authType: MarketplaceAuthType.API_KEY,
          status: MarketplaceAccountStatus.ERROR,
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          expiresAt: null,
          lastSyncError: message,
          connectedById: actor?.id || null,
        },
      });

      throw new BadRequestException(message);
    }
  }

  async completeAvitoOAuth(query: any) {
    const fallbackRedirect = '/settings/integrations';
    const signedState = this.decodeSignedState(query?.state);
    const redirectTo = this.normalizeAvitoRedirectTarget(
      signedState?.redirectTo || fallbackRedirect,
    );

    if (!signedState) {
      return {
        ok: false,
        redirectUrl: this.buildOAuthResultUrl(redirectTo, {
          provider: 'AVITO',
          oauth: 'error',
          reason: 'invalid_state',
        }),
        title: 'Не удалось подтвердить состояние OAuth',
        message: 'Ссылка авторизации устарела или повреждена. Запустите подключение Avito заново.',
      };
    }

    const callbackError = this.text(query?.error);
    const callbackErrorDescription = this.text(query?.error_description);
    const authCode = this.text(query?.code);

    if (callbackError || !authCode) {
      const reason = callbackErrorDescription || callbackError || 'oauth_code_missing';
      return {
        ok: false,
        redirectUrl: this.buildOAuthResultUrl(redirectTo, {
          provider: 'AVITO',
          oauth: 'error',
          reason,
        }),
        title: 'Avito не завершил авторизацию',
        message:
          callbackErrorDescription ||
          'Площадка не вернула код авторизации. Повторите подключение и подтвердите доступ в окне Avito.',
      };
    }

    const account = await this.prisma.marketplaceAccount.findFirst({
      where: {
        id: signedState.accountId,
        tenant: 'TECHNOPRIME',
        platform: MarketplacePlatform.AVITO,
      },
      include: {
        connectedBy: {
          select: { id: true, name: true, login: true },
        },
      },
    });

    if (!account) {
      return {
        ok: false,
        redirectUrl: this.buildOAuthResultUrl(redirectTo, {
          provider: 'AVITO',
          oauth: 'error',
          reason: 'account_not_found',
        }),
        title: 'Черновик подключения не найден',
        message: 'Аккаунт Avito для завершения OAuth не найден. Запустите подключение заново.',
      };
    }

    const clientSecret = this.decryptSecret(account.apiKeyEncrypted);
    if (!account.clientId || !clientSecret) {
      return {
        ok: false,
        redirectUrl: this.buildOAuthResultUrl(redirectTo, {
          provider: 'AVITO',
          oauth: 'error',
          reason: 'client_credentials_missing',
        }),
        title: 'Не хватает Client ID или Client secret',
        message: 'Сохраните Client ID/Client secret заново и повторите OAuth-подключение Avito.',
      };
    }

    try {
      const token = await this.issueAvitoAuthorizationCodeToken({
        clientId: account.clientId,
        clientSecret,
        code: authCode,
        redirectUri: this.getAvitoRedirectUrl(),
        scopes: account.scopes,
      });

      await this.prisma.marketplaceAccount.update({
        where: { id: account.id },
        data: {
          authType: MarketplaceAuthType.OAUTH,
          status: MarketplaceAccountStatus.CONNECTED,
          accessTokenEncrypted: this.encryptSecret(token.accessToken),
          refreshTokenEncrypted: token.refreshToken ? this.encryptSecret(token.refreshToken) : null,
          expiresAt: token.expiresAt,
          disconnectedAt: null,
          lastSyncAt: new Date(),
          lastSyncError: null,
          connectedById: signedState.actorId || account.connectedById || null,
        },
      });

      return {
        ok: true,
        redirectUrl: this.buildOAuthResultUrl(redirectTo, {
          provider: 'AVITO',
          oauth: 'success',
          mode: 'authorization_code',
        }),
        title: 'Avito успешно подключён',
        message: 'OAuth-авторизация завершена. Можно возвращаться в CRM и запускать синхронизацию.',
      };
    } catch (error: any) {
      const message = String(error?.message || 'Не удалось завершить OAuth Avito').slice(0, 320);
      await this.prisma.marketplaceAccount.update({
        where: { id: account.id },
        data: {
          authType: MarketplaceAuthType.OAUTH,
          status: MarketplaceAccountStatus.ERROR,
          lastSyncError: message,
          connectedById: signedState.actorId || account.connectedById || null,
        },
      });

      return {
        ok: false,
        redirectUrl: this.buildOAuthResultUrl(redirectTo, {
          provider: 'AVITO',
          oauth: 'error',
          reason: message,
        }),
        title: 'Не удалось получить токен Avito',
        message,
      };
    }
  }

  private mapMarketplaceAccount(account: any) {
    const avitoState =
      account.platform === MarketplacePlatform.AVITO
        ? this.avitoCredentialState({
            clientId: account.clientId,
            apiKeyEncrypted: account.apiKeyEncrypted,
            accessTokenEncrypted: account.accessTokenEncrypted,
            expiresAt: account.expiresAt,
          })
        : null;

    return {
      id: account.id,
      platform: account.platform,
      displayName: account.displayName,
      authType: account.authType,
      status: account.status,
      externalAccountId: account.externalAccountId,
      clientId: account.clientId,
      scopes: account.scopes,
      expiresAt: account.expiresAt,
      disconnectedAt: account.disconnectedAt,
      lastSyncAt: account.lastSyncAt,
      lastSyncError: account.lastSyncError,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      connectedBy: account.connectedBy,
      hasClientId: Boolean(this.text(account.clientId)),
      hasAccessToken: this.hasSecret(account.accessTokenEncrypted),
      hasRefreshToken: this.hasSecret(account.refreshTokenEncrypted),
      hasApiKey: this.hasSecret(account.apiKeyEncrypted),
      requiresReconnect: avitoState?.requiresReconnect || false,
      connectionHint: avitoState?.message || null,
    };
  }

  private async resolveSyncActorId(preferredId?: number | null, fallbackId?: number | null) {
    const direct = Number(preferredId || 0);
    if (Number.isFinite(direct) && direct > 0) return direct;

    const fallback = Number(fallbackId || 0);
    if (Number.isFinite(fallback) && fallback > 0) return fallback;

    const employee = await this.prisma.employee.findFirst({
      where: { tenant: 'TECHNOPRIME' },
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (!employee) {
      throw new InternalServerErrorException(
        'В CRM нет сотрудника, от имени которого можно выполнить синхронизацию',
      );
    }
    return employee.id;
  }

  private avitoExternalOrderNumbers(order: AvitoRemoteOrder) {
    return Array.from(
      new Set([this.text(order.marketplaceId), this.text(order.id)].filter(Boolean)),
    ) as string[];
  }

  private avitoOrderTitle(order: AvitoRemoteOrder) {
    const titles = (order.items || [])
      .map(item => this.text(item?.title))
      .filter(Boolean) as string[];

    if (titles.length) {
      return titles.join(' · ');
    }

    const externalId = this.avitoExternalOrderNumbers(order)[0];
    return externalId ? `Заказ Avito ${externalId}` : 'Заказ Avito';
  }

  private avitoCarrier(order: AvitoRemoteOrder): ShipmentCarrier {
    const serviceName = String(order.delivery?.serviceName || '').toLowerCase();

    if (serviceName.includes('сдэк') || serviceName.includes('cdek')) {
      return ShipmentCarrier.AVITO_CDEK;
    }
    if (serviceName.includes('янд') || serviceName.includes('yandex')) {
      return ShipmentCarrier.AVITO_YANDEX;
    }
    if (serviceName.includes('почт')) {
      return ShipmentCarrier.AVITO_POST_RUSSIA;
    }
    return ShipmentCarrier.AVITO_DELIVERY;
  }

  private avitoShipmentStatus(remoteStatus?: string | null): ShipmentStatus {
    switch (String(remoteStatus || '').toLowerCase()) {
      case 'on_confirmation':
      case 'ready_to_ship':
        return ShipmentStatus.READY_FOR_HANDOVER;
      case 'in_transit':
        return ShipmentStatus.IN_TRANSIT;
      case 'delivered':
      case 'closed':
        return ShipmentStatus.RECEIVED_BY_CUSTOMER;
      case 'on_return':
        return ShipmentStatus.RETURN_IN_TRANSIT;
      case 'in_dispute':
        return ShipmentStatus.DELIVERY_ISSUE;
      case 'canceled':
        return ShipmentStatus.CANCELED;
      default:
        return ShipmentStatus.AWAITING_SHIPMENT_DATA;
    }
  }

  private avitoOrderStatus(remoteStatus?: string | null): OrderStatus {
    switch (String(remoteStatus || '').toLowerCase()) {
      case 'canceled':
        return OrderStatus.CANCELED;
      case 'on_return':
        return OrderStatus.IN_PROGRESS;
      default:
        return OrderStatus.IN_PROGRESS;
    }
  }

  private avitoSettlementStatus(remoteStatus?: string | null): SettlementStatus {
    switch (String(remoteStatus || '').toLowerCase()) {
      case 'canceled':
        return SettlementStatus.CANCELED;
      case 'delivered':
      case 'closed':
        return SettlementStatus.AWAITING_FUNDS_RECEIPT;
      default:
        return SettlementStatus.AWAITING_CUSTOMER_RECEIPT;
    }
  }

  private avitoExpectedDeliveryAt(order: AvitoRemoteOrder) {
    return (
      this.date(order.schedules?.deliveryDate) ||
      this.date(order.schedules?.deliveryDateMax) ||
      this.date(order.schedules?.['deliveryDateMaх']) ||
      this.date(order.schedules?.deliveryDateMin) ||
      null
    );
  }

  private async ensureAvitoClientToken(account: {
    id: number;
    clientId?: string | null;
    scopes?: string | null;
    expiresAt?: Date | null;
    accessTokenEncrypted?: string | null;
    apiKeyEncrypted?: string | null;
  }) {
    const currentAccessToken = this.decryptSecret(account.accessTokenEncrypted);
    const currentSecret = this.decryptSecret(account.apiKeyEncrypted);
    const expiresSoon =
      !currentAccessToken ||
      !account.expiresAt ||
      account.expiresAt.getTime() <= Date.now() + 5 * 60 * 1000;

    if (!expiresSoon) {
      return currentAccessToken;
    }

    if (!account.clientId || !currentSecret) {
      const message =
        'Для Avito не сохранены Client ID или Client secret. Переподключите аккаунт в настройках.';

      await this.prisma.marketplaceAccount
        .update({
          where: { id: account.id },
          data: {
            status: MarketplaceAccountStatus.ERROR,
            lastSyncError: message,
          },
        })
        .catch(() => undefined);

      throw new BadRequestException(message);
    }

    const token = await this.issueAvitoClientCredentialsToken({
      clientId: account.clientId,
      clientSecret: currentSecret,
      scopes: account.scopes,
    });

    await this.prisma.marketplaceAccount.update({
      where: { id: account.id },
      data: {
        authType: MarketplaceAuthType.API_KEY,
        status: MarketplaceAccountStatus.CONNECTED,
        accessTokenEncrypted: this.encryptSecret(token.accessToken),
        refreshTokenEncrypted: null,
        expiresAt: token.expiresAt,
        lastSyncError: null,
      },
    });

    return token.accessToken;
  }

  private ensureStaffAccess(actor: Actor) {
    const allowedRoles = new Set<Role>([Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER]);
    if (!allowedRoles.has((actor?.role as Role) || Role.MANAGER)) {
      throw new ForbiddenException('Доступно только сотрудникам CRM');
    }
  }

  private requireActorId(actor: Actor) {
    const actorId = Number(actor?.id || 0);
    if (!actorId || Number.isNaN(actorId)) {
      throw new ForbiddenException('Не удалось определить сотрудника для персональных настроек');
    }
    return actorId;
  }

  private async getPinnedAvitoChats(employeeId: number, marketplaceAccountId: number) {
    try {
      return await this.prisma.employeePinnedChat.findMany({
        where: {
          employeeId,
          platform: MarketplacePlatform.AVITO,
          marketplaceAccountId,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          chatId: true,
          createdAt: true,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Pinned chats are unavailable (migration is likely missing): ${String(error)}`,
      );
      return [] as Array<{ id: number; chatId: string; createdAt: Date }>;
    }
  }

  private async getHiddenAvitoMessageIds(marketplaceAccountId: number, chatId: string) {
    try {
      const rows = await this.prisma.$queryRaw<Array<{ messageExternalId: string }>>`
        SELECT "messageExternalId"
        FROM "MarketplaceHiddenMessage"
        WHERE "tenant" = 'TECHNOPRIME'::"Tenant"
          AND "platform" = 'AVITO'::"MarketplacePlatform"
          AND "marketplaceAccountId" = ${marketplaceAccountId}
          AND "chatId" = ${chatId}
      `;
      return new Set(rows.map(row => String(row.messageExternalId || '').trim()).filter(Boolean));
    } catch (error) {
      this.logger.warn(
        `Hidden Avito messages are unavailable (migration is likely missing): ${String(error)}`,
      );
      return new Set<string>();
    }
  }

  private async hideAvitoMessageLocally(
    marketplaceAccountId: number,
    chatId: string,
    messageExternalId: string,
    actorId: number,
  ) {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "MarketplaceHiddenMessage"
          ("tenant", "platform", "marketplaceAccountId", "chatId", "messageExternalId", "hiddenById")
        VALUES
          ('TECHNOPRIME'::"Tenant", 'AVITO'::"MarketplacePlatform", ${marketplaceAccountId}, ${chatId}, ${messageExternalId}, ${actorId})
        ON CONFLICT ("tenant", "marketplaceAccountId", "chatId", "messageExternalId")
        DO UPDATE SET "hiddenAt" = CURRENT_TIMESTAMP, "hiddenById" = ${actorId}
      `;
    } catch (error) {
      this.logger.warn(`Failed to hide Avito message ${messageExternalId}: ${String(error)}`);
      throw new BadRequestException(
        'Удаление сообщений пока недоступно: миграции БД не применены. Примените миграции и повторите.',
      );
    }
  }

  private async deleteAvitoMessageRemotely(
    account: {
      id: number;
      clientId?: string | null;
      scopes?: string | null;
      accessTokenEncrypted?: string | null;
      apiKeyEncrypted?: string | null;
      expiresAt?: Date | null;
    },
    userId: string,
    chatId: string,
    messageId: string,
  ) {
    try {
      await this.fetchAvitoJson(
        account,
        `/messenger/v1/accounts/${encodeURIComponent(userId)}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
        { method: 'POST' },
      );
    } catch (error: any) {
      const message =
        this.text(error?.response?.message) ||
        this.text(error?.message) ||
        'Avito не удалил сообщение';
      if (/hour|час|too late|expired|не позднее/i.test(message)) {
        throw new BadRequestException(
          'Avito разрешает удалять исходящие сообщения только в течение часа после отправки',
        );
      }
      throw new BadRequestException(message);
    }
  }

  private async findAvitoMessageDirection(
    account: {
      id: number;
      clientId?: string | null;
      scopes?: string | null;
      accessTokenEncrypted?: string | null;
      apiKeyEncrypted?: string | null;
      expiresAt?: Date | null;
    },
    userId: string,
    chatId: string,
    messageId: string,
  ) {
    const normalizedMessageId = String(messageId || '').trim();
    if (!normalizedMessageId) return null;

    const limit = 100;
    for (let page = 0; page < 10; page += 1) {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(page * limit));

      const payload = await this.fetchAvitoJson(
        account,
        `/messenger/v3/accounts/${encodeURIComponent(userId)}/chats/${encodeURIComponent(chatId)}/messages/?${params.toString()}`,
      );
      const items = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.messages)
          ? payload.messages
          : [];
      const found = items
        .map((message: AvitoRemoteMessage) => this.mapAvitoMessage(message))
        .find(message => String(message.id || '') === normalizedMessageId);
      if (found) {
        return String(found.direction || '').toLowerCase();
      }
      if (items.length < limit) break;
    }

    return null;
  }

  private withPinnedAvitoMeta(
    chats: any[],
    pinnedRows: Array<{ chatId: string; createdAt: Date }>,
  ) {
    const pinnedIndex = new Map<string, number>();
    pinnedRows.forEach((row, index) => {
      pinnedIndex.set(String(row.chatId), index);
    });

    return chats
      .map(chat => ({
        ...chat,
        isPinned: pinnedIndex.has(String(chat.id)),
      }))
      .sort((left, right) => {
        const leftPinned = pinnedIndex.has(String(left.id));
        const rightPinned = pinnedIndex.has(String(right.id));
        if (leftPinned && !rightPinned) return -1;
        if (!leftPinned && rightPinned) return 1;
        if (leftPinned && rightPinned) {
          return (pinnedIndex.get(String(left.id)) || 0) - (pinnedIndex.get(String(right.id)) || 0);
        }
        return 0;
      });
  }

  private async findAvitoAccountOrThrow(accountId: number) {
    const account = await this.prisma.marketplaceAccount.findFirst({
      where: {
        id: accountId,
        tenant: 'TECHNOPRIME',
        platform: MarketplacePlatform.AVITO,
      },
      select: {
        id: true,
        platform: true,
        displayName: true,
        externalAccountId: true,
        clientId: true,
        scopes: true,
        accessTokenEncrypted: true,
        apiKeyEncrypted: true,
        expiresAt: true,
        lastSyncAt: true,
        lastSyncError: true,
        status: true,
      },
    });

    if (!account) {
      throw new NotFoundException('Avito аккаунт не найден');
    }

    return account;
  }

  private parsePositiveInt(value: any, fallback: number, min = 1, max = 100) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, Math.trunc(parsed)));
  }

  private buildAvitoChatsQueryParams(limit: number, offset: number, unreadOnly: boolean) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    params.set('chat_types', 'u2i');
    if (unreadOnly) {
      params.set('unread_only', 'true');
    }
    return params;
  }

  private async fetchMappedAvitoChatsPage(
    account: any,
    userId: string,
    options: { limit: number; offset: number; unreadOnly: boolean },
  ) {
    const params = this.buildAvitoChatsQueryParams(
      options.limit,
      options.offset,
      options.unreadOnly,
    );
    const payload = await this.fetchAvitoJson(
      account,
      `/messenger/v2/accounts/${encodeURIComponent(userId)}/chats?${params.toString()}`,
    );
    const chats = Array.isArray(payload?.chats) ? payload.chats : [];
    return chats.map((chat: AvitoRemoteChat) => this.mapAvitoChat(chat, userId));
  }

  private unixToIso(value?: number | null) {
    if (!value || !Number.isFinite(Number(value))) return null;
    return new Date(Number(value) * 1000).toISOString();
  }

  private avitoMessageText(content?: Record<string, any> | null, type?: string | null) {
    if (type === 'deleted') return 'Сообщение удалено';
    if (!content) return '';
    if (content.text) return String(content.text).trim();
    if (content.link?.url) return String(content.link.url).trim();
    if (content.link?.text) return String(content.link.text).trim();
    if (content.item?.title) return String(content.item.title).trim();
    if (content.location?.title) return String(content.location.title).trim();
    if (content.location?.text) return String(content.location.text).trim();
    if (content.call?.status === 'missed') return 'Пропущенный звонок';
    if (content.voice?.voice_id) return 'Голосовое сообщение';
    if (content.image?.sizes) return 'Изображение';
    if (type === 'system') return 'Системное сообщение Avito';
    return '';
  }

  private avitoMessageImage(content?: Record<string, any> | null) {
    const sizes = content?.image?.sizes;
    if (!sizes || typeof sizes !== 'object') return null;

    const entries = Object.entries(sizes)
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' && Boolean(entry[0] && this.text(entry[1])),
      )
      .sort((left, right) => {
        const area = (value: string) => {
          const match = value.match(/^(\d+)x(\d+)$/);
          if (!match) return 0;
          return Number(match[1]) * Number(match[2]);
        };
        return area(right[0]) - area(left[0]);
      });

    if (!entries.length) return null;

    return {
      url: entries[0][1],
      sizes: Object.fromEntries(entries),
    };
  }

  private avitoMessageVoiceUrl(content?: Record<string, any> | null) {
    const voice = content?.voice;
    if (!voice || typeof voice !== 'object') return null;
    return this.text(
      voice.url ||
        voice.link ||
        voice.download_url ||
        voice.downloadUrl ||
        voice.audio_url ||
        voice.audioUrl,
    );
  }

  private avitoAvatar(chat: AvitoRemoteChat) {
    const users = Array.isArray(chat.users) ? chat.users : [];
    for (const user of users) {
      const avatar = user?.public_user_profile?.avatar;
      if (avatar?.images?.['128x128']) return avatar.images['128x128'];
      if (avatar?.default) return avatar.default;
    }
    const main = chat.context?.value?.images?.main;
    return main?.['140x105'] || null;
  }

  private async ensureAvitoSelfAccountId(account: {
    id: number;
    externalAccountId?: string | null;
    clientId?: string | null;
    scopes?: string | null;
    accessTokenEncrypted?: string | null;
    apiKeyEncrypted?: string | null;
    expiresAt?: Date | null;
  }) {
    const existing = this.text(account.externalAccountId);
    if (existing) return existing;

    const accessToken = await this.ensureAvitoClientToken(account);
    const response = await fetch('https://api.avito.ru/core/v1/accounts/self', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      throw new BadRequestException(
        `Avito не вернул данные профиля${response ? ` (${response.status})` : ''}${raw ? `: ${raw.slice(0, 240)}` : ''}`,
      );
    }

    const payload = await response.json().catch(() => ({}));
    const externalAccountId = this.text(payload?.id ? String(payload.id) : null);
    if (!externalAccountId) {
      throw new BadRequestException('Avito не вернул ID подключённого аккаунта');
    }

    await this.prisma.marketplaceAccount.update({
      where: { id: account.id },
      data: { externalAccountId },
    });

    return externalAccountId;
  }

  private async fetchAvitoJson(
    account: {
      id: number;
      externalAccountId?: string | null;
      clientId?: string | null;
      scopes?: string | null;
      accessTokenEncrypted?: string | null;
      apiKeyEncrypted?: string | null;
      expiresAt?: Date | null;
    },
    path: string,
    init?: RequestInit,
  ) {
    const accessToken = await this.ensureAvitoClientToken(account);
    const headers = new Headers(init?.headers || {});
    const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
    const timeoutMs = Number(process.env.AVITO_API_TIMEOUT_MS || 12_000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    headers.set('Authorization', `Bearer ${accessToken}`);
    if (!isFormData && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    let response: Response;
    try {
      response = await fetch(`https://api.avito.ru${path}`, {
        ...init,
        headers,
        signal: init?.signal || controller.signal,
      }).finally(() => {
        clearTimeout(timeoutId);
      });
    } catch (error: any) {
      const timedOut = String(error?.name || '').toLowerCase() === 'aborterror';
      const message = timedOut
        ? 'Avito API отвечает слишком долго, попробуйте повторить запрос'
        : String(error?.message || 'Ошибка запроса к Avito API');

      await this.prisma.marketplaceAccount
        .update({
          where: { id: account.id },
          data: {
            lastSyncError: message,
            lastSyncAt: new Date(),
          },
        })
        .catch(() => undefined);

      throw new BadRequestException(message);
    }

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        this.text(payload?.message) ||
        this.text(payload?.error?.message) ||
        `Avito API ${response.status}`;

      await this.prisma.marketplaceAccount
        .update({
          where: { id: account.id },
          data: {
            lastSyncError: message,
            lastSyncAt: new Date(),
          },
        })
        .catch(() => undefined);

      throw new BadRequestException(message);
    }

    await this.prisma.marketplaceAccount
      .update({
        where: { id: account.id },
        data: {
          lastSyncError: null,
          lastSyncAt: new Date(),
        },
      })
      .catch(() => undefined);

    return payload;
  }

  private mapAvitoChat(chat: AvitoRemoteChat, selfAccountId: string) {
    const selfId = String(selfAccountId || '').trim();
    const users = Array.isArray(chat.users) ? chat.users : [];
    const counterpart = users.find(user => String(user?.id || '') !== selfId) || users[0] || null;

    return {
      id: String(chat.id || ''),
      updatedAt:
        this.unixToIso(chat.updated) || this.unixToIso(chat.created) || new Date().toISOString(),
      createdAt: this.unixToIso(chat.created),
      unreadCount: Number(chat.unread_count || 0),
      counterpart: {
        id: counterpart?.id ? String(counterpart.id) : null,
        name: this.text(counterpart?.name) || 'Покупатель Avito',
        avatarUrl: this.avitoAvatar(chat),
      },
      item: {
        id: chat.context?.value?.id ? String(chat.context.value.id) : null,
        title: this.text(chat.context?.value?.title) || 'Объявление Avito',
        price: this.text(chat.context?.value?.price_string),
        url: this.text(chat.context?.value?.url),
      },
      lastMessage: {
        id: this.text(chat.last_message?.id),
        text: this.avitoMessageText(chat.last_message?.content, chat.last_message?.type),
        type: this.text(chat.last_message?.type),
        direction: this.text(chat.last_message?.direction) || 'out',
        createdAt: this.unixToIso(chat.last_message?.created),
      },
    };
  }

  private mapAvitoMessage(message: AvitoRemoteMessage) {
    const image = this.avitoMessageImage(message.content);
    const voiceUrl = this.avitoMessageVoiceUrl(message.content);
    const quoteImage = this.avitoMessageImage(message.quote?.content);

    return {
      id: String(message.id || ''),
      text: this.avitoMessageText(message.content, message.type),
      type: this.text(message.type),
      imageUrl: image?.url || null,
      imageSizes: image?.sizes || null,
      voiceUrl: voiceUrl || null,
      direction: this.text(message.direction) || 'out',
      authorId: message.author_id ? String(message.author_id) : null,
      createdAt: this.unixToIso(message.created) || new Date().toISOString(),
      isRead: Boolean(message.is_read),
      readAt: this.unixToIso(message.read),
      quote: message.quote
        ? {
            id: this.text(message.quote.id),
            text: this.avitoMessageText(message.quote.content, message.quote.type),
            type: this.text(message.quote.type),
            imageUrl: quoteImage?.url || null,
          }
        : null,
    };
  }

  private startOfUtcDay(value?: string | Date | null) {
    const date = this.date(value);
    if (!date) return null;
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0),
    );
  }

  private numericField(payload: Record<string, any> | null | undefined, keys: string[]) {
    if (!payload || typeof payload !== 'object') return 0;
    for (const key of keys) {
      const number = Number(payload[key]);
      if (Number.isFinite(number)) return number;
    }
    return 0;
  }

  private textField(payload: Record<string, any> | null | undefined, keys: string[]) {
    if (!payload || typeof payload !== 'object') return null;
    for (const key of keys) {
      const value = this.text(payload[key]);
      if (value) return value;
    }
    return null;
  }

  private avitoListingServices(payload: Record<string, any> | null | undefined) {
    if (!payload || typeof payload !== 'object') return [] as any[];
    if (Array.isArray(payload.vas)) return payload.vas;
    if (Array.isArray(payload.services)) return payload.services;
    return [] as any[];
  }

  private normalizeAvitoService(service: any) {
    if (typeof service === 'string') {
      return {
        code: service.toLowerCase(),
        title: avitoServiceTitle({ code: service }),
      };
    }

    const code =
      this.text(
        service?.vas_id ||
          service?.vasId ||
          service?.service_id ||
          service?.serviceId ||
          service?.slug ||
          service?.code,
      )?.toLowerCase() || null;

    return {
      ...(service || {}),
      ...(code ? { code } : {}),
      title: avitoServiceTitle(service || {}),
    };
  }

  private mergeAvitoListingServices(...payloads: Array<Record<string, any> | null | undefined>) {
    const result: any[] = [];
    const seen = new Set<string>();

    for (const payload of payloads) {
      for (const service of this.avitoListingServices(payload)) {
        const normalized = this.normalizeAvitoService(service);
        const key =
          typeof normalized === 'string'
            ? normalized.toLowerCase()
            : JSON.stringify({
                code: this.text(
                  normalized?.code ||
                    normalized?.vas_id ||
                    normalized?.vasId ||
                    normalized?.service_id ||
                    normalized?.serviceId ||
                    normalized?.slug ||
                    normalized?.code,
                ),
                title: avitoServiceTitle(normalized),
                type: this.text(normalized?.type || normalized?.serviceType),
              });
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(normalized);
      }
    }

    return result;
  }

  private chunk<T>(items: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
      chunks.push(items.slice(index, index + size));
    }
    return chunks;
  }

  private avitoItemsRows(payload: any) {
    if (Array.isArray(payload?.resources)) return payload.resources;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.result?.items)) return payload.result.items;
    return [] as Record<string, any>[];
  }

  private avitoStatsRows(payload: any) {
    if (Array.isArray(payload?.result?.items)) return payload.result.items;
    if (Array.isArray(payload?.result)) return payload.result;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.stats)) return payload.stats;
    return [] as Record<string, any>[];
  }

  private avitoDailyStatRows(payload: Record<string, any>) {
    if (Array.isArray(payload?.stats)) return payload.stats;
    if (Array.isArray(payload?.daily_stats)) return payload.daily_stats;
    if (Array.isArray(payload?.statistics)) return payload.statistics;
    if (Array.isArray(payload?.days)) return payload.days;
    return [] as Record<string, any>[];
  }

  private avitoItemId(payload: Record<string, any>) {
    return (
      this.textField(payload, ['itemId', 'item_id', 'id']) ||
      this.textField(payload?.item, ['id']) ||
      null
    );
  }

  private avitoOperationKey(payload: Record<string, any>) {
    const basis = JSON.stringify({
      paidAt: payload?.paidAt || payload?.paid_at || payload?.updatedAt || payload?.updated_at,
      amountRub: payload?.amountRub || payload?.amount_rub,
      amountBonus: payload?.amountBonus || payload?.amount_bonus,
      amountTotal: payload?.amountTotal || payload?.amount_total,
      itemId: payload?.itemId || payload?.item_id,
      operationType: payload?.operationType || payload?.operation_type,
      serviceId: payload?.serviceId || payload?.service_id,
      serviceName: payload?.serviceName || payload?.service_name,
    });
    return crypto.createHash('sha1').update(basis).digest('hex');
  }

  private async fetchAvitoItems(account: {
    id: number;
    clientId?: string | null;
    scopes?: string | null;
    accessTokenEncrypted?: string | null;
    apiKeyEncrypted?: string | null;
    expiresAt?: Date | null;
  }) {
    const rows: Record<string, any>[] = [];
    const statuses = ['active', 'old', 'removed', 'blocked', 'rejected'];

    for (const status of statuses) {
      for (let page = 1; page <= 10; page += 1) {
        const payload = await this.fetchAvitoJson(
          account,
          `/core/v1/items?per_page=100&page=${page}&status=${encodeURIComponent(status)}`,
          { method: 'GET' },
        ).catch(() => null);

        const batch = this.avitoItemsRows(payload);
        if (!batch.length) break;

        rows.push(...batch);

        if (batch.length < 100) break;
      }
    }

    const dedup = new Map<string, Record<string, any>>();
    for (const row of rows) {
      const itemId = this.avitoItemId(row);
      if (!itemId) continue;
      dedup.set(itemId, row);
    }
    return Array.from(dedup.values());
  }

  private async fetchAvitoListingStats(
    account: {
      id: number;
      clientId?: string | null;
      scopes?: string | null;
      accessTokenEncrypted?: string | null;
      apiKeyEncrypted?: string | null;
      expiresAt?: Date | null;
    },
    userId: string,
    itemIds: string[],
  ) {
    const rows: Record<string, any>[] = [];
    const dateTo = new Date();
    const dateFrom = new Date(dateTo);
    dateFrom.setUTCDate(dateFrom.getUTCDate() - 29);

    for (const batch of this.chunk(itemIds, 200)) {
      const payload = await this.fetchAvitoJson(
        account,
        `/stats/v1/accounts/${encodeURIComponent(userId)}/items`,
        {
          method: 'POST',
          body: JSON.stringify({
            dateFrom: dateFrom.toISOString().slice(0, 10),
            dateTo: dateTo.toISOString().slice(0, 10),
            periodGrouping: 'day',
            itemIds: batch.map(itemId => Number(itemId)).filter(value => Number.isFinite(value)),
          }),
        },
      ).catch(() => null);
      rows.push(...this.avitoStatsRows(payload));
    }
    return rows;
  }

  private async fetchAvitoVasPriceMap(
    account: {
      id: number;
      clientId?: string | null;
      scopes?: string | null;
      accessTokenEncrypted?: string | null;
      apiKeyEncrypted?: string | null;
      expiresAt?: Date | null;
    },
    userId: string,
    itemIds: string[],
  ) {
    const map = new Map<string, Record<string, any>>();
    for (const batch of this.chunk(itemIds, 200)) {
      const payload = await this.fetchAvitoJson(
        account,
        `/core/v1/accounts/${encodeURIComponent(userId)}/price/vas`,
        {
          method: 'POST',
          body: JSON.stringify({
            itemIds: batch.map(itemId => Number(itemId)).filter(value => Number.isFinite(value)),
          }),
        },
      ).catch(() => null);
      const vas = payload?.vas && typeof payload.vas === 'object' ? payload.vas : {};
      for (const [itemId, value] of Object.entries(vas)) {
        map.set(String(itemId), (value || {}) as Record<string, any>);
      }
    }
    return map;
  }

  private async fetchAvitoVasPackageMap(
    account: {
      id: number;
      clientId?: string | null;
      scopes?: string | null;
      accessTokenEncrypted?: string | null;
      apiKeyEncrypted?: string | null;
      expiresAt?: Date | null;
    },
    userId: string,
    itemIds: string[],
  ) {
    const map = new Map<string, Record<string, any>>();
    for (const batch of this.chunk(itemIds, 200)) {
      const payload = await this.fetchAvitoJson(
        account,
        `/core/v1/accounts/${encodeURIComponent(userId)}/price/vas_packages`,
        {
          method: 'POST',
          body: JSON.stringify({
            itemIds: batch.map(itemId => Number(itemId)).filter(value => Number.isFinite(value)),
          }),
        },
      ).catch(() => null);
      const packages =
        payload?.packages && typeof payload.packages === 'object' ? payload.packages : {};
      for (const [itemId, value] of Object.entries(packages)) {
        map.set(String(itemId), (value || {}) as Record<string, any>);
      }
    }
    return map;
  }

  private async fetchAvitoOperationsHistory(
    account: {
      id: number;
      clientId?: string | null;
      scopes?: string | null;
      accessTokenEncrypted?: string | null;
      apiKeyEncrypted?: string | null;
      expiresAt?: Date | null;
    },
    daysBack = 35,
  ) {
    const operations = new Map<string, AvitoBalanceOperation>();
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - Math.max(daysBack - 1, 0));

    let cursor = new Date(start);
    while (cursor <= now) {
      const chunkStart = new Date(cursor);
      const chunkEnd = new Date(cursor);
      chunkEnd.setUTCDate(chunkEnd.getUTCDate() + 6);
      if (chunkEnd > now) chunkEnd.setTime(now.getTime());

      const payload = await this.fetchAvitoJson(account, `/core/v1/accounts/operations_history`, {
        method: 'POST',
        body: JSON.stringify({
          dateTimeFrom: chunkStart.toISOString(),
          dateTimeTo: chunkEnd.toISOString(),
        }),
      }).catch(() => null);

      const rows = Array.isArray(payload?.result)
        ? payload.result
        : Array.isArray(payload?.result?.operations)
          ? payload.result.operations
          : Array.isArray(payload?.operations)
            ? payload.operations
            : [];

      for (const raw of rows) {
        const paidAt =
          this.date(
            raw?.paidAt || raw?.paid_at || raw?.updatedAt || raw?.updated_at,
          )?.toISOString() || null;
        if (!paidAt) continue;

        const normalized: AvitoBalanceOperation = {
          operationKey: this.avitoOperationKey(raw || {}),
          paidAt,
          itemExternalId: this.text(
            raw?.itemId || raw?.item_id ? String(raw?.itemId || raw?.item_id) : null,
          ),
          operationName: this.text(raw?.operationName || raw?.operation_name),
          operationType: this.text(raw?.operationType || raw?.operation_type),
          serviceId: Number.isFinite(Number(raw?.serviceId || raw?.service_id))
            ? Number(raw?.serviceId || raw?.service_id)
            : null,
          serviceName: this.text(raw?.serviceName || raw?.service_name),
          serviceType: this.text(raw?.serviceType || raw?.service_type),
          amountRub: this.numericField(raw, ['amountRub', 'amount_rub']),
          amountBonus: this.numericField(raw, ['amountBonus', 'amount_bonus']),
          amountTotal: this.numericField(raw, ['amountTotal', 'amount_total']),
          payload: raw || {},
        };

        operations.set(normalized.operationKey, normalized);
      }

      cursor = new Date(chunkEnd);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return Array.from(operations.values()).sort((left, right) =>
      left.paidAt.localeCompare(right.paidAt),
    );
  }

  private mapAvitoLearningExample(input: {
    chatId: string;
    itemExternalId?: string | null;
    itemTitle?: string | null;
    priceLabel?: string | null;
    counterpartName?: string | null;
    message: Record<string, any>;
  }): AvitoLearningExample | null {
    const mapped = this.mapAvitoMessage(input.message as AvitoRemoteMessage);
    if (!mapped.id) return null;

    return {
      chatId: input.chatId,
      messageExternalId: mapped.id,
      itemExternalId: input.itemExternalId || null,
      itemTitle: input.itemTitle || null,
      priceLabel: input.priceLabel || null,
      counterpartName: input.counterpartName || null,
      direction: mapped.direction || 'out',
      messageType: mapped.type || null,
      text: this.text(mapped.text),
      hasImage: Boolean(mapped.imageUrl),
      messageAt: mapped.createdAt,
      payload: input.message,
    };
  }

  private async fetchAvitoListingDetails(
    account: {
      id: number;
      clientId?: string | null;
      scopes?: string | null;
      accessTokenEncrypted?: string | null;
      apiKeyEncrypted?: string | null;
      expiresAt?: Date | null;
    },
    userId: string,
    itemId: string,
  ) {
    return this.fetchAvitoJson(
      account,
      `/core/v1/accounts/${encodeURIComponent(userId)}/items/${encodeURIComponent(itemId)}/`,
    ).catch(() => null);
  }

  async collectAvitoAnalyticsSnapshot(accountId: number) {
    const account = await this.findAvitoAccountOrThrow(accountId);
    const userId = await this.ensureAvitoSelfAccountId(account);
    const warnings: string[] = [];

    const balancePayload = await this.fetchAvitoJson(
      account,
      `/core/v1/accounts/${encodeURIComponent(userId)}/balance`,
    ).catch((error: any) => {
      warnings.push(this.text(error?.message) || 'Не удалось получить баланс Avito');
      return null;
    });

    const itemRows = await this.fetchAvitoItems(account).catch((error: any) => {
      warnings.push(this.text(error?.message) || 'Не удалось получить список объявлений Avito');
      return [] as Record<string, any>[];
    });

    const itemIds = Array.from(
      new Set(
        itemRows
          .map(row => this.avitoItemId(row))
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const statRows = itemIds.length
      ? await this.fetchAvitoListingStats(account, userId, itemIds).catch((error: any) => {
          warnings.push(
            this.text(error?.message) || 'Не удалось получить статистику объявлений Avito',
          );
          return [] as Record<string, any>[];
        })
      : [];

    const statsByItemId = new Map<string, Record<string, any>>();
    for (const row of statRows) {
      const itemId = this.avitoItemId(row);
      if (!itemId) continue;
      statsByItemId.set(itemId, row);
    }

    const vasPricesMap = itemIds.length
      ? await this.fetchAvitoVasPriceMap(account, userId, itemIds).catch(
          () => new Map<string, Record<string, any>>(),
        )
      : new Map<string, Record<string, any>>();

    const vasPackagesMap = itemIds.length
      ? await this.fetchAvitoVasPackageMap(account, userId, itemIds).catch(
          () => new Map<string, Record<string, any>>(),
        )
      : new Map<string, Record<string, any>>();

    const details = await Promise.all(
      itemIds.slice(0, 150).map(async itemId => {
        const normalizedItemId = String(itemId);
        return [
          normalizedItemId,
          await this.fetchAvitoListingDetails(account, userId, normalizedItemId),
        ] as const;
      }),
    );
    const detailMap = new Map<string, any>(details);

    const listings: AvitoAnalyticsListing[] = itemIds
      .map(itemId => {
        const row = statsByItemId.get(itemId) || {};
        const item = itemRows.find(candidate => this.avitoItemId(candidate) === itemId) || {};
        const detail = detailMap.get(itemId) || {};
        const dailyMetrics = this.avitoDailyStatRows(row)
          .map(dailyRow => {
            const statDate = this.startOfUtcDay(
              this.textField(dailyRow, ['date', 'day', 'statDate', 'stat_date']),
            );
            if (!statDate) return null;

            return {
              date: statDate.toISOString(),
              uniqViews: this.numericField(dailyRow, [
                'uniqViews',
                'uniq_views',
                'views',
                'view_count',
              ]),
              uniqFavorites: this.numericField(dailyRow, [
                'uniqFavorites',
                'uniq_favorites',
                'favorites',
                'favorite_count',
              ]),
              uniqContacts: this.numericField(dailyRow, [
                'uniqContacts',
                'uniq_contacts',
                'contacts',
                'contact_count',
              ]),
              payload: dailyRow,
            };
          })
          .filter((metric): metric is AvitoAnalyticsDailyMetric => Boolean(metric));

        if (!dailyMetrics.length) {
          const today = this.startOfUtcDay(new Date());
          if (today) {
            dailyMetrics.push({
              date: today.toISOString(),
              uniqViews: this.numericField(row, ['uniqViews', 'uniq_views', 'views', 'view_count']),
              uniqFavorites: this.numericField(row, [
                'uniqFavorites',
                'uniq_favorites',
                'favorites',
                'favorite_count',
              ]),
              uniqContacts: this.numericField(row, [
                'uniqContacts',
                'uniq_contacts',
                'contacts',
                'contact_count',
              ]),
              payload: row,
            });
          }
        }

        return {
          externalItemId: itemId,
          title:
            this.textField(detail, ['title', 'name']) ||
            this.textField(item, ['title', 'name']) ||
            this.textField(row, ['title', 'name']) ||
            `Объявление ${itemId}`,
          url:
            this.textField(detail, ['url']) ||
            this.textField(item, ['url']) ||
            this.textField(row, ['url']) ||
            null,
          priceLabel:
            this.textField(detail, ['price_string', 'price']) ||
            this.textField(item, ['price']) ||
            this.textField(row, ['price_string', 'price']) ||
            null,
          statusLabel:
            this.textField(detail, ['status']) ||
            this.textField(item, ['status']) ||
            this.textField(row, ['status']) ||
            null,
          services: this.mergeAvitoListingServices(detail, item, row),
          startAt: this.date(detail?.start_time || detail?.startTime)?.toISOString() || null,
          finishAt: this.date(detail?.finish_time || detail?.finishTime)?.toISOString() || null,
          payload: {
            ...(Object.keys(item || {}).length ? { item } : {}),
            ...(Object.keys(row || {}).length ? { stats: row } : {}),
            ...(Object.keys(detail || {}).length ? { detail } : {}),
            availableVasPrices: vasPricesMap.get(itemId) || null,
            availableVasPackages: vasPackagesMap.get(itemId) || null,
          },
          dailyMetrics,
        };
      })
      .filter(Boolean) as AvitoAnalyticsListing[];

    const operations = await this.fetchAvitoOperationsHistory(account, 120).catch((error: any) => {
      warnings.push(this.text(error?.message) || 'Не удалось получить историю операций Avito');
      return [] as AvitoBalanceOperation[];
    });

    const chatsPayload = await this.fetchAvitoJson(
      account,
      `/messenger/v2/accounts/${encodeURIComponent(userId)}/chats?limit=100&offset=0&chat_types=u2i`,
    ).catch((error: any) => {
      warnings.push(this.text(error?.message) || 'Не удалось получить список Avito-чатов');
      return null;
    });

    const chats = Array.isArray(chatsPayload?.chats) ? chatsPayload.chats : [];
    const learningMap = new Map<string, AvitoLearningExample>();

    const pushLearning = (example: AvitoLearningExample | null) => {
      if (!example?.messageExternalId) return;
      if (!learningMap.has(example.messageExternalId)) {
        learningMap.set(example.messageExternalId, example);
      }
    };

    for (const chat of chats.slice(0, 50)) {
      const mappedChat = this.mapAvitoChat(chat as AvitoRemoteChat, userId);

      if (chat?.last_message) {
        pushLearning(
          this.mapAvitoLearningExample({
            chatId: mappedChat.id,
            itemExternalId: mappedChat.item.id,
            itemTitle: mappedChat.item.title,
            priceLabel: mappedChat.item.price,
            counterpartName: mappedChat.counterpart.name,
            message: chat.last_message,
          }),
        );
      }

      const messagesPayload = await this.fetchAvitoJson(
        account,
        `/messenger/v3/accounts/${encodeURIComponent(userId)}/chats/${encodeURIComponent(mappedChat.id)}/messages/?limit=80&offset=0`,
      ).catch(() => null);

      const remoteMessages = Array.isArray(messagesPayload)
        ? messagesPayload
        : Array.isArray(messagesPayload?.messages)
          ? messagesPayload.messages
          : [];

      for (const remoteMessage of remoteMessages) {
        pushLearning(
          this.mapAvitoLearningExample({
            chatId: mappedChat.id,
            itemExternalId: mappedChat.item.id,
            itemTitle: mappedChat.item.title,
            priceLabel: mappedChat.item.price,
            counterpartName: mappedChat.counterpart.name,
            message: remoteMessage,
          }),
        );
      }
    }

    return {
      syncedAt: new Date().toISOString(),
      account: {
        id: account.id,
        displayName: account.displayName,
        externalAccountId: userId,
      },
      balance: balancePayload
        ? {
            realBalance: this.numericField(balancePayload, ['real', 'realBalance', 'balance']),
            bonusBalance: this.numericField(balancePayload, ['bonus', 'bonusBalance']),
            payload: balancePayload,
          }
        : null,
      listings,
      operations,
      learningExamples: Array.from(learningMap.values()),
      warnings,
    };
  }

  private async fetchAvitoOrders(account: {
    id: number;
    clientId?: string | null;
    scopes?: string | null;
    expiresAt?: Date | null;
    accessTokenEncrypted?: string | null;
    apiKeyEncrypted?: string | null;
  }) {
    const accessToken = await this.ensureAvitoClientToken(account);
    const collected: AvitoRemoteOrder[] = [];
    let page = 1;
    let hasMore = false;

    do {
      const url = new URL('/order-management/1/orders', 'https://api.avito.ru');
      url.searchParams.set('page', String(page));
      url.searchParams.set('limit', '20');

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => null);

      const payload = response ? await response.json().catch(() => null) : null;

      if (!response?.ok) {
        const message =
          this.text(payload?.message) ||
          this.text(payload?.error_description) ||
          this.text(payload?.error) ||
          `Avito вернул ошибку синхронизации заказов${response ? ` (${response.status})` : ''}`;
        throw new BadRequestException(message);
      }

      const orders = Array.isArray(payload?.orders) ? payload.orders : [];
      collected.push(...orders);
      hasMore = Boolean(payload?.hasMore);
      page += 1;
    } while (hasMore && page <= 10);

    return collected;
  }

  private async resolveAvitoClient(tx: Prisma.TransactionClient, remote: AvitoRemoteOrder) {
    const fullName = this.text(remote.delivery?.buyerInfo?.fullName);
    const normalizedPhone = this.normalizePhone(remote.delivery?.buyerInfo?.phoneNumber);
    const variants = this.buildPhoneVariants(normalizedPhone);

    if (variants.length) {
      const existing = await tx.client.findFirst({
        where: {
          tenant: 'TECHNOPRIME',
          phone: { in: variants },
        },
        orderBy: { id: 'asc' },
      });

      if (existing) {
        if (fullName && existing.name !== fullName) {
          return tx.client.update({
            where: { id: existing.id },
            data: { name: fullName },
          });
        }
        return existing;
      }
    }

    const fallbackOrderNumber = this.avitoExternalOrderNumbers(remote)[0] || String(Date.now());
    const placeholderPhone = variants[0] || `avito-order-${fallbackOrderNumber}`;

    return tx.client.create({
      data: {
        name: fullName || `Покупатель Avito #${fallbackOrderNumber}`,
        phone: placeholderPhone,
        city: this.text(remote.delivery?.terminalInfo?.address) || null,
        address: this.text(remote.delivery?.terminalInfo?.address) || null,
        notes: variants.length
          ? 'Импортировано из Avito по номеру телефона покупателя'
          : 'Импортировано из Avito без телефона покупателя. Уточните контакт вручную.',
      },
    });
  }

  private async writeApiShipmentEvent(
    tx: Prisma.TransactionClient,
    input: {
      shipmentId: number;
      status: ShipmentStatus;
      title: string;
      comment?: string | null;
      rawPayload?: Prisma.InputJsonValue;
      createdById?: number | null;
    },
  ) {
    const latest = await tx.shipmentEvent.findFirst({
      where: {
        shipmentId: input.shipmentId,
        source: ShipmentSyncMode.API,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        title: true,
        comment: true,
      },
    });

    const nextComment = this.text(input.comment) || null;
    if (
      latest &&
      latest.status === input.status &&
      latest.title === input.title &&
      (latest.comment || null) === nextComment
    ) {
      return latest;
    }

    return tx.shipmentEvent.create({
      data: {
        shipmentId: input.shipmentId,
        status: input.status,
        source: ShipmentSyncMode.API,
        title: input.title,
        comment: nextComment,
        rawPayload: input.rawPayload,
        createdById: input.createdById || null,
      },
    });
  }

  private async importAvitoOrder(
    tx: Prisma.TransactionClient,
    remote: AvitoRemoteOrder,
    actorId: number,
  ) {
    const externalNumbers = this.avitoExternalOrderNumbers(remote);
    const trackingNumber = this.text(remote.delivery?.trackingNumber);
    const barcode = this.text(remote.delivery?.dispatchNumber);
    const carrier = this.avitoCarrier(remote);
    const shipmentStatus = this.avitoShipmentStatus(remote.status);
    const orderStatus = this.avitoOrderStatus(remote.status);
    const settlementStatus = this.avitoSettlementStatus(remote.status);
    const title = this.avitoOrderTitle(remote);
    const existingShipment = await tx.shipment.findFirst({
      where: {
        tenant: 'TECHNOPRIME',
        OR: [
          ...(externalNumbers.length
            ? externalNumbers.map(value => ({ externalOrderNumber: value }))
            : []),
          ...(trackingNumber ? [{ trackingNumber }] : []),
          ...(barcode ? [{ barcode }] : []),
        ],
      },
      include: {
        order: {
          select: {
            id: true,
            clientId: true,
            comment: true,
          },
        },
      },
    });

    const receiverPoint =
      this.text(remote.delivery?.terminalInfo?.address) ||
      this.text(remote.delivery?.terminalInfo?.code);
    const expectedDeliveryAt = this.avitoExpectedDeliveryAt(remote);
    const expectedPayout = this.money(remote.prices?.total);
    const totalPrice = this.moneyOrZero(remote.prices?.price ?? remote.prices?.total);
    const marketplaceCommission = this.money(remote.prices?.commission);

    if (!existingShipment) {
      const client = await this.resolveAvitoClient(tx, remote);
      const order = await tx.order.create({
        data: {
          clientId: client.id,
          createdById: actorId,
          managerId: actorId,
          status: orderStatus,
          source: OrderSource.MANUAL,
          salesChannel: SalesChannel.AVITO,
          fulfillmentMethod: FulfillmentMethod.TRANSPORT_COMPANY,
          settlementStatus,
          expectedPayout,
          marketplaceCommission,
          paymentMethod: PaymentMethod.TRANSFER,
          totalPrice,
          costPrice: new Prisma.Decimal('0.00'),
          profit: new Prisma.Decimal('0.00'),
          comment: title,
        },
      });

      const shipment = await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier,
          status: shipmentStatus,
          syncMode: ShipmentSyncMode.API,
          externalOrderNumber: externalNumbers[0] || null,
          trackingNumber,
          barcode,
          receiverPoint,
          expectedDeliveryAt,
          lastSyncedAt: new Date(),
          managerComment: title,
          customerNote: null,
        },
      });

      await this.writeApiShipmentEvent(tx, {
        shipmentId: shipment.id,
        status: shipmentStatus,
        title: this.statusTitle(shipmentStatus),
        comment: 'Импортировано из Avito',
        rawPayload: remote as Prisma.InputJsonValue,
        createdById: actorId,
      });

      return { imported: 1, updated: 0 };
    }

    const statusChanged = existingShipment.status !== shipmentStatus;
    const changedPoint = (existingShipment.receiverPoint || null) !== (receiverPoint || null);
    const changedTracking = (existingShipment.trackingNumber || null) !== (trackingNumber || null);
    const changedBarcode = (existingShipment.barcode || null) !== (barcode || null);
    const changedEta =
      (existingShipment.expectedDeliveryAt?.toISOString() || null) !==
      (expectedDeliveryAt?.toISOString() || null);

    await tx.order.update({
      where: { id: existingShipment.orderId },
      data: {
        status: orderStatus,
        salesChannel: SalesChannel.AVITO,
        fulfillmentMethod: FulfillmentMethod.TRANSPORT_COMPANY,
        settlementStatus,
        expectedPayout,
        marketplaceCommission,
        ...(existingShipment.order.comment ? {} : { comment: title }),
      },
    });

    const updatedShipment = await tx.shipment.update({
      where: { id: existingShipment.id },
      data: {
        carrier,
        status: shipmentStatus,
        syncMode: ShipmentSyncMode.API,
        externalOrderNumber: externalNumbers[0] || existingShipment.externalOrderNumber,
        trackingNumber,
        barcode,
        receiverPoint,
        expectedDeliveryAt,
        lastSyncedAt: new Date(),
        managerComment: existingShipment.managerComment || title,
      },
    });

    if (statusChanged || changedPoint || changedTracking || changedBarcode || changedEta) {
      await this.writeApiShipmentEvent(tx, {
        shipmentId: updatedShipment.id,
        status: shipmentStatus,
        title: this.statusTitle(shipmentStatus),
        comment: statusChanged
          ? 'Статус обновлён из Avito'
          : 'Данные отправления обновлены из Avito',
        rawPayload: remote as Prisma.InputJsonValue,
        createdById: actorId,
      });
    }

    return { imported: 0, updated: 1 };
  }

  private async syncAvitoAccount(accountId: number, actorId?: number | null) {
    const account = await this.prisma.marketplaceAccount.findFirst({
      where: {
        id: accountId,
        tenant: 'TECHNOPRIME',
        platform: MarketplacePlatform.AVITO,
      },
      include: {
        connectedBy: {
          select: { id: true, name: true, login: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException('Подключение Avito не найдено');
    }

    const syncActorId = await this.resolveSyncActorId(actorId, account.connectedById);

    try {
      const remoteOrders = await this.fetchAvitoOrders(account);
      let imported = 0;
      let updated = 0;

      for (const remote of remoteOrders) {
        const result = await this.prisma.$transaction(async tx =>
          this.importAvitoOrder(tx, remote, syncActorId),
        );
        imported += result.imported;
        updated += result.updated;
      }

      const refreshed = await this.prisma.marketplaceAccount.update({
        where: { id: account.id },
        data: {
          status: MarketplaceAccountStatus.CONNECTED,
          lastSyncAt: new Date(),
          lastSyncError: null,
        },
        include: { connectedBy: { select: { id: true, name: true, login: true } } },
      });

      return {
        success: true,
        platform: MarketplacePlatform.AVITO,
        fetched: remoteOrders.length,
        imported,
        updated,
        account: this.mapMarketplaceAccount(refreshed),
      };
    } catch (error: any) {
      const message = this.text(error?.message) || 'Не удалось синхронизировать Avito';
      const fatalConnectionError = this.isAvitoFatalConnectionError(message);
      const restrictedByBusinessDelivery = this.isAvitoBusinessDeliveryRestriction(message);

      const refreshed = await this.prisma.marketplaceAccount.update({
        where: { id: account.id },
        data: {
          status:
            fatalConnectionError && !restrictedByBusinessDelivery
              ? MarketplaceAccountStatus.ERROR
              : MarketplaceAccountStatus.CONNECTED,
          lastSyncAt: new Date(),
          lastSyncError: message,
        },
        include: { connectedBy: { select: { id: true, name: true, login: true } } },
      });

      throw new BadRequestException(message);
    }
  }

  private async recalcOrderProducts(tx: Prisma.TransactionClient, orderId: number) {
    const units = await tx.inventoryUnit.findMany({
      where: { orderId },
      select: { productId: true, storefrontProductId: true },
    });
    const productIds = Array.from(
      new Set(
        units
          .flatMap(unit => [unit.productId, Number(unit.storefrontProductId || 0)])
          .filter(id => id > 0),
      ),
    );
    if (productIds.length) {
      await this.inventory.recalcProductsAvailability(productIds, tx);
    }
  }

  private async setOrderUnitsStatus(
    tx: Prisma.TransactionClient,
    orderId: number,
    status: InventoryUnitStatus,
    options?: {
      onlyStatuses?: InventoryUnitStatus[];
      clearOrder?: boolean;
      soldAt?: Date | null;
    },
  ) {
    const rows = await tx.inventoryUnit.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        orderId,
        ...(options?.onlyStatuses?.length ? { status: { in: options.onlyStatuses } } : {}),
      },
      select: { id: true },
    });
    if (!rows.length) return 0;

    await tx.inventoryUnit.updateMany({
      where: { id: { in: rows.map(row => row.id) } },
      data: {
        status,
        ...(status === InventoryUnitStatus.AVAILABLE || options?.clearOrder
          ? {
              orderId: null,
              orderItemId: null,
              reservedAt: null,
              soldAt: null,
            }
          : {}),
        ...(options?.soldAt !== undefined ? { soldAt: options.soldAt } : {}),
      },
    });

    await this.recalcOrderProducts(tx, orderId);
    return rows.length;
  }

  private statusTitle(status: ShipmentStatus) {
    const titles: Record<ShipmentStatus, string> = {
      NOT_REQUIRED: 'Доставка не требуется',
      AWAITING_SHIPMENT_DATA: 'Ожидает данных отправки',
      READY_FOR_HANDOVER: 'Готов к передаче в службу доставки',
      HANDED_TO_CARRIER: 'Передан в службу доставки',
      IN_TRANSIT: 'В пути',
      ARRIVED_AT_PICKUP_POINT: 'Прибыл в пункт выдачи',
      AWAITING_CUSTOMER_PICKUP: 'Ожидает получения клиентом',
      RECEIVED_BY_CUSTOMER: 'Получен клиентом',
      RETURN_IN_TRANSIT: 'Возврат в пути',
      RETURNED_TO_SELLER: 'Возвращён продавцу',
      DELIVERY_ISSUE: 'Проблема с доставкой',
      CANCELED: 'Доставка отменена',
    };
    return titles[status] || status;
  }

  private statusUpdates(status: ShipmentStatus) {
    const now = new Date();
    switch (status) {
      case ShipmentStatus.READY_FOR_HANDOVER:
        return {
          order: { status: OrderStatus.IN_PROGRESS },
          settlementStatus: SettlementStatus.AWAITING_CUSTOMER_RECEIPT,
          inventoryStatus: InventoryUnitStatus.HANDOVER_PENDING,
        };
      case ShipmentStatus.HANDED_TO_CARRIER:
      case ShipmentStatus.IN_TRANSIT:
        return {
          order: { status: OrderStatus.IN_PROGRESS },
          shipment: status === ShipmentStatus.HANDED_TO_CARRIER ? { handedOverAt: now } : {},
          settlementStatus: SettlementStatus.AWAITING_CUSTOMER_RECEIPT,
          inventoryStatus: InventoryUnitStatus.IN_TRANSIT,
        };
      case ShipmentStatus.ARRIVED_AT_PICKUP_POINT:
      case ShipmentStatus.AWAITING_CUSTOMER_PICKUP:
        return {
          order: { status: OrderStatus.IN_PROGRESS },
          shipment: status === ShipmentStatus.ARRIVED_AT_PICKUP_POINT ? { arrivedAt: now } : {},
          settlementStatus: SettlementStatus.AWAITING_CUSTOMER_RECEIPT,
          inventoryStatus: InventoryUnitStatus.IN_TRANSIT,
        };
      case ShipmentStatus.RECEIVED_BY_CUSTOMER:
        return {
          order: { status: OrderStatus.IN_PROGRESS },
          shipment: { receivedAt: now },
          settlementStatus: SettlementStatus.AWAITING_FUNDS_RECEIPT,
          inventoryStatus: InventoryUnitStatus.DELIVERED,
        };
      case ShipmentStatus.RETURN_IN_TRANSIT:
        return {
          order: { status: OrderStatus.IN_PROGRESS },
          settlementStatus: SettlementStatus.CANCELED,
          inventoryStatus: InventoryUnitStatus.RETURN_IN_TRANSIT,
        };
      case ShipmentStatus.RETURNED_TO_SELLER:
        return {
          order: { status: OrderStatus.RETURNED },
          shipment: { returnedAt: now },
          settlementStatus: SettlementStatus.CANCELED,
          inventoryStatus: InventoryUnitStatus.AVAILABLE,
          clearOrderFromUnits: true,
        };
      case ShipmentStatus.CANCELED:
        return {
          order: { status: OrderStatus.CANCELED },
          settlementStatus: SettlementStatus.CANCELED,
          inventoryStatus: InventoryUnitStatus.AVAILABLE,
          clearOrderFromUnits: true,
        };
      default:
        return {
          order: { status: OrderStatus.IN_PROGRESS },
          settlementStatus: undefined,
          inventoryStatus: undefined,
        };
    }
  }

  async listShipments(query: any = {}) {
    const status = query.status
      ? this.enumValue(ShipmentStatus, query.status, ShipmentStatus.AWAITING_SHIPMENT_DATA)
      : undefined;
    const carrier = query.carrier
      ? this.enumValue(ShipmentCarrier, query.carrier, ShipmentCarrier.OTHER)
      : undefined;
    const salesChannel = query.salesChannel
      ? this.enumValue(SalesChannel, query.salesChannel, SalesChannel.OTHER)
      : undefined;

    const where: Prisma.ShipmentWhereInput = {
      tenant: 'TECHNOPRIME',
      ...(status ? { status } : {}),
      ...(carrier ? { carrier } : {}),
      ...(salesChannel ? { order: { salesChannel } } : {}),
    };

    const shipments = await this.prisma.shipment.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        order: {
          include: {
            client: { select: { id: true, name: true, phone: true, city: true, address: true } },
            items: {
              include: {
                product: {
                  select: { id: true, name: true, brand: true, model: true, version: true },
                },
                inventoryUnits: { select: { id: true, serialNumber: true, status: true } },
              },
            },
          },
        },
        events: { orderBy: { createdAt: 'desc' }, take: 8 },
      },
      take: Math.min(Number(query.limit) || 100, 200),
    });

    return shipments;
  }

  async getShipment(id: number) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { id, tenant: 'TECHNOPRIME' },
      include: {
        order: {
          include: {
            client: { select: { id: true, name: true, phone: true, city: true, address: true } },
            items: {
              include: {
                product: {
                  select: { id: true, name: true, brand: true, model: true, version: true },
                },
                inventoryUnits: { select: { id: true, serialNumber: true, status: true } },
              },
            },
          },
        },
        events: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!shipment) throw new NotFoundException('Отправление не найдено');
    return shipment;
  }

  async resolveShipmentByReference(body: any, actor: Actor) {
    this.ensureStaffAccess(actor);

    const candidates = Array.from(
      new Set(
        [
          this.text(body?.externalOrderNumber),
          this.text(body?.trackingNumber),
          this.text(body?.barcode),
          this.text(body?.number),
        ].filter((value): value is string => Boolean(value)),
      ),
    );

    if (!candidates.length) {
      throw new BadRequestException(
        'Укажите номер заказа площадки, номер отправления или код отправки',
      );
    }

    const hint = String(body?.platform || body?.salesChannel || body?.carrier || '')
      .trim()
      .toUpperCase();
    let syncedAccounts = 0;

    if (hint.includes('AVITO')) {
      const connectedAccounts = await this.prisma.marketplaceAccount.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          platform: MarketplacePlatform.AVITO,
          status: MarketplaceAccountStatus.CONNECTED,
          disconnectedAt: null,
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      });

      for (const account of connectedAccounts) {
        try {
          await this.syncAvitoAccount(account.id, actor?.id);
          syncedAccounts += 1;
        } catch (error: any) {
          this.logger.warn(
            `Resolve shipment sync failed for Avito account ${account.id}: ${String(error?.message || error)}`,
          );
        }
      }
    }

    const shipment = await this.prisma.shipment.findFirst({
      where: {
        tenant: 'TECHNOPRIME',
        OR: candidates.flatMap(value => [
          { externalOrderNumber: value },
          { trackingNumber: value },
          { barcode: value },
        ]),
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!shipment) {
      const externalTracking = await (async () => {
        for (const candidate of candidates) {
          const snapshot = await this.resolveExternalTracking(candidate, hint).catch(() => null);
          if (snapshot) return snapshot;
        }
        return null;
      })();

      const normalizedExternalTracking = externalTracking
        ? {
            provider: externalTracking.provider,
            reference: externalTracking.reference,
            carrierHint: externalTracking.carrierName || externalTracking.carrierCode || null,
            carrier:
              this.mapCarrierHintToShipmentCarrier(
                externalTracking.carrierCode,
                externalTracking.carrierName,
                hint,
              ) || ShipmentCarrier.OTHER,
            statusBucket: externalTracking.statusBucket,
            status: this.mapExternalBucketToShipmentStatus(externalTracking.statusBucket),
            statusLabel:
              externalTracking.statusLabel ||
              (externalTracking.statusBucket === 'UNKNOWN' ? 'НУЖНО ПОДТВЕРДИТЬ' : null),
            senderPoint: externalTracking.senderPoint || null,
            receiverPoint: externalTracking.receiverPoint || null,
            expectedDeliveryAt: externalTracking.expectedDeliveryAt || null,
            events: externalTracking.events.slice(0, 12),
            needsManualVerification:
              externalTracking.provider === 'HEURISTIC' ||
              externalTracking.statusBucket === 'UNKNOWN',
          }
        : null;

      return {
        found: false,
        syncedAccounts,
        shipment: null,
        externalTracking: normalizedExternalTracking,
        message: hint.includes('AVITO')
          ? normalizedExternalTracking
            ? 'Совпадение в CRM не найдено, но номер определён через внешний трекинг.'
            : syncedAccounts
              ? 'Avito синхронизирован, но по этому номеру отправление пока не найдено.'
              : 'Нет подключённых Avito-аккаунтов для автоматической подтяжки.'
          : normalizedExternalTracking
            ? 'Совпадение в CRM не найдено, но номер определён через внешний трекинг.'
            : 'По этому номеру отправление пока не найдено в CRM.',
      };
    }

    return {
      found: true,
      syncedAccounts,
      externalTracking: null,
      shipment: await this.getShipment(shipment.id),
    };
  }

  async upsertShipmentForOrder(orderIdRaw: any, body: any, actorId?: number | null) {
    const orderId = this.safeOrderId(orderIdRaw);
    const carrier = this.enumValue(ShipmentCarrier, body?.carrier, ShipmentCarrier.OTHER);
    const salesChannel = this.enumValue(SalesChannel, body?.salesChannel, SalesChannel.OTHER);
    const status = body?.status
      ? this.enumValue(ShipmentStatus, body.status, ShipmentStatus.AWAITING_SHIPMENT_DATA)
      : this.text(body?.externalOrderNumber) ||
          this.text(body?.trackingNumber) ||
          this.text(body?.barcode)
        ? ShipmentStatus.READY_FOR_HANDOVER
        : ShipmentStatus.AWAITING_SHIPMENT_DATA;
    const settlementStatus = this.enumValue(
      SettlementStatus,
      body?.settlementStatus,
      SettlementStatus.AWAITING_CUSTOMER_RECEIPT,
    );

    return this.prisma.$transaction(async tx => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenant: 'TECHNOPRIME' },
        select: { id: true, status: true },
      });
      if (!order) throw new NotFoundException('Заказ не найден');

      await tx.order.update({
        where: { id: orderId },
        data: {
          salesChannel,
          fulfillmentMethod: FulfillmentMethod.TRANSPORT_COMPANY,
          settlementStatus,
          expectedPayout: this.money(body?.expectedPayout),
          actualPayout: this.money(body?.actualPayout),
          marketplaceCommission: this.money(body?.marketplaceCommission),
          status: order.status === OrderStatus.NEW ? OrderStatus.IN_PROGRESS : order.status,
        },
      });

      const shipment = await tx.shipment.upsert({
        where: { orderId },
        update: {
          carrier,
          status,
          externalOrderNumber: this.text(body?.externalOrderNumber),
          trackingNumber: this.text(body?.trackingNumber),
          barcode: this.text(body?.barcode),
          senderPoint: this.text(body?.senderPoint),
          receiverPoint: this.text(body?.receiverPoint),
          expectedDeliveryAt: this.date(body?.expectedDeliveryAt),
          managerComment: this.text(body?.managerComment),
          customerNote: this.text(body?.customerNote),
        },
        create: {
          orderId,
          carrier,
          status,
          externalOrderNumber: this.text(body?.externalOrderNumber),
          trackingNumber: this.text(body?.trackingNumber),
          barcode: this.text(body?.barcode),
          senderPoint: this.text(body?.senderPoint),
          receiverPoint: this.text(body?.receiverPoint),
          expectedDeliveryAt: this.date(body?.expectedDeliveryAt),
          managerComment: this.text(body?.managerComment),
          customerNote: this.text(body?.customerNote),
        },
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status,
          source: ShipmentSyncMode.MANUAL,
          title: this.statusTitle(status),
          comment: this.text(body?.eventComment) || 'Данные отправления обновлены менеджером',
          createdById: actorId || null,
        },
      });

      await this.setOrderUnitsStatus(tx, orderId, InventoryUnitStatus.HANDOVER_PENDING, {
        onlyStatuses: [InventoryUnitStatus.RESERVED],
      });

      const existingTask = await tx.task.findFirst({
        where: { orderId, type: TaskType.LOGISTICS, status: { not: TaskStatus.DONE } },
        select: { id: true },
      });
      if (!existingTask && actorId) {
        await tx.task.create({
          data: {
            title: `Логистика по заказу #${orderId}`,
            comment: 'Подготовить отправление и передать товар в службу доставки.',
            type: TaskType.LOGISTICS,
            status: TaskStatus.NEW,
            orderId,
            assignedToId: actorId,
            dueDate: new Date(),
          },
        });
      }

      return shipment;
    });
  }

  async updateShipmentStatus(id: number, body: any, actorId?: number | null) {
    const status = this.enumValue(
      ShipmentStatus,
      body?.status,
      ShipmentStatus.AWAITING_SHIPMENT_DATA,
    );
    const comment = this.text(body?.comment);

    return this.prisma.$transaction(async tx => {
      const shipment = await tx.shipment.findFirst({
        where: { id, tenant: 'TECHNOPRIME' },
        include: { order: { select: { id: true } } },
      });
      if (!shipment) throw new NotFoundException('Отправление не найдено');

      const updates = this.statusUpdates(status);
      const updated = await tx.shipment.update({
        where: { id },
        data: {
          status,
          ...(updates.shipment || {}),
          ...(body?.expectedDeliveryAt !== undefined
            ? { expectedDeliveryAt: this.date(body.expectedDeliveryAt) }
            : {}),
          ...(body?.receiverPoint !== undefined
            ? { receiverPoint: this.text(body.receiverPoint) }
            : {}),
          ...(body?.customerNote !== undefined
            ? { customerNote: this.text(body.customerNote) }
            : {}),
        },
      });

      await tx.order.update({
        where: { id: shipment.orderId },
        data: {
          ...(updates.order || {}),
          ...(updates.settlementStatus ? { settlementStatus: updates.settlementStatus } : {}),
        },
      });

      if (updates.inventoryStatus) {
        await this.setOrderUnitsStatus(tx, shipment.orderId, updates.inventoryStatus, {
          clearOrder: updates.clearOrderFromUnits,
        });
      }

      await tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status,
          source: ShipmentSyncMode.MANUAL,
          title: this.statusTitle(status),
          comment,
          createdById: actorId || null,
        },
      });

      return updated;
    });
  }

  async markFundsReceived(id: number, body: any, actorId?: number | null) {
    await this.prisma.$transaction(async tx => {
      const shipment = await tx.shipment.findFirst({
        where: { id, tenant: 'TECHNOPRIME' },
        select: { id: true, orderId: true, status: true },
      });
      if (!shipment) throw new NotFoundException('Отправление не найдено');

      await tx.order.update({
        where: { id: shipment.orderId },
        data: {
          status: OrderStatus.COMPLETED,
          settlementStatus: SettlementStatus.FUNDS_RECEIVED,
          actualPayout: this.money(body?.actualPayout),
        },
      });

      await this.setOrderUnitsStatus(tx, shipment.orderId, InventoryUnitStatus.SOLD, {
        soldAt: new Date(),
      });

      await tx.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: shipment.status,
          source: ShipmentSyncMode.MANUAL,
          title: 'Средства поступили',
          comment: this.text(body?.comment) || 'Менеджер подтвердил поступление средств',
          createdById: actorId || null,
        },
      });
    });

    return this.getShipment(id);
  }

  async createOrderLinkToken(orderIdRaw: any, actorId?: number | null) {
    const orderId = this.safeOrderId(orderIdRaw);
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenant: 'TECHNOPRIME' },
      select: { id: true, shopCustomerId: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.shopCustomerId) {
      throw new BadRequestException('Заказ уже привязан к личному кабинету клиента');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await this.prisma.orderCustomerLinkToken.updateMany({
      where: { orderId, usedAt: null },
      data: { expiresAt: new Date() },
    });

    const created = await this.prisma.orderCustomerLinkToken.create({
      data: {
        orderId,
        token,
        expiresAt,
        createdById: actorId || null,
      },
    });

    return {
      id: created.id,
      orderId,
      token,
      expiresAt,
      url: `${String(process.env.SHOP_PUBLIC_URL || 'https://technoprimestore.ru').replace(/\/$/, '')}/order-link/${token}`,
    };
  }

  async claimOrderByToken(tokenRaw: string, shopCustomerId?: number | null) {
    const token = this.text(tokenRaw);
    if (!token) throw new BadRequestException('Ссылка привязки некорректна');
    if (!shopCustomerId)
      throw new ForbiddenException('Войдите в личный кабинет, чтобы привязать заказ');

    return this.prisma.$transaction(async tx => {
      const link = await tx.orderCustomerLinkToken.findUnique({
        where: { token },
        include: { order: { select: { id: true, shopCustomerId: true } } },
      });
      if (!link) throw new NotFoundException('Ссылка привязки не найдена');
      if (link.usedAt || link.shopCustomerId) {
        throw new BadRequestException('Ссылка уже использована');
      }
      if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException('Срок действия ссылки истёк');
      }
      if (link.order.shopCustomerId && link.order.shopCustomerId !== shopCustomerId) {
        throw new BadRequestException('Заказ уже привязан к другому личному кабинету');
      }

      await tx.order.update({
        where: { id: link.orderId },
        data: { shopCustomerId },
      });
      await tx.orderCustomerLinkToken.update({
        where: { id: link.id },
        data: { usedAt: new Date(), shopCustomerId },
      });

      return { success: true, orderId: link.orderId };
    });
  }

  async listMarketplaceAccounts() {
    const accounts = await this.prisma.marketplaceAccount.findMany({
      where: { tenant: 'TECHNOPRIME' },
      include: { connectedBy: { select: { id: true, name: true, login: true } } },
      orderBy: [{ status: 'asc' }, { id: 'desc' }],
    });
    return accounts.map(account => this.mapMarketplaceAccount(account));
  }

  async listMarketplaceOverview() {
    const accounts = await this.prisma.marketplaceAccount.findMany({
      where: { tenant: 'TECHNOPRIME' },
      select: {
        id: true,
        platform: true,
        displayName: true,
        authType: true,
        status: true,
        externalAccountId: true,
        expiresAt: true,
        lastSyncAt: true,
        lastSyncError: true,
        disconnectedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ status: 'asc' }, { id: 'desc' }],
    });

    const items = accounts.map(account => ({
      id: account.id,
      platform: account.platform,
      displayName: account.displayName,
      authType: account.authType,
      status: account.status,
      externalAccountId: account.externalAccountId,
      expiresAt: account.expiresAt,
      lastSyncAt: account.lastSyncAt,
      lastSyncError: account.lastSyncError,
      disconnectedAt: account.disconnectedAt,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    }));

    return {
      items,
      total: items.length,
      success: true,
    };
  }

  async syncMarketplaceAccount(id: number, actor: Actor) {
    this.ensureStaffAccess(actor);

    const account = await this.prisma.marketplaceAccount.findFirst({
      where: { id, tenant: 'TECHNOPRIME' },
      select: { id: true, platform: true },
    });
    if (!account) {
      throw new NotFoundException('Аккаунт площадки не найден');
    }

    if (account.platform === MarketplacePlatform.AVITO) {
      this.invalidateAvitoCache('avito:');
      return this.syncAvitoAccount(account.id, actor?.id);
    }

    throw new BadRequestException('Для этой площадки синхронизация заказов ещё не реализована');
  }

  async listConnectedAvitoAccounts() {
    const cacheKey = 'avito:connected-accounts';
    const cached = this.getCachedAvitoValue<any[]>(cacheKey);
    if (cached) return cached;

    const pending = this.getCachedAvitoPromise<any[]>(cacheKey);
    if (pending) return pending;

    const request = this.prisma.marketplaceAccount
      .findMany({
        where: {
          tenant: 'TECHNOPRIME',
          platform: MarketplacePlatform.AVITO,
          status: MarketplaceAccountStatus.CONNECTED,
          disconnectedAt: null,
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          displayName: true,
          externalAccountId: true,
          clientId: true,
          status: true,
          expiresAt: true,
          lastSyncAt: true,
          lastSyncError: true,
          accessTokenEncrypted: true,
          apiKeyEncrypted: true,
        },
      })
      .then(accounts =>
        accounts
          .map(account => {
            const state = this.avitoCredentialState(account);
            return {
              id: account.id,
              displayName: account.displayName,
              externalAccountId: account.externalAccountId,
              status: account.status,
              expiresAt: account.expiresAt,
              lastSyncAt: account.lastSyncAt,
              lastSyncError: account.lastSyncError,
              requiresReconnect: state.requiresReconnect,
              connectionHint: state.message,
              hasLiveAccessToken: state.hasLiveAccessToken,
            };
          })
          .sort((left, right) => {
            const leftHealthy = !left.requiresReconnect;
            const rightHealthy = !right.requiresReconnect;
            if (leftHealthy && !rightHealthy) return -1;
            if (!leftHealthy && rightHealthy) return 1;
            return 0;
          }),
      )
      .then(result => {
        this.setCachedAvitoValue(cacheKey, this.avitoAccountListCacheTtlMs, result);
        return result;
      })
      .catch(error => {
        this.avitoRequestCache.delete(cacheKey);
        throw error;
      });

    this.setCachedAvitoPromise(cacheKey, request);
    return request;
  }

  async listPinnedAvitoChats(accountId: number, actor: Actor) {
    this.ensureStaffAccess(actor);
    const actorId = this.requireActorId(actor);
    const account = await this.findAvitoAccountOrThrow(accountId);
    const rows = await this.getPinnedAvitoChats(actorId, account.id);
    return {
      account: {
        id: account.id,
        displayName: account.displayName,
      },
      limit: this.avitoPinnedChatsLimit,
      count: rows.length,
      items: rows.map(row => ({
        chatId: row.chatId,
        pinnedAt: row.createdAt,
      })),
    };
  }

  async pinAvitoChat(accountId: number, chatIdRaw: string, actor: Actor) {
    this.ensureStaffAccess(actor);
    const actorId = this.requireActorId(actor);
    const account = await this.findAvitoAccountOrThrow(accountId);
    const chatId = String(chatIdRaw || '').trim();
    if (!chatId) {
      throw new BadRequestException('Не указан chatId для закрепления');
    }

    const existingRows = await this.getPinnedAvitoChats(actorId, account.id);
    if (existingRows.some(row => row.chatId === chatId)) {
      return {
        success: true,
        pinned: true,
        chatId,
        count: existingRows.length,
        limit: this.avitoPinnedChatsLimit,
      };
    }

    if (existingRows.length >= this.avitoPinnedChatsLimit) {
      throw new BadRequestException(
        `Можно закрепить не более ${this.avitoPinnedChatsLimit} диалогов`,
      );
    }

    try {
      await this.prisma.employeePinnedChat.create({
        data: {
          employeeId: actorId,
          platform: MarketplacePlatform.AVITO,
          marketplaceAccountId: account.id,
          chatId,
        },
      });
    } catch (error) {
      throw new BadRequestException(
        'Закрепы пока недоступны: миграции БД не применены. Примените миграции и повторите.',
      );
    }

    this.invalidateAvitoCache(`avito:chats:${account.id}:actor:${actorId}:`);

    return {
      success: true,
      pinned: true,
      chatId,
      count: existingRows.length + 1,
      limit: this.avitoPinnedChatsLimit,
    };
  }

  async unpinAvitoChat(accountId: number, chatIdRaw: string, actor: Actor) {
    this.ensureStaffAccess(actor);
    const actorId = this.requireActorId(actor);
    const account = await this.findAvitoAccountOrThrow(accountId);
    const chatId = String(chatIdRaw || '').trim();
    if (!chatId) {
      throw new BadRequestException('Не указан chatId для снятия закрепа');
    }

    let result: { count: number };
    let count = 0;
    try {
      result = await this.prisma.employeePinnedChat.deleteMany({
        where: {
          employeeId: actorId,
          platform: MarketplacePlatform.AVITO,
          marketplaceAccountId: account.id,
          chatId,
        },
      });

      count = await this.prisma.employeePinnedChat.count({
        where: {
          employeeId: actorId,
          platform: MarketplacePlatform.AVITO,
          marketplaceAccountId: account.id,
        },
      });
    } catch (error) {
      throw new BadRequestException(
        'Закрепы пока недоступны: миграции БД не применены. Примените миграции и повторите.',
      );
    }

    this.invalidateAvitoCache(`avito:chats:${account.id}:actor:${actorId}:`);

    return {
      success: true,
      pinned: false,
      chatId,
      removed: result.count,
      count,
      limit: this.avitoPinnedChatsLimit,
    };
  }

  async listAvitoChats(accountId: number, query: any, actor: Actor) {
    this.ensureStaffAccess(actor);
    const actorId = this.requireActorId(actor);
    const account = await this.findAvitoAccountOrThrow(accountId);
    const userId = await this.ensureAvitoSelfAccountId(account);
    const limit = this.parsePositiveInt(query?.limit, 50, 1, 100);
    const offset = this.parsePositiveInt(query?.offset, 0, 0, 1000);
    const unreadOnly = String(query?.unreadOnly || '').toLowerCase() === 'true';
    const live = ['1', 'true', 'yes'].includes(String(query?.live || '').toLowerCase());
    const cacheKey =
      `avito:chats:${account.id}:actor:${actorId}:${limit}:${offset}:` +
      `${unreadOnly ? 'unread' : 'all'}:${live ? 'live' : 'cached'}`;
    if (!live) {
      const cached = this.getCachedAvitoValue<any>(cacheKey);
      if (cached) return cached;
    }

    const pending = this.getCachedAvitoPromise<any>(cacheKey);
    if (pending) return pending;

    const request = this.fetchMappedAvitoChatsPage(account, userId, {
      limit,
      offset,
      unreadOnly,
    })
      .then(async payload => {
        const pinnedRows = await this.getPinnedAvitoChats(actorId, account.id);
        const mapped = [...payload];

        // Keep pinned dialogs visible on the first screen even if they are old and outside first Avito page.
        if (!unreadOnly && offset === 0 && pinnedRows.length) {
          const knownIds = new Set(mapped.map(chat => String(chat.id)));
          const pinnedIds = pinnedRows.map(row => String(row.chatId));
          const maxExtraPages = 8;
          let nextOffset = limit;
          let page = 0;

          while (pinnedIds.some(id => !knownIds.has(id)) && page < maxExtraPages) {
            page += 1;
            const extra = await this.fetchMappedAvitoChatsPage(account, userId, {
              limit,
              offset: nextOffset,
              unreadOnly: false,
            });
            if (!extra.length) break;

            for (const chat of extra) {
              const chatId = String(chat.id);
              if (!knownIds.has(chatId)) {
                knownIds.add(chatId);
                mapped.push(chat);
              }
            }

            if (extra.length < limit) break;
            nextOffset += limit;
          }
        }

        const result = {
          account: {
            id: account.id,
            displayName: account.displayName,
            externalAccountId: userId,
          },
          pinnedCount: pinnedRows.length,
          pinnedLimit: this.avitoPinnedChatsLimit,
          items: this.withPinnedAvitoMeta(mapped, pinnedRows),
        };
        if (!live) {
          this.setCachedAvitoValue(cacheKey, this.avitoChatsCacheTtlMs, result);
        } else {
          this.avitoRequestCache.delete(cacheKey);
        }
        return result;
      })
      .catch(error => {
        this.avitoRequestCache.delete(cacheKey);
        throw error;
      });

    this.setCachedAvitoPromise(cacheKey, request);
    return request;
  }

  async listAvitoChatMessages(accountId: number, chatId: string, query: any, actor: Actor) {
    this.ensureStaffAccess(actor);
    const account = await this.findAvitoAccountOrThrow(accountId);
    const userId = await this.ensureAvitoSelfAccountId(account);
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId) {
      throw new BadRequestException('Не указан chatId');
    }
    const limit = this.parsePositiveInt(query?.limit, 100, 1, 100);
    const offset = this.parsePositiveInt(query?.offset, 0, 0, 1000);
    const live = ['1', 'true', 'yes'].includes(String(query?.live || '').toLowerCase());
    const cacheKey = `avito:messages:${account.id}:${normalizedChatId}:${limit}:${offset}:${live ? 'live' : 'cached'}`;
    if (!live) {
      const cached = this.getCachedAvitoValue<any>(cacheKey);
      if (cached) return cached;
    }

    const pending = this.getCachedAvitoPromise<any>(cacheKey);
    if (pending) return pending;

    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String(offset));

    const request = this.fetchAvitoJson(
      account,
      `/messenger/v3/accounts/${encodeURIComponent(userId)}/chats/${encodeURIComponent(normalizedChatId)}/messages/?${params.toString()}`,
    )
      .then(async payload => {
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.messages)
            ? payload.messages
            : [];
        const mappedItems = items
          .map((message: AvitoRemoteMessage) => this.mapAvitoMessage(message))
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const hiddenIds = await this.getHiddenAvitoMessageIds(account.id, normalizedChatId);
        const visibleItems = hiddenIds.size
          ? mappedItems.filter(message => !hiddenIds.has(String(message.id || '')))
          : mappedItems;
        const result = {
          account: {
            id: account.id,
            displayName: account.displayName,
            externalAccountId: userId,
          },
          hasMore: items.length >= limit,
          nextOffset: offset + items.length,
          hiddenCount: mappedItems.length - visibleItems.length,
          items: visibleItems,
        };
        if (!live) {
          this.setCachedAvitoValue(cacheKey, this.avitoMessagesCacheTtlMs, result);
        } else {
          this.avitoRequestCache.delete(cacheKey);
        }
        return result;
      })
      .catch(error => {
        this.avitoRequestCache.delete(cacheKey);
        throw error;
      });

    this.setCachedAvitoPromise(cacheKey, request);
    return request;
  }

  async deleteAvitoChatMessage(
    accountId: number,
    chatIdRaw: string,
    messageIdRaw: string,
    actor: Actor,
  ) {
    this.ensureStaffAccess(actor);
    const actorId = this.requireActorId(actor);
    const account = await this.findAvitoAccountOrThrow(accountId);
    const userId = await this.ensureAvitoSelfAccountId(account);
    const chatId = String(chatIdRaw || '').trim();
    const messageId = String(messageIdRaw || '').trim();

    if (!chatId || !messageId) {
      throw new BadRequestException('Не указан чат или сообщение для удаления');
    }

    const direction = await this.findAvitoMessageDirection(account, userId, chatId, messageId);
    if (direction !== 'out') {
      throw new BadRequestException('Удалять можно только исходящие сообщения менеджера');
    }

    await this.deleteAvitoMessageRemotely(account, userId, chatId, messageId);
    await this.hideAvitoMessageLocally(account.id, chatId, messageId, actorId);

    await this.prisma.auditLog
      .create({
        data: {
          userId: actorId,
          tenant: 'TECHNOPRIME',
          action: 'AVITO_CHAT_MESSAGE_DELETED',
          entityType: 'AVITO_CHAT',
          entityId: account.id,
          newData: {
            accountId: account.id,
            chatId,
            chatKey: `avito:${account.id}:${chatId}`,
            messageId,
            deletedAt: new Date().toISOString(),
            hiddenInCrm: true,
          } as any,
        },
      })
      .catch(() => undefined);

    this.invalidateAvitoCache(`avito:messages:${account.id}:${chatId}:`);
    this.invalidateAvitoCache(`avito:chats:${account.id}:`);

    return {
      success: true,
      deleted: true,
      hiddenInCrm: true,
      chatId,
      messageId,
    };
  }

  async sendAvitoChatMessage(
    accountId: number,
    chatId: string,
    body: any,
    files: any[],
    actor: Actor,
  ) {
    this.ensureStaffAccess(actor);
    const account = await this.findAvitoAccountOrThrow(accountId);
    const userId = await this.ensureAvitoSelfAccountId(account);
    const text = String(body?.text || '').trim();
    const imageFile = Array.isArray(files) ? files[0] : null;

    if (!text && !imageFile) {
      throw new BadRequestException('Введите текст сообщения или добавьте изображение');
    }

    const sentMessages: Array<Record<string, any>> = [];

    if (imageFile?.buffer?.byteLength) {
      const mime = String(imageFile.mimetype || '').toLowerCase();
      const allowed = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/heic',
        'image/heif',
      ];
      if (!allowed.includes(mime)) {
        throw new BadRequestException('Avito поддерживает JPEG, PNG, GIF, BMP и HEIC изображения');
      }
      if (Number(imageFile.size || imageFile.buffer.byteLength || 0) > 24 * 1024 * 1024) {
        throw new BadRequestException('Размер изображения не должен превышать 24 МБ');
      }

      const formData = new FormData();
      formData.append(
        'uploadfile[]',
        new Blob([imageFile.buffer], { type: mime || 'application/octet-stream' }),
        imageFile.originalname || 'image',
      );

      const uploadPayload = await this.fetchAvitoJson(
        account,
        `/messenger/v1/accounts/${encodeURIComponent(userId)}/uploadImages`,
        {
          method: 'POST',
          body: formData,
        },
      );

      const imageId = Object.keys(uploadPayload || {})[0];
      if (!imageId) {
        throw new InternalServerErrorException(
          'Avito не вернул идентификатор загруженного изображения',
        );
      }

      const imagePayload = await this.fetchAvitoJson(
        account,
        `/messenger/v1/accounts/${encodeURIComponent(userId)}/chats/${encodeURIComponent(chatId)}/messages/image`,
        {
          method: 'POST',
          body: JSON.stringify({
            image_id: imageId,
          }),
        },
      );

      sentMessages.push(this.mapAvitoMessage(imagePayload));
    }

    if (text) {
      const payload = await this.fetchAvitoJson(
        account,
        `/messenger/v1/accounts/${encodeURIComponent(userId)}/chats/${encodeURIComponent(chatId)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({
            type: 'text',
            message: { text: text.slice(0, 1000) },
          }),
        },
      );

      sentMessages.push(this.mapAvitoMessage(payload));
    }

    if (actor?.id && sentMessages.length) {
      const latest = sentMessages[sentMessages.length - 1];
      await this.prisma.auditLog
        .create({
          data: {
            userId: Number(actor.id),
            tenant: 'TECHNOPRIME',
            action: 'AVITO_CHAT_REPLY_SENT',
            entityType: 'AVITO_CHAT',
            entityId: account.id,
            newData: {
              accountId: account.id,
              chatId,
              chatKey: `avito:${account.id}:${chatId}`,
              messageId: latest?.id || null,
              sentAt: latest?.createdAt || new Date().toISOString(),
            } as any,
          },
        })
        .catch(() => undefined);
    }

    this.invalidateAvitoCache(`avito:messages:${account.id}:${chatId}:`);
    this.invalidateAvitoCache(`avito:chats:${account.id}:`);
    this.invalidateAvitoCache('avito:connected-accounts');

    return {
      success: true,
      messages: sentMessages,
      message: sentMessages[sentMessages.length - 1] || null,
    };
  }

  private buildAvitoLiveChatKey(chat: ReturnType<LogisticsService['mapAvitoChat']>) {
    return [
      chat.lastMessage?.id || '',
      chat.lastMessage?.createdAt || '',
      chat.lastMessage?.text || '',
      chat.unreadCount || 0,
    ].join(':');
  }

  private cleanupAvitoLiveLogKeys() {
    const threshold = Date.now() - 3 * 24 * 60 * 60 * 1000;
    for (const [key, timestamp] of this.avitoLiveLoggedMessageKeys.entries()) {
      if (timestamp < threshold) {
        this.avitoLiveLoggedMessageKeys.delete(key);
      }
    }
  }

  private async logAvitoIncomingForAnalytics(
    accountId: number,
    chat: ReturnType<LogisticsService['mapAvitoChat']>,
  ) {
    const messageId = String(chat.lastMessage?.id || '').trim();
    const chatId = String(chat.id || '').trim();
    if (!messageId || !chatId) return;

    const dedupeKey = `${accountId}:${chatId}:${messageId}`;
    if (this.avitoLiveLoggedMessageKeys.has(dedupeKey)) {
      return;
    }

    this.cleanupAvitoLiveLogKeys();
    this.avitoLiveLoggedMessageKeys.set(dedupeKey, Date.now());

    const messageAt = chat.lastMessage?.createdAt
      ? new Date(chat.lastMessage.createdAt)
      : new Date();
    if (Number.isNaN(messageAt.getTime())) return;

    await this.prisma.auditLog
      .create({
        data: {
          userId: null,
          tenant: 'TECHNOPRIME',
          action: 'AVITO_CHAT_INCOMING',
          entityType: 'AVITO_CHAT',
          entityId: accountId,
          newData: {
            accountId,
            chatId,
            chatKey: `avito:${accountId}:${chatId}`,
            messageId,
            direction: chat.lastMessage?.direction || 'in',
            messageAt,
          } as any,
        },
      })
      .catch(() => undefined);
  }

  private async listAvitoLiveRecipients() {
    return this.prisma.employee.findMany({
      where: {
        isActive: true,
        role: {
          in: [Role.SUPER_ADMIN, Role.ADMIN, Role.MANAGER],
        },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
    });
  }

  private async notifyAvitoIncomingMessage(
    account: {
      id: number;
      displayName: string;
    },
    chat: ReturnType<LogisticsService['mapAvitoChat']>,
    recipients: Array<{ id: number }>,
  ) {
    const title = `Avito: ${account.displayName}`;
    const text = `${chat.counterpart.name}: ${chat.lastMessage?.text || 'Новое сообщение'}`;
    const href = '/communication-center?tab=avito';
    const payload = {
      title,
      text,
      href,
      source: 'avito-live',
      accountId: account.id,
      chatId: chat.id,
    };

    await Promise.all(
      recipients.map(async recipient => {
        const created = await this.notifications.push(recipient.id, 'AVITO_MESSAGE', payload);

        this.events.notifyUser(recipient.id, 'notification', {
          id: created.id,
          type: 'AVITO_MESSAGE',
          ...payload,
          createdAt: created.createdAt,
        });

        await this.notifications.sendWebPushToUser(recipient.id, {
          title,
          body: text,
          href,
          tag: `avito-chat-${account.id}-${chat.id}`,
          data: {
            href,
            source: 'avito-live',
            accountId: account.id,
            chatId: chat.id,
          },
        });
      }),
    );
  }

  @Cron('0 */15 * * * *')
  async syncExternalTrackingStatusesInBackground() {
    if (this.externalTrackingSyncRunning) return;
    if (!this.tracktryApiKey()) return;

    this.externalTrackingSyncRunning = true;
    try {
      const activeStatuses: ShipmentStatus[] = [
        ShipmentStatus.AWAITING_SHIPMENT_DATA,
        ShipmentStatus.READY_FOR_HANDOVER,
        ShipmentStatus.HANDED_TO_CARRIER,
        ShipmentStatus.IN_TRANSIT,
        ShipmentStatus.ARRIVED_AT_PICKUP_POINT,
        ShipmentStatus.AWAITING_CUSTOMER_PICKUP,
        ShipmentStatus.RETURN_IN_TRANSIT,
      ];

      const shipments = await this.prisma.shipment.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          status: { in: activeStatuses },
          OR: [
            { trackingNumber: { not: null } },
            { barcode: { not: null } },
            { externalOrderNumber: { not: null } },
          ],
        },
        select: {
          id: true,
          status: true,
          carrier: true,
          trackingNumber: true,
          barcode: true,
          externalOrderNumber: true,
          senderPoint: true,
          receiverPoint: true,
          expectedDeliveryAt: true,
        },
        take: 80,
        orderBy: { updatedAt: 'asc' },
      });

      for (const shipment of shipments) {
        const reference =
          this.text(shipment.trackingNumber) ||
          this.text(shipment.barcode) ||
          this.text(shipment.externalOrderNumber);
        if (!reference) continue;

        const tracking = await this.resolveExternalTracking(reference, shipment.carrier).catch(
          () => null,
        );
        if (!tracking || tracking.provider !== 'TRACKTRY') {
          continue;
        }

        const nextStatus = this.mapExternalBucketToShipmentStatus(tracking.statusBucket);
        const nextExpectedAt = this.date(tracking.expectedDeliveryAt);
        const nextSender = this.text(tracking.senderPoint);
        const nextReceiver = this.text(tracking.receiverPoint);

        const statusChanged = shipment.status !== nextStatus;
        const senderChanged = Boolean(nextSender && nextSender !== this.text(shipment.senderPoint));
        const receiverChanged = Boolean(
          nextReceiver && nextReceiver !== this.text(shipment.receiverPoint),
        );
        const expectedChanged =
          Boolean(nextExpectedAt) &&
          (shipment.expectedDeliveryAt?.toISOString() || null) !==
            (nextExpectedAt?.toISOString() || null);

        if (!statusChanged && !senderChanged && !receiverChanged && !expectedChanged) {
          continue;
        }

        await this.prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            ...(statusChanged ? { status: nextStatus } : {}),
            ...(senderChanged ? { senderPoint: nextSender } : {}),
            ...(receiverChanged ? { receiverPoint: nextReceiver } : {}),
            ...(expectedChanged ? { expectedDeliveryAt: nextExpectedAt } : {}),
            lastSyncedAt: new Date(),
            syncMode: ShipmentSyncMode.API,
          },
        });

        await this.prisma.shipmentEvent.create({
          data: {
            tenant: 'TECHNOPRIME',
            shipmentId: shipment.id,
            status: statusChanged ? nextStatus : shipment.status,
            source: ShipmentSyncMode.API,
            title: statusChanged
              ? 'Статус обновлён автоматически по номеру отправления'
              : 'Данные отправления уточнены автоматически',
            comment:
              tracking.statusLabel ||
              tracking.events[0]?.status ||
              `Внешний трекинг: ${tracking.carrierName || tracking.carrierCode || 'перевозчик'}`,
            rawPayload: tracking as any,
          },
        });
      }
    } finally {
      this.externalTrackingSyncRunning = false;
    }
  }

  @Cron('0 */5 * * * *')
  async syncAvitoShipmentsInBackground() {
    if (this.avitoShipmentSyncRunning) return;

    this.avitoShipmentSyncRunning = true;
    try {
      const syncThreshold = new Date(Date.now() - 3 * 60 * 1000);
      const accounts = await this.prisma.marketplaceAccount.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          platform: MarketplacePlatform.AVITO,
          status: MarketplaceAccountStatus.CONNECTED,
          disconnectedAt: null,
          OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: syncThreshold } }],
        },
        select: {
          id: true,
          lastSyncError: true,
        },
        orderBy: { id: 'asc' },
      });

      for (const account of accounts) {
        if (this.isAvitoBusinessDeliveryRestriction(account.lastSyncError)) {
          continue;
        }
        try {
          await this.syncAvitoAccount(account.id);
        } catch (error: any) {
          this.logger.warn(
            `Background Avito shipment sync failed for account ${account.id}: ${String(error?.message || error)}`,
          );
        }
      }
    } finally {
      this.avitoShipmentSyncRunning = false;
    }
  }

  @Cron('*/30 * * * * *')
  async pollAvitoIncomingNotifications() {
    if (this.avitoLivePollRunning) return;

    this.avitoLivePollRunning = true;
    try {
      const accounts = await this.prisma.marketplaceAccount.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          platform: MarketplacePlatform.AVITO,
          status: MarketplaceAccountStatus.CONNECTED,
          disconnectedAt: null,
        },
        orderBy: { id: 'asc' },
      });

      if (!accounts.length) return;

      const recipients = await this.listAvitoLiveRecipients();
      if (!recipients.length) return;

      const seenKeys = new Set<string>();

      for (const account of accounts) {
        try {
          const state = this.avitoCredentialState(account);
          if (state.requiresReconnect) {
            continue;
          }

          const userId = await this.ensureAvitoSelfAccountId(account);
          const params = new URLSearchParams();
          params.set('limit', '20');
          params.set('offset', '0');
          params.set('chat_types', 'u2i');

          const payload = await this.fetchAvitoJson(
            account,
            `/messenger/v2/accounts/${encodeURIComponent(userId)}/chats?${params.toString()}`,
          );

          const chats = (Array.isArray(payload?.chats) ? payload.chats : []).map(
            (chat: AvitoRemoteChat) => this.mapAvitoChat(chat, userId),
          );

          for (const chat of chats) {
            const storageKey = `${account.id}:${chat.id}`;
            const nextKey = this.buildAvitoLiveChatKey(chat);
            const previousKey = this.avitoLiveKnownChats.get(storageKey);

            if (
              this.avitoLivePrimed &&
              previousKey &&
              previousKey !== nextKey &&
              chat.lastMessage?.direction !== 'out'
            ) {
              await this.logAvitoIncomingForAnalytics(account.id, chat);
              await this.notifyAvitoIncomingMessage(account, chat, recipients);
            }

            this.avitoLiveKnownChats.set(storageKey, nextKey);
            seenKeys.add(storageKey);
          }
        } catch (error: any) {
          this.logger.warn(
            `Avito live poll failed for account ${account.id}: ${String(error?.message || error)}`,
          );
        }
      }

      for (const key of Array.from(this.avitoLiveKnownChats.keys())) {
        if (!seenKeys.has(key)) {
          this.avitoLiveKnownChats.delete(key);
        }
      }

      this.avitoLivePrimed = true;
    } finally {
      this.avitoLivePollRunning = false;
    }
  }

  async createMarketplaceAccount(body: any, actor: Actor) {
    if (actor?.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Подключать площадки может только супер-админ');
    }
    const platform = this.enumValue(MarketplacePlatform, body?.platform, MarketplacePlatform.AVITO);
    const authType = this.enumValue(
      MarketplaceAuthType,
      body?.authType,
      MarketplaceAuthType.MANUAL,
    );
    const displayName = this.text(body?.displayName);
    if (!displayName) throw new BadRequestException('Укажите название аккаунта');

    const account = await this.prisma.marketplaceAccount.create({
      data: {
        platform,
        displayName,
        authType,
        status: MarketplaceAccountStatus.CONNECTED,
        externalAccountId: this.text(body?.externalAccountId),
        clientId: this.text(body?.clientId),
        scopes: this.text(body?.scopes),
        accessTokenEncrypted: this.encryptSecret(body?.accessToken),
        refreshTokenEncrypted: this.encryptSecret(body?.refreshToken),
        apiKeyEncrypted: this.encryptSecret(body?.apiKey),
        expiresAt: this.date(body?.expiresAt),
        connectedById: actor?.id || null,
      },
      include: { connectedBy: { select: { id: true, name: true, login: true } } },
    });

    this.invalidateAvitoCache('avito:');
    return this.mapMarketplaceAccount(account);
  }

  async updateMarketplaceAccount(id: number, body: any, actor: Actor) {
    if (actor?.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Изменять площадки может только супер-админ');
    }
    const account = await this.prisma.marketplaceAccount.findFirst({
      where: { id, tenant: 'TECHNOPRIME' },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Аккаунт площадки не найден');

    const updated = await this.prisma.marketplaceAccount.update({
      where: { id },
      data: {
        ...(body?.displayName !== undefined
          ? { displayName: this.text(body.displayName) || 'Аккаунт' }
          : {}),
        ...(body?.authType
          ? {
              authType: this.enumValue(
                MarketplaceAuthType,
                body.authType,
                MarketplaceAuthType.MANUAL,
              ),
            }
          : {}),
        ...(body?.externalAccountId !== undefined
          ? { externalAccountId: this.text(body.externalAccountId) }
          : {}),
        ...(body?.clientId !== undefined ? { clientId: this.text(body.clientId) } : {}),
        ...(body?.scopes !== undefined ? { scopes: this.text(body.scopes) } : {}),
        ...(body?.accessToken !== undefined
          ? { accessTokenEncrypted: this.encryptSecret(body.accessToken) }
          : {}),
        ...(body?.refreshToken !== undefined
          ? { refreshTokenEncrypted: this.encryptSecret(body.refreshToken) }
          : {}),
        ...(body?.apiKey !== undefined ? { apiKeyEncrypted: this.encryptSecret(body.apiKey) } : {}),
        ...(body?.expiresAt !== undefined ? { expiresAt: this.date(body.expiresAt) } : {}),
        ...(body?.status
          ? {
              status: this.enumValue(
                MarketplaceAccountStatus,
                body.status,
                MarketplaceAccountStatus.CONNECTED,
              ),
              disconnectedAt:
                this.enumValue(
                  MarketplaceAccountStatus,
                  body.status,
                  MarketplaceAccountStatus.CONNECTED,
                ) === MarketplaceAccountStatus.DISCONNECTED
                  ? new Date()
                  : null,
            }
          : {}),
        ...((body?.accessToken !== undefined ||
          body?.refreshToken !== undefined ||
          body?.apiKey !== undefined) &&
        actor?.id
          ? { connectedById: actor.id }
          : {}),
      },
      include: { connectedBy: { select: { id: true, name: true, login: true } } },
    });
    this.invalidateAvitoCache('avito:');
    return this.mapMarketplaceAccount(updated);
  }

  async disconnectMarketplaceAccount(id: number, actor: Actor) {
    if (actor?.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Отключать площадки может только супер-админ');
    }
    const account = await this.prisma.marketplaceAccount.findFirst({
      where: { id, tenant: 'TECHNOPRIME' },
      select: { id: true },
    });
    if (!account) throw new NotFoundException('Аккаунт площадки не найден');

    const updated = await this.prisma.marketplaceAccount.update({
      where: { id },
      data: {
        status: MarketplaceAccountStatus.DISCONNECTED,
        disconnectedAt: new Date(),
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        apiKeyEncrypted: null,
      },
      include: { connectedBy: { select: { id: true, name: true, login: true } } },
    });
    this.invalidateAvitoCache('avito:');
    return this.mapMarketplaceAccount(updated);
  }
}
