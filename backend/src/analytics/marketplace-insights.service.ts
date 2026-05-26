import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  MarketplacePlatform,
  MarketplaceAccountStatus,
  OrderStatus,
  Prisma,
  SalesChannel,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { LogisticsService } from '../logistics/logistics.service';

function normalizeDateInput(input?: string | Date | null) {
  if (input === undefined || input === null || input === '') return null;
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function startOfUtcDay(input?: string | Date | null) {
  const date = normalizeDateInput(input);
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
}

function endOfUtcDay(input?: string | Date | null) {
  const date = normalizeDateInput(input);
  if (!date) return null;
  if (Number.isNaN(date.getTime())) return null;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59),
  );
}

function rangeOrDefault(from?: string, to?: string, days?: string | number) {
  const gte = startOfUtcDay(from);
  const lte = endOfUtcDay(to);
  if (gte && lte) return { from: gte, to: lte };
  const requestedDays = Number(days);
  const windowDays =
    Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.min(Math.floor(requestedDays), 180)
      : 30;
  const now = new Date();
  const past = new Date(now);
  past.setUTCDate(past.getUTCDate() - (windowDays - 1));
  return {
    from: startOfUtcDay(past)!,
    to: endOfUtcDay(now)!,
  };
}

function money(value: Prisma.Decimal | number | string | null | undefined) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

function serviceTitle(value: unknown) {
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
      candidate.code ||
        candidate.vas_id ||
        candidate.vasId ||
        candidate.service_id ||
        candidate.serviceId ||
        candidate.slug ||
        '',
    )
      .trim()
      .toLowerCase();
    return String(
      candidate.title ||
        candidate.type ||
        (code ? labels[code] || `Услуга ${code}` : null) ||
        'Продвижение',
    );
  }
  return 'Продвижение';
}

function operationMoneyValue(row: {
  amountRub?: Prisma.Decimal | number | string | null;
  amountTotal?: Prisma.Decimal | number | string | null;
}) {
  const rub = money(row.amountRub);
  if (rub !== 0) return rub;
  return money(row.amountTotal);
}

function operationAbsAmount(row: {
  amountRub?: Prisma.Decimal | number | string | null;
  amountTotal?: Prisma.Decimal | number | string | null;
}) {
  return Math.abs(operationMoneyValue(row));
}

function operationSignedAmount(row: {
  amountRub?: Prisma.Decimal | number | string | null;
  amountTotal?: Prisma.Decimal | number | string | null;
}) {
  return operationMoneyValue(row);
}

function operationText(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isExpenseOperation(row: {
  operationType?: string | null;
  operationName?: string | null;
  serviceType?: string | null;
  serviceName?: string | null;
  itemExternalId?: string | null;
  amountRub?: Prisma.Decimal | number | string | null;
  amountTotal?: Prisma.Decimal | number | string | null;
  payload?: Prisma.JsonValue | Record<string, unknown> | null;
}) {
  const type = operationText(row.operationType);
  const name = operationText(row.operationName);
  const serviceType = operationText(row.serviceType);
  const serviceName = operationText(row.serviceName);
  const signedAmount = operationSignedAmount(row);
  const payloadText = operationText(
    row.payload && typeof row.payload === 'object' ? JSON.stringify(row.payload) : '',
  );

  if (/резервирован|списан|списание|удержан|оплата услуги/.test(type)) return true;
  if (/(write[\s_-]?off|charge|debit|expense|reserved|hold|withdraw)/.test(type)) return true;
  if (
    /(услуга|продвижение|выделить|xl|xxl|vip|пакет продвижения|turbo|турбо|размещени|подняти|премиум|пакет)/.test(
      name,
    )
  )
    return true;
  if (/(bbip|vas|promotion|promo)/.test(serviceType)) return true;
  if (/(продвижение|выдел|xl|xxl|vip|премиум|пакет|размещени|поднят)/.test(serviceName))
    return true;
  if (/(продвижение|выдел|xl|xxl|vip|premium|bbip|vas|turbo|raise|пакет)/.test(payloadText))
    return true;
  if (signedAmount < 0) return true;
  if (signedAmount > 0 && row.itemExternalId && (serviceType || serviceName || name || type))
    return true;
  return false;
}

function isRefundOperation(row: {
  operationType?: string | null;
  operationName?: string | null;
  payload?: Prisma.JsonValue | Record<string, unknown> | null;
}) {
  const type = operationText(row.operationType);
  const name = operationText(row.operationName);
  const payloadText = operationText(
    row.payload && typeof row.payload === 'object' ? JSON.stringify(row.payload) : '',
  );
  return (
    /возврат|refund|return/.test(type) ||
    /возврат|refund|return/.test(name) ||
    /возврат|refund|return/.test(payloadText)
  );
}

function isTopUpOperation(row: {
  operationType?: string | null;
  operationName?: string | null;
  serviceType?: string | null;
  serviceName?: string | null;
  itemExternalId?: string | null;
  amountRub?: Prisma.Decimal | number | string | null;
  amountTotal?: Prisma.Decimal | number | string | null;
  payload?: Prisma.JsonValue | Record<string, unknown> | null;
}) {
  const type = operationText(row.operationType);
  const name = operationText(row.operationName);
  const serviceType = operationText(row.serviceType);
  const serviceName = operationText(row.serviceName);
  const signedAmount = operationSignedAmount(row);
  const payloadText = operationText(
    row.payload && typeof row.payload === 'object' ? JSON.stringify(row.payload) : '',
  );

  if (/аванс|пополн|зачисл|поступлен|deposit|replenish|top[\s_-]?up|wallet/.test(type)) return true;
  if (/аванс|пополн|зачисл|поступлен|deposit|replenish|top[\s_-]?up|кошел|сч[её]т/.test(name))
    return true;
  if (/deposit|replenish|wallet|top[\s_-]?up/.test(payloadText)) return true;
  if (
    signedAmount > 0 &&
    !row.itemExternalId &&
    !serviceType &&
    !serviceName &&
    !isRefundOperation(row)
  )
    return true;
  return false;
}

function normalizeAccountId(accountId?: number | null) {
  return typeof accountId === 'number' && Number.isInteger(accountId) && accountId > 0
    ? accountId
    : undefined;
}

function toMoscowDate(input: string | Date) {
  return new Date(
    new Date(input).toLocaleString('en-US', {
      timeZone: 'Europe/Moscow',
    }),
  );
}

const ACTIVE_AVITO_STATUS_MARKERS = [
  'active',
  'published',
  'available',
  'visible',
  'online',
  'актив',
  'опублик',
  'доступ',
];

const ARCHIVED_AVITO_STATUS_MARKERS = [
  'old',
  'removed',
  'blocked',
  'rejected',
  'archived',
  'closed',
  'expired',
  'completed',
  'deleted',
  'снят',
  'архив',
  'заверш',
  'истек',
  'блок',
  'отклон',
];

type WeatherDemandClass = 'DRY_MILD' | 'WET' | 'COLD' | 'HOT';

const WEATHER_CLASS_LABELS: Record<WeatherDemandClass, string> = {
  DRY_MILD: 'сухая и умеренная погода',
  WET: 'дождливая погода',
  COLD: 'холодная погода',
  HOT: 'жаркая погода',
};

const WEATHER_CLASS_DEMAND_SCORE: Record<WeatherDemandClass, number> = {
  DRY_MILD: 0.12,
  WET: -0.12,
  COLD: -0.08,
  HOT: 0.02,
};

const TRAINING_STOPWORDS = new Set([
  'это',
  'что',
  'как',
  'для',
  'или',
  'ещё',
  'еще',
  'есть',
  'под',
  'при',
  'над',
  'без',
  'вам',
  'вас',
  'она',
  'они',
  'его',
  'её',
  'ему',
  'мне',
  'могу',
  'можно',
  'будет',
  'если',
  'цена',
  'руб',
  'рублей',
  'игр',
  'игра',
  'игры',
  'добрый',
  'ночи',
  'ночью',
  'день',
  'здравствуйте',
  'сегодня',
  'авито',
  'менеджер',
  'только',
  'может',
  'такой',
  'такая',
  'какая',
  'какой',
  'просто',
  'получить',
  'сообщение',
  'товар',
  'изображение',
  'ключ',
  'тоже',
  'там',
  'тут',
  'тогда',
  'пожалуйста',
  'можете',
  'можешь',
  'буду',
  'будем',
  'нужно',
  'нужна',
  'нужен',
  'нужны',
  'подскажу',
  'подскажем',
  'смотрите',
  'смотри',
  'можете',
  'можно',
  'давайте',
  'ссылка',
  'фото',
  'картинка',
  'доставка',
  'наличии',
  'наличие',
  'заказ',
  'заказать',
  'оформить',
  'оформление',
  'забрать',
  'отправить',
  'отправка',
  'купить',
  'покупка',
  'здравствуйте',
  'доброй',
  'доброго',
  'вечера',
  'утра',
  'ночи',
]);

const TRAINING_FILTER_PATTERNS: Array<{ label: string; test: (text: string) => boolean }> = [
  {
    label: 'Системные сообщения',
    test: text =>
      /\[?\s*системн(ое|ые)\s+сообщени/i.test(text) ||
      /перейдите на подписку/i.test(text) ||
      /api мессенджера/i.test(text) ||
      /пользователь создал чат/i.test(text),
  },
  {
    label: 'Приветствия без сути',
    test: text =>
      /^(здравствуйте|добрый день|добрый вечер|доброй ночи|доброе утро|привет|салют|добрый)$/i.test(
        text.trim(),
      ),
  },
  {
    label: 'Ссылки и UTM',
    test: text =>
      /^https?:\/\//i.test(text) ||
      /utm_/i.test(text) ||
      (text.replace(/https?:\/\/\S+/gi, '').trim().length < 6 && /https?:\/\//i.test(text)),
  },
  {
    label: 'Технические пентест-пейлоады',
    test: text =>
      /<script|onerror\s*=|constructor\.constructor|\$where\s*:|drop\s+table|169\.254\.169\.254|webhook\.site|pentest|floodtest|\{\s*"\$gt"\s*:\s*""\s*\}/i.test(
        text,
      ),
  },
  {
    label: 'Устаревшие тех-инструкции',
    test: text =>
      /(старая\s+памятка\s+technoprime|boot\s+from\s+file|steamcl\.efi|esp\s*>\s*efi\s*>\s*steamos)/i.test(
        text,
      ),
  },
  {
    label: 'Медиа без текста',
    test: text => /^(изображение|голосовое сообщение|пропущенный звонок)$/i.test(text.trim()),
  },
  {
    label: 'Удалённые и служебные реплики',
    test: text =>
      /(сообщение удалено|сообщение скрыто|объявление снято|объявление недоступно)/i.test(
        text.trim(),
      ),
  },
  {
    label: 'Шум и короткие значения',
    test: text => /^[\d\s.,:+\-₽$€#]+$/.test(text.trim()) || text.trim().length < 3,
  },
  {
    label: 'Служебные вложения',
    test: text =>
      /^(изображение|фото|image|image attachment|voice|voice message|вложение)$/i.test(text.trim()),
  },
  {
    label: 'Личный оффтоп и мусор',
    test: text =>
      /(куда пропал|телефон сел|зайди в макс|не советую игнорить|ты вообще|идиот|олдушк|заделалс)/i.test(
        text.trim(),
      ),
  },
];

const PRODUCT_FAMILY_PATTERNS: Array<{ family: string; regex: RegExp }> = [
  { family: 'PlayStation Portal', regex: /(playstation\s*portal|ps\s*portal)/i },
  { family: 'Steam Deck', regex: /(steam\s*deck|стим\s*дек)/i },
  { family: 'PlayStation 5', regex: /((playstation|ps)\s*5|пс\s*5)/i },
  { family: 'PlayStation 4', regex: /((playstation|ps)\s*4|пс\s*4)/i },
  { family: 'Xbox Series S', regex: /(xbox\s*series\s*s)/i },
  { family: 'Xbox Series X', regex: /(xbox\s*series\s*x)/i },
  { family: 'Xbox One S', regex: /(xbox\s*one\s*s)/i },
  { family: 'Xbox One X', regex: /(xbox\s*one\s*x)/i },
  { family: 'Nintendo Switch', regex: /(nintendo\s*switch)/i },
  { family: 'ROG Ally', regex: /(rog\s*ally)/i },
  { family: 'Legion Go', regex: /(legion\s*go)/i },
];

const GAMING_TITLE_SIGNAL =
  /(steam\s*deck|стим\s*дек|playstation|ps\s*[45]|пс\s*[45]|xbox|nintendo\s*switch|switch|rog\s*ally|legion\s*go|portal|dualsense|dualshock|game\s*pass|playstation\s*plus|ps\s*portal)/i;

const INTENT_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'Цена и скидка', regex: /(сколько|цена|поч[её]м|торг|скидк|дешевл|за\s?\d)/i },
  { label: 'Наличие и бронь', regex: /(в наличии|есть|остал|брон|под заказ|налич|резерв)/i },
  {
    label: 'Доставка и получение',
    regex: /(достав|отправ|сд[еэ]к|авито доставк|почт|пвз|самовывоз|забрат)/i,
  },
  {
    label: 'Память и версия',
    regex: /(гб|gb|tb|тб|памят|ssd|oled|lcd|slim|pro|fat|512|1024|256|64)/i,
  },
  {
    label: 'Состояние и внешний вид',
    regex: /(состояни|царап|след|идеал|нов|б\/у|бу|внешн|потерт)/i,
  },
  {
    label: 'Комплект и аксессуары',
    regex: /(комплект|в комплект|что входит|джойстик|геймпад|док|заряд|кабел)/i,
  },
  { label: 'Гарантия и проверка', regex: /(гарант|провер|тест|ремонт|пломб|обслуж)/i },
  {
    label: 'Игры, аккаунт и подписка',
    regex: /(игр|подписк|аккаунт|plus|делюкс|game pass|прошит|установ)/i,
  },
  {
    label: 'Подбор и консультация',
    regex: /(посовет|подойд|какой лучше|что взять|для ребен|для себя|помоги выбрать)/i,
  },
];

const CUSTOMER_BUSINESS_SIGNAL =
  /(сколько|цена|поч[её]м|скидк|торг|есть|налич|остал|брон|резерв|достав|отправ|самовывоз|сд[еэ]к|пвз|почт|забрат|гарант|провер|состояни|комплект|геймпад|джойст|кабел|аккаунт|подписк|игр|прошит|steam|deck|playstation|ps|xbox|portal|switch|rog|legion|oled|lcd|slim|pro|fat|gb|гб|tb|тб|памят|можно оформить|как купить|под ключ)/i;

const CUSTOMER_QUESTION_SIGNAL =
  /(\?|подскаж|можно|есть|какая|какой|какое|какие|сколько|как|когда|куда|интересует|ищу|хотел|хочу|подойдет|подойдёт)/i;

const BUSINESS_RESPONSE_SIGNAL =
  /(₽|ц[ие]н|стоим|достав|отправ|гарант|комплект|в налич|под заказ|состояни|чек|оплат|брон|резерв|геймпад|джойст|кабел|аккаунт|подписк|игр|игруш|лиценз|прошит|прошив|драйвер|установ|памят|gb|tb|oled|lcd|steam|deck|ps|playstation|xbox|portal|консол)/i;

const WEAK_MANAGER_PATTERNS = [
  /^не понял вопрос/i,
  /^не понял/i,
  /^ок[.! ]*$/i,
  /^понял[.! ]*$/i,
  /^хорошо[.! ]*$/i,
  /^здравствуйте[.! ]*$/i,
  /^добрый (день|вечер|ночи?)[.! ]*$/i,
  /^привет[.! ]*$/i,
  /с вами менеджер/i,
  /меня зовут/i,
  /желаете приобрести/i,
  /^\{цена\}[.! ]*$/i,
  /^\{ссылка\}[.! ]*$/i,
  /^\{вариант\}[.! ]*$/i,
  /^\{память\}[.! ]*$/i,
  /^(да|нет|можно|есть|окей|ок|понятно)[.! ]*$/i,
  /^скинул/i,
  /^отправил/i,
  /^фото/i,
  /^вот ссылка/i,
];

@Injectable()
export class MarketplaceInsightsService {
  private readonly logger = new Logger(MarketplaceInsightsService.name);
  private syncInFlight: Promise<any> | null = null;
  private readonly responseCacheTtlMs = 30_000;
  private readonly responseCache = new Map<
    string,
    { expiresAt: number; value?: any; promise?: Promise<any> }
  >();
  private readonly weatherCacheTtlMs = 6 * 60 * 60 * 1000;
  private readonly weatherGeocodeCache = new Map<
    string,
    {
      expiresAt: number;
      value: { city: string; latitude: number; longitude: number; timezone: string } | null;
    }
  >();
  private readonly weatherArchiveCache = new Map<
    string,
    {
      expiresAt: number;
      value: Map<string, { tempMean: number | null; precipitationMm: number | null }> | null;
    }
  >();
  private readonly weatherForecastCache = new Map<
    string,
    {
      expiresAt: number;
      value: {
        date: string;
        tempMin: number | null;
        tempMax: number | null;
        precipitationMm: number | null;
        precipitationProbability: number | null;
      } | null;
    }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly logistics: LogisticsService,
  ) {}

  private responseCacheKey(scope: string, parts: Array<string | number | undefined>) {
    return `${scope}:${parts.map(part => String(part ?? '')).join(':')}`;
  }

  private async withResponseCache<T>(
    key: string,
    loader: () => Promise<T>,
    ttlMs = this.responseCacheTtlMs,
  ): Promise<T> {
    const cached = this.responseCache.get(key);
    if (cached?.value !== undefined && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    if (cached?.promise) {
      return cached.promise as Promise<T>;
    }

    const promise = loader()
      .then(value => {
        this.responseCache.set(key, {
          expiresAt: Date.now() + ttlMs,
          value,
        });
        return value;
      })
      .finally(() => {
        const current = this.responseCache.get(key);
        if (current?.promise) {
          this.responseCache.delete(key);
        }
      });

    this.responseCache.set(key, {
      expiresAt: 0,
      promise,
    });

    return promise;
  }

  private invalidateResponseCache() {
    this.responseCache.clear();
  }

  @Cron('20 */3 * * *')
  async scheduledSync() {
    try {
      await this.syncConnectedAvitoAccounts();
    } catch (error: any) {
      this.logger.error(`Marketplace sync failed: ${error?.message || error}`);
    }
  }

  private async ensureFreshData() {
    const latest = await this.prisma.marketplaceBalanceSnapshot.findFirst({
      where: { tenant: 'TECHNOPRIME', platform: MarketplacePlatform.AVITO },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    if (!latest) {
      void this.runMarketplaceSync();
      return;
    }

    if (latest.updatedAt.getTime() < Date.now() - 4 * 60 * 60 * 1000) {
      void this.runMarketplaceSync();
    }
  }

  async syncConnectedAvitoAccounts() {
    return this.runMarketplaceSync();
  }

  private runMarketplaceSync() {
    if (!this.syncInFlight) {
      this.syncInFlight = this.performMarketplaceSync().finally(() => {
        this.syncInFlight = null;
      });
    }

    return this.syncInFlight;
  }

  private async performMarketplaceSync() {
    const accounts = await this.prisma.marketplaceAccount.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        platform: MarketplacePlatform.AVITO,
        status: MarketplaceAccountStatus.CONNECTED,
        disconnectedAt: null,
      },
      select: { id: true, displayName: true },
      orderBy: { updatedAt: 'desc' },
    });

    const results: Array<{
      accountId: number;
      displayName: string;
      listings: number;
      learning: number;
      warnings: string[];
    }> = [];
    for (const account of accounts) {
      const snapshot = await this.logistics.collectAvitoAnalyticsSnapshot(account.id);
      await this.persistSnapshot(account.id, snapshot);
      results.push({
        accountId: account.id,
        displayName: account.displayName,
        listings: snapshot.listings.length,
        learning: snapshot.learningExamples.length,
        warnings: snapshot.warnings,
      });
    }

    this.invalidateResponseCache();

    return {
      syncedAt: new Date().toISOString(),
      accounts: results,
    };
  }

  private async persistSnapshot(
    accountId: number,
    snapshot: Awaited<ReturnType<LogisticsService['collectAvitoAnalyticsSnapshot']>>,
  ) {
    const balanceDate = startOfUtcDay(snapshot.syncedAt)!;

    if (snapshot.balance) {
      await this.prisma.marketplaceBalanceSnapshot.upsert({
        where: {
          tenant_marketplaceAccountId_date: {
            tenant: 'TECHNOPRIME',
            marketplaceAccountId: accountId,
            date: balanceDate,
          },
        },
        update: {
          platform: MarketplacePlatform.AVITO,
          realBalance: new Prisma.Decimal(snapshot.balance.realBalance.toFixed(2)),
          bonusBalance: new Prisma.Decimal(snapshot.balance.bonusBalance.toFixed(2)),
          payload: snapshot.balance.payload as Prisma.InputJsonValue,
        },
        create: {
          platform: MarketplacePlatform.AVITO,
          marketplaceAccountId: accountId,
          date: balanceDate,
          realBalance: new Prisma.Decimal(snapshot.balance.realBalance.toFixed(2)),
          bonusBalance: new Prisma.Decimal(snapshot.balance.bonusBalance.toFixed(2)),
          payload: snapshot.balance.payload as Prisma.InputJsonValue,
        },
      });
    }

    for (const listing of snapshot.listings) {
      for (const metric of listing.dailyMetrics) {
        const statDate = startOfUtcDay(metric.date);
        if (!statDate) continue;

        await this.prisma.marketplaceListingDailyStat.upsert({
          where: {
            tenant_marketplaceAccountId_externalItemId_statDate: {
              tenant: 'TECHNOPRIME',
              marketplaceAccountId: accountId,
              externalItemId: listing.externalItemId,
              statDate,
            },
          },
          update: {
            platform: MarketplacePlatform.AVITO,
            title: listing.title,
            url: listing.url,
            priceLabel: listing.priceLabel,
            statusLabel: listing.statusLabel,
            services: (listing.services || []) as Prisma.InputJsonValue,
            uniqViews: metric.uniqViews,
            uniqFavorites: metric.uniqFavorites,
            uniqContacts: metric.uniqContacts,
            startAt: listing.startAt ? new Date(listing.startAt) : null,
            finishAt: listing.finishAt ? new Date(listing.finishAt) : null,
            payload: (listing.payload || metric.payload || {}) as Prisma.InputJsonValue,
          },
          create: {
            platform: MarketplacePlatform.AVITO,
            marketplaceAccountId: accountId,
            externalItemId: listing.externalItemId,
            statDate,
            title: listing.title,
            url: listing.url,
            priceLabel: listing.priceLabel,
            statusLabel: listing.statusLabel,
            services: (listing.services || []) as Prisma.InputJsonValue,
            uniqViews: metric.uniqViews,
            uniqFavorites: metric.uniqFavorites,
            uniqContacts: metric.uniqContacts,
            startAt: listing.startAt ? new Date(listing.startAt) : null,
            finishAt: listing.finishAt ? new Date(listing.finishAt) : null,
            payload: (listing.payload || metric.payload || {}) as Prisma.InputJsonValue,
          },
        });
      }
    }

    for (const operation of snapshot.operations || []) {
      const paidAt = new Date(operation.paidAt);
      if (Number.isNaN(paidAt.getTime())) continue;

      await this.prisma.marketplaceBalanceOperation.upsert({
        where: {
          tenant_marketplaceAccountId_operationKey: {
            tenant: 'TECHNOPRIME',
            marketplaceAccountId: accountId,
            operationKey: operation.operationKey,
          },
        },
        update: {
          platform: MarketplacePlatform.AVITO,
          paidAt,
          itemExternalId: operation.itemExternalId,
          operationName: operation.operationName,
          operationType: operation.operationType,
          serviceId: operation.serviceId,
          serviceName: operation.serviceName,
          serviceType: operation.serviceType,
          amountRub: new Prisma.Decimal(operation.amountRub.toFixed(2)),
          amountBonus: new Prisma.Decimal(operation.amountBonus.toFixed(2)),
          amountTotal: new Prisma.Decimal(operation.amountTotal.toFixed(2)),
          payload: (operation.payload || {}) as Prisma.InputJsonValue,
        },
        create: {
          platform: MarketplacePlatform.AVITO,
          marketplaceAccountId: accountId,
          operationKey: operation.operationKey,
          paidAt,
          itemExternalId: operation.itemExternalId,
          operationName: operation.operationName,
          operationType: operation.operationType,
          serviceId: operation.serviceId,
          serviceName: operation.serviceName,
          serviceType: operation.serviceType,
          amountRub: new Prisma.Decimal(operation.amountRub.toFixed(2)),
          amountBonus: new Prisma.Decimal(operation.amountBonus.toFixed(2)),
          amountTotal: new Prisma.Decimal(operation.amountTotal.toFixed(2)),
          payload: (operation.payload || {}) as Prisma.InputJsonValue,
        },
      });
    }

    for (const example of snapshot.learningExamples) {
      const messageAt = new Date(example.messageAt);
      if (Number.isNaN(messageAt.getTime())) continue;

      await this.prisma.marketplaceConversationLearning.upsert({
        where: {
          tenant_marketplaceAccountId_messageExternalId: {
            tenant: 'TECHNOPRIME',
            marketplaceAccountId: accountId,
            messageExternalId: example.messageExternalId,
          },
        },
        update: {
          platform: MarketplacePlatform.AVITO,
          chatId: example.chatId,
          itemExternalId: example.itemExternalId,
          itemTitle: example.itemTitle,
          priceLabel: example.priceLabel,
          counterpartName: example.counterpartName,
          direction: example.direction,
          messageType: example.messageType,
          text: example.text,
          hasImage: example.hasImage,
          payload: (example.payload || {}) as Prisma.InputJsonValue,
          messageAt,
        },
        create: {
          platform: MarketplacePlatform.AVITO,
          marketplaceAccountId: accountId,
          chatId: example.chatId,
          messageExternalId: example.messageExternalId,
          itemExternalId: example.itemExternalId,
          itemTitle: example.itemTitle,
          priceLabel: example.priceLabel,
          counterpartName: example.counterpartName,
          direction: example.direction,
          messageType: example.messageType,
          text: example.text,
          hasImage: example.hasImage,
          payload: (example.payload || {}) as Prisma.InputJsonValue,
          messageAt,
        },
      });
    }
  }

  async overview(from?: string, to?: string, accountId?: number, days?: string | number) {
    const key = this.responseCacheKey('overview', [from, to, accountId, days]);
    return this.withResponseCache(key, async () => {
      await this.ensureFreshData();

      const range = rangeOrDefault(from, to, days);
      const scopedAccountId = normalizeAccountId(accountId);

      const [
        accounts,
        balances,
        operations,
        listingRows,
        learningRows,
        adSpendAgg,
        lastKnownOperations,
      ] = await Promise.all([
        this.prisma.marketplaceAccount.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            status: MarketplaceAccountStatus.CONNECTED,
            disconnectedAt: null,
            ...(scopedAccountId ? { id: scopedAccountId } : {}),
          },
          select: {
            id: true,
            displayName: true,
            externalAccountId: true,
            lastSyncAt: true,
            lastSyncError: true,
            expiresAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.marketplaceBalanceSnapshot.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
            date: { gte: range.from, lte: range.to },
          },
          orderBy: [{ marketplaceAccountId: 'asc' }, { date: 'asc' }],
        }),
        this.prisma.marketplaceBalanceOperation.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
            paidAt: { gte: range.from, lte: range.to },
          },
          orderBy: [{ marketplaceAccountId: 'asc' }, { paidAt: 'asc' }],
        }),
        this.prisma.marketplaceListingDailyStat.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
            statDate: { gte: range.from, lte: range.to },
          },
          orderBy: [{ statDate: 'asc' }, { externalItemId: 'asc' }],
        }),
        this.prisma.marketplaceConversationLearning.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
            messageAt: { gte: range.from, lte: range.to },
          },
          orderBy: { messageAt: 'asc' },
        }),
        this.prisma.adSpend.aggregate({
          where: {
            tenant: 'TECHNOPRIME',
            date: { gte: range.from, lte: range.to },
          },
          _sum: { amount: true },
        }),
        this.prisma.marketplaceBalanceOperation.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
          },
          orderBy: { paidAt: 'desc' },
          take: 200,
          select: {
            paidAt: true,
            amountRub: true,
            amountTotal: true,
            operationName: true,
            operationType: true,
            serviceType: true,
            serviceName: true,
          },
        }),
      ]);

      const latestBalanceByAccount = new Map<number, (typeof balances)[number]>();
      const firstBalanceByAccount = new Map<number, (typeof balances)[number]>();
      for (const row of balances) {
        if (!firstBalanceByAccount.has(row.marketplaceAccountId))
          firstBalanceByAccount.set(row.marketplaceAccountId, row);
        latestBalanceByAccount.set(row.marketplaceAccountId, row);
      }

      const latestListingByItem = new Map<string, (typeof listingRows)[number]>();
      for (const row of listingRows) {
        latestListingByItem.set(`${row.marketplaceAccountId}:${row.externalItemId}`, row);
      }

      const latestListingEntries = Array.from(latestListingByItem.values());
      const activeLatestListings = latestListingEntries.filter(row =>
        this.isActiveListingStatus(row.statusLabel),
      );
      const archivedLatestListings = latestListingEntries.filter(
        row => !this.isActiveListingStatus(row.statusLabel),
      );

      const filteredLearningCategories = new Map<string, number>();
      const usefulLearningRows = learningRows.filter(row => {
        const reason =
          this.getLearningFilterReason(row.messageType, row.text, row.hasImage) ||
          this.getTrainingScopeReason(row.itemTitle);
        if (reason) {
          filteredLearningCategories.set(reason, (filteredLearningCategories.get(reason) || 0) + 1);
          return false;
        }
        return true;
      });

      const meaningfulInboundLearning = usefulLearningRows.filter(
        row => String(row.direction).toLowerCase() === 'in',
      );
      const inboundLearning = meaningfulInboundLearning;
      const inboundChatContactsByItem = new Map<string, number>();
      for (const row of inboundLearning) {
        if (!row.itemExternalId) continue;
        const key = `${row.marketplaceAccountId}:${row.itemExternalId}`;
        inboundChatContactsByItem.set(key, (inboundChatContactsByItem.get(key) || 0) + 1);
      }

      const listingAccountStats = new Map<
        number,
        {
          trackedListings: number;
          archivedListings: number;
          promotedListings: number;
          totalViews: number;
          totalFavorites: number;
          totalContacts: number;
        }
      >();
      const listingGroupsByAccountItem = new Map<
        string,
        {
          accountId: number;
          itemExternalId: string;
          totalViews: number;
          statsContacts: number;
          totalFavorites: number;
          servicesCount: number;
          firstTrackedAt: Date;
          lastTrackedAt: Date;
        }
      >();
      for (const row of listingRows) {
        const key = `${row.marketplaceAccountId}:${row.externalItemId}`;
        const current = listingGroupsByAccountItem.get(key) || {
          accountId: row.marketplaceAccountId,
          itemExternalId: row.externalItemId,
          totalViews: 0,
          statsContacts: 0,
          totalFavorites: 0,
          servicesCount: 0,
          firstTrackedAt: row.statDate,
          lastTrackedAt: row.statDate,
        };
        current.totalViews += row.uniqViews;
        current.statsContacts += row.uniqContacts;
        current.totalFavorites += row.uniqFavorites;
        current.servicesCount = Math.max(
          current.servicesCount,
          Array.isArray(row.services) ? row.services.length : 0,
        );
        if (row.statDate < current.firstTrackedAt) current.firstTrackedAt = row.statDate;
        if (row.statDate > current.lastTrackedAt) current.lastTrackedAt = row.statDate;
        listingGroupsByAccountItem.set(key, current);
      }

      const activeListingGroups: Array<{
        latest: (typeof activeLatestListings)[number];
        aggregate: {
          accountId: number;
          itemExternalId: string;
          totalViews: number;
          statsContacts: number;
          totalFavorites: number;
          servicesCount: number;
          firstTrackedAt: Date;
          lastTrackedAt: Date;
        };
      }> = [];
      for (const row of activeLatestListings) {
        const aggregate = listingGroupsByAccountItem.get(
          `${row.marketplaceAccountId}:${row.externalItemId}`,
        );
        if (!aggregate) continue;
        activeListingGroups.push({ latest: row, aggregate });
      }

      const totalViews = activeListingGroups.reduce(
        (acc, row) => acc + row.aggregate.totalViews,
        0,
      );
      const totalFavorites = activeListingGroups.reduce(
        (acc, row) => acc + row.aggregate.totalFavorites,
        0,
      );
      const statsContacts = activeListingGroups.reduce(
        (acc, row) => acc + row.aggregate.statsContacts,
        0,
      );
      const inboundChatContacts = new Set(
        meaningfulInboundLearning.map(row => `${row.marketplaceAccountId}:${row.chatId}`),
      ).size;
      const totalContacts = statsContacts > 0 ? statsContacts : inboundChatContacts;
      const promotedListings = activeLatestListings.filter(
        row => Array.isArray(row.services) && row.services.length > 0,
      );
      for (const item of listingGroupsByAccountItem.values()) {
        const listingKey = `${item.accountId}:${item.itemExternalId}`;
        const latest = latestListingByItem.get(listingKey);
        if (!latest || !this.isActiveListingStatus(latest.statusLabel)) {
          continue;
        }
        const inboundContacts = inboundChatContactsByItem.get(listingKey) || 0;
        const current = listingAccountStats.get(item.accountId) || {
          trackedListings: 0,
          archivedListings: 0,
          promotedListings: 0,
          totalViews: 0,
          totalFavorites: 0,
          totalContacts: 0,
        };
        current.trackedListings += 1;
        current.promotedListings += item.servicesCount > 0 ? 1 : 0;
        current.totalViews += item.totalViews;
        current.totalFavorites += item.totalFavorites;
        current.totalContacts += item.statsContacts > 0 ? item.statsContacts : inboundContacts;
        listingAccountStats.set(item.accountId, current);
      }

      for (const row of archivedLatestListings) {
        const current = listingAccountStats.get(row.marketplaceAccountId) || {
          trackedListings: 0,
          archivedListings: 0,
          promotedListings: 0,
          totalViews: 0,
          totalFavorites: 0,
          totalContacts: 0,
        };
        current.archivedListings += 1;
        listingAccountStats.set(row.marketplaceAccountId, current);
      }

      const operationSpendByItem = new Map<string, number>();
      let spendOperationsCount = 0;
      for (const operation of operations) {
        if (!operation.itemExternalId) continue;
        const amount = operationAbsAmount(operation);
        if (!amount) continue;
        const key = `${operation.marketplaceAccountId}:${operation.itemExternalId}`;
        const delta = isExpenseOperation(operation)
          ? amount
          : isRefundOperation(operation)
            ? -amount
            : 0;
        if (!delta) continue;
        if (delta > 0) spendOperationsCount += 1;
        operationSpendByItem.set(
          key,
          Number(((operationSpendByItem.get(key) || 0) + delta).toFixed(2)),
        );
      }

      const hours = new Array(24).fill(0);
      inboundLearning.forEach(row => {
        hours[toMoscowDate(row.messageAt).getHours()] += 1;
      });
      const bestHour = hours
        .map((count, hour) => ({ hour, count }))
        .sort((a, b) => b.count - a.count)[0];

      const balanceTimelineMap = new Map<string, { date: string; real: number; bonus: number }>();
      for (const row of balances) {
        const key = row.date.toISOString().slice(0, 10);
        const current = balanceTimelineMap.get(key) || { date: key, real: 0, bonus: 0 };
        current.real += money(row.realBalance);
        current.bonus += money(row.bonusBalance);
        balanceTimelineMap.set(key, current);
      }

      const balanceTimeline = Array.from(balanceTimelineMap.values()).sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      const operationTimelineMap = new Map<
        string,
        { date: string; spentEstimate: number; topUpEstimate: number }
      >();
      let topUpOperationsCount = 0;
      for (const operation of operations) {
        const date = operation.paidAt.toISOString().slice(0, 10);
        const current = operationTimelineMap.get(date) || {
          date,
          spentEstimate: 0,
          topUpEstimate: 0,
        };
        const amount = operationAbsAmount(operation);
        if (!amount) continue;
        if (isExpenseOperation(operation)) {
          current.spentEstimate += amount;
        } else if (isTopUpOperation(operation) || isRefundOperation(operation)) {
          current.topUpEstimate += amount;
          topUpOperationsCount += 1;
        }
        operationTimelineMap.set(date, current);
      }

      const balanceDeltaTimeline = balanceTimeline.map((point, index) => {
        if (index === 0) {
          return {
            date: point.date,
            spentEstimate: 0,
            topUpEstimate: 0,
          };
        }
        const previous = balanceTimeline[index - 1];
        const delta = Number((point.real - previous.real).toFixed(2));
        return {
          date: point.date,
          spentEstimate: delta < 0 ? Math.abs(delta) : 0,
          topUpEstimate: delta > 0 ? delta : 0,
        };
      });

      const spendSource =
        operationTimelineMap.size > 0
          ? 'OPERATIONS'
          : balanceDeltaTimeline.some(point => point.spentEstimate > 0 || point.topUpEstimate > 0)
            ? 'BALANCE_DELTA'
            : 'NO_DATA';

      const spendTimeline = (
        operationTimelineMap.size ? Array.from(operationTimelineMap.values()) : balanceDeltaTimeline
      )
        .map(point => ({
          ...point,
          spentEstimate: Number(point.spentEstimate.toFixed(2)),
          topUpEstimate: Number(point.topUpEstimate.toFixed(2)),
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const estimatedAdvertisingSpend = spendTimeline.reduce(
        (acc, point) => acc + point.spentEstimate,
        0,
      );
      const estimatedTopUps = spendTimeline.reduce((acc, point) => acc + point.topUpEstimate, 0);
      const lastSpendDate =
        [...spendTimeline].reverse().find(point => point.spentEstimate > 0)?.date || null;
      const lastKnownSpend = lastKnownOperations.find(operation => isExpenseOperation(operation));
      const todayKey = new Date().toISOString().slice(0, 10);
      const todayAdvertisingSpend =
        spendTimeline.find(point => point.date === todayKey)?.spentEstimate || 0;
      const todayTopUps = spendTimeline.find(point => point.date === todayKey)?.topUpEstimate || 0;

      const serviceMixMap = new Map<
        string,
        {
          title: string;
          listings: number;
          totalViews: number;
          totalContacts: number;
          totalSpend: number;
        }
      >();
      for (const row of activeLatestListings) {
        const services =
          Array.isArray(row.services) && row.services.length > 0
            ? row.services
            : ['Без продвижения'];
        const listingKey = `${row.marketplaceAccountId}:${row.externalItemId}`;
        const listingAggregate = listingGroupsByAccountItem.get(listingKey);
        if (!listingAggregate) continue;
        const listingViews = listingAggregate.totalViews;
        const statsListingContacts = listingAggregate.statsContacts;
        const listingContacts = Math.max(
          statsListingContacts,
          inboundChatContactsByItem.get(listingKey) || 0,
        );
        const listingSpend = operationSpendByItem.get(listingKey) || 0;
        for (const rawService of services) {
          const title = serviceTitle(rawService);
          const current = serviceMixMap.get(title) || {
            title,
            listings: 0,
            totalViews: 0,
            totalContacts: 0,
            totalSpend: 0,
          };
          current.listings += 1;
          current.totalViews += listingViews;
          current.totalContacts += listingContacts;
          current.totalSpend += listingSpend;
          serviceMixMap.set(title, current);
        }
      }

      const serviceMix = Array.from(serviceMixMap.values())
        .map(service => ({
          ...service,
          avgContactRate:
            service.totalViews > 0
              ? Number(((service.totalContacts / service.totalViews) * 100).toFixed(2))
              : 0,
          costPerContact:
            service.totalContacts > 0
              ? Number((service.totalSpend / service.totalContacts).toFixed(2))
              : 0,
        }))
        .sort((left, right) => right.avgContactRate - left.avgContactRate);

      return {
        generatedAt: new Date().toISOString(),
        summary: {
          connectedAccounts: accounts.length,
          currentBalance: Array.from(latestBalanceByAccount.values()).reduce(
            (acc, row) => acc + money(row.realBalance),
            0,
          ),
          balanceDelta: Array.from(latestBalanceByAccount.entries()).reduce(
            (acc, [accountId, row]) => {
              const first = firstBalanceByAccount.get(accountId);
              return acc + (money(row.realBalance) - money(first?.realBalance));
            },
            0,
          ),
          trackedListings: activeLatestListings.length,
          activeListings: activeLatestListings.length,
          archivedListings: archivedLatestListings.length,
          promotedListings: promotedListings.length,
          totalViews,
          totalFavorites,
          totalContacts,
          statsContacts,
          inboundChatContacts,
          favoritesAvailable: totalFavorites > 0,
          contactConversion:
            totalViews > 0 ? Number(((totalContacts / totalViews) * 100).toFixed(2)) : 0,
          manualAdSpend: money(adSpendAgg._sum.amount),
          estimatedAdvertisingSpend: Number(estimatedAdvertisingSpend.toFixed(2)),
          estimatedTopUps: Number(estimatedTopUps.toFixed(2)),
          todayAdvertisingSpend: Number(todayAdvertisingSpend.toFixed(2)),
          todayTopUps: Number(todayTopUps.toFixed(2)),
          lastSpendDate,
          lastKnownSpendDate: lastKnownSpend?.paidAt
            ? startOfUtcDay(lastKnownSpend.paidAt)?.toISOString().slice(0, 10)
            : null,
          spendSource,
          trainingExamples: usefulLearningRows.length,
          rawTrainingExamples: learningRows.length,
          filteredTrainingExamples: learningRows.length - usefulLearningRows.length,
          statsWindowFrom: listingRows[0]?.statDate
            ? listingRows[0].statDate.toISOString().slice(0, 10)
            : null,
          statsWindowTo: listingRows[listingRows.length - 1]?.statDate
            ? listingRows[listingRows.length - 1].statDate.toISOString().slice(0, 10)
            : null,
          operationsCount: operations.length,
          topUpOperationsCount,
          spendOperationsCount,
          bestReplyHour: bestHour?.count ? bestHour.hour : null,
        },
        accounts: accounts.map(account => {
          const latest = latestBalanceByAccount.get(account.id);
          const stats = listingAccountStats.get(account.id);
          return {
            id: account.id,
            displayName: account.displayName,
            externalAccountId: account.externalAccountId,
            lastSyncAt: account.lastSyncAt,
            lastSyncError: account.lastSyncError,
            expiresAt: account.expiresAt,
            currentBalance: money(latest?.realBalance),
            bonusBalance: money(latest?.bonusBalance),
            trackedListings: stats?.trackedListings || 0,
            activeListings: stats?.trackedListings || 0,
            archivedListings: stats?.archivedListings || 0,
            promotedListings: stats?.promotedListings || 0,
            totalViews: stats?.totalViews || 0,
            totalFavorites: stats?.totalFavorites || 0,
            totalContacts: stats?.totalContacts || 0,
          };
        }),
        balanceTimeline,
        spendTimeline,
        serviceMix,
        operationSpendByItem: Object.fromEntries(operationSpendByItem),
        filteredLearningCategories: Array.from(filteredLearningCategories.entries())
          .map(([label, count]) => ({ label, count }))
          .sort((left, right) => right.count - left.count),
      };
    });
  }

  async listings(from?: string, to?: string, accountId?: number, days?: string | number) {
    const key = this.responseCacheKey('listings', [from, to, accountId, days]);
    return this.withResponseCache(key, async () => {
      await this.ensureFreshData();
      const range = rangeOrDefault(from, to, days);
      const scopedAccountId = normalizeAccountId(accountId);

      const [rows, operations, learningRows, completedOrders] = await Promise.all([
        this.prisma.marketplaceListingDailyStat.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
            statDate: { gte: range.from, lte: range.to },
          },
          include: {
            marketplaceAccount: {
              select: { id: true, displayName: true, externalAccountId: true },
            },
          },
          orderBy: [{ externalItemId: 'asc' }, { statDate: 'asc' }],
        }),
        this.prisma.marketplaceBalanceOperation.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
            paidAt: { gte: range.from, lte: range.to },
            itemExternalId: { not: null },
          },
          orderBy: [{ itemExternalId: 'asc' }, { paidAt: 'asc' }],
        }),
        this.prisma.marketplaceConversationLearning.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
            messageAt: { gte: range.from, lte: range.to },
            itemExternalId: { not: null },
          },
          orderBy: { messageAt: 'asc' },
        }),
        this.prisma.order.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            status: OrderStatus.COMPLETED,
            salesChannel: SalesChannel.AVITO,
            date: { gte: range.from, lte: range.to },
          },
          select: {
            id: true,
            date: true,
            totalPrice: true,
            profit: true,
            comment: true,
            client: { select: { city: true } },
            items: {
              select: {
                product: {
                  select: { name: true },
                },
              },
            },
          },
        }),
      ]);

      const byListing = new Map<string, typeof rows>();
      for (const row of rows) {
        const key = `${row.marketplaceAccountId}:${row.externalItemId}`;
        const current = byListing.get(key) || [];
        current.push(row);
        byListing.set(key, current);
      }

      const operationSpendByListing = new Map<string, number>();
      const lastSpendAtByListing = new Map<string, Date>();
      for (const operation of operations) {
        if (!operation.itemExternalId) continue;
        const amount = operationAbsAmount(operation);
        if (!amount) continue;
        const key = `${operation.marketplaceAccountId}:${operation.itemExternalId}`;
        const delta = isExpenseOperation(operation)
          ? amount
          : isRefundOperation(operation)
            ? -amount
            : 0;
        if (!delta) continue;
        operationSpendByListing.set(
          key,
          Number(((operationSpendByListing.get(key) || 0) + delta).toFixed(2)),
        );
        if (delta > 0) {
          lastSpendAtByListing.set(key, operation.paidAt);
        }
      }

      const inboundChatsByListing = new Map<string, Set<string>>();
      for (const row of learningRows) {
        if (!row.itemExternalId || String(row.direction).toLowerCase() !== 'in') continue;
        const key = `${row.marketplaceAccountId}:${row.itemExternalId}`;
        const current = inboundChatsByListing.get(key) || new Set<string>();
        current.add(row.chatId);
        inboundChatsByListing.set(key, current);
      }

      const listingChatRows = new Map<string, Map<string, typeof learningRows>>();
      for (const row of learningRows) {
        if (!row.itemExternalId) continue;
        const listingKey = `${row.marketplaceAccountId}:${row.itemExternalId}`;
        const chatKey = `${row.marketplaceAccountId}:${row.chatId}`;
        const currentByChat =
          listingChatRows.get(listingKey) || new Map<string, typeof learningRows>();
        const currentRows = currentByChat.get(chatKey) || [];
        currentRows.push(row);
        currentByChat.set(chatKey, currentRows);
        listingChatRows.set(listingKey, currentByChat);
      }

      const leadSignalsByListing = new Map<
        string,
        {
          leadStarts: number;
          strongLeadStarts: number;
          phoneSignals: number;
          siteRegistrations: number;
          bestDemandHour: number | null;
          leadStartMoments: Date[];
        }
      >();

      for (const [listingKey, chats] of listingChatRows.entries()) {
        const hourCounts = new Array(24).fill(0);
        let leadStarts = 0;
        let strongLeadStarts = 0;
        let phoneSignals = 0;
        let siteRegistrations = 0;
        const leadStartMoments: Date[] = [];

        for (const chatRows of chats.values()) {
          const orderedRows = [...chatRows].sort(
            (left, right) =>
              new Date(left.messageAt).getTime() - new Date(right.messageAt).getTime(),
          );
          const inboundRows = orderedRows.filter(
            row => String(row.direction).toLowerCase() === 'in',
          );
          const outboundRows = orderedRows.filter(
            row => String(row.direction).toLowerCase() !== 'in',
          );
          const inboundTexts = inboundRows
            .map(row => this.normalizeLearningText(row.text))
            .filter(Boolean);
          const outboundTexts = outboundRows
            .map(row => this.normalizeLearningText(row.text))
            .filter(Boolean);

          inboundRows.forEach(row => {
            hourCounts[toMoscowDate(row.messageAt).getHours()] += 1;
          });

          const hasPhone = inboundTexts.some(text => this.hasPhoneSignal(text));
          const hasPositiveIntent = inboundTexts.some(text => this.isPositiveClientSignal(text));
          const hasRegistration = inboundTexts.some(text =>
            /(зарегистр|зарегал|зарегист|создал заказ|оформил на сайте|оформила на сайте|на сайте оформил)/i.test(
              text,
            ),
          );
          const managerSentOrderLink = outboundTexts.some(text =>
            this.hasManagerOrderLinkSignal(text),
          );
          const leadStarted =
            hasPositiveIntent || hasPhone || (managerSentOrderLink && hasRegistration);

          if (hasPhone) phoneSignals += 1;
          if (hasRegistration) siteRegistrations += 1;
          if (leadStarted) {
            leadStarts += 1;
            if (hasPhone && (hasPositiveIntent || hasRegistration)) {
              strongLeadStarts += 1;
            }
            leadStartMoments.push(
              inboundRows[0]?.messageAt || orderedRows[0]?.messageAt || new Date(),
            );
          }
        }

        const bestDemandHour = hourCounts
          .map((count, hour) => ({ hour, count }))
          .sort((left, right) => right.count - left.count)[0];

        leadSignalsByListing.set(listingKey, {
          leadStarts,
          strongLeadStarts,
          phoneSignals,
          siteRegistrations,
          bestDemandHour: bestDemandHour?.count ? bestDemandHour.hour : null,
          leadStartMoments,
        });
      }

      const listingContext = new Map<
        string,
        { family: string | null; price: number; leadStartMoments: Date[] }
      >();
      const dealStatsByListing = new Map<
        string,
        { closedDeals: number; revenue: number; profit: number }
      >();

      const items = Array.from(byListing.values())
        .map(group => {
          const latest = group[group.length - 1];
          const listingKey = `${latest.marketplaceAccountId}:${latest.externalItemId}`;
          const totalViews = group.reduce((acc, row) => acc + row.uniqViews, 0);
          const totalFavorites = group.reduce((acc, row) => acc + row.uniqFavorites, 0);
          const statsContacts = group.reduce((acc, row) => acc + row.uniqContacts, 0);
          const inboundChatContacts = inboundChatsByListing.get(listingKey)?.size || 0;
          const totalContacts = statsContacts > 0 ? statsContacts : inboundChatContacts;
          const favoriteRate =
            totalViews > 0 ? Number(((totalFavorites / totalViews) * 100).toFixed(2)) : 0;
          const contactRate =
            totalViews > 0 ? Number(((totalContacts / totalViews) * 100).toFixed(2)) : 0;
          const services = Array.isArray(latest.services) ? latest.services : [];
          const promotionSpend = Number(
            Math.max(operationSpendByListing.get(listingKey) || 0, 0).toFixed(2),
          );
          const costPerContact =
            totalContacts > 0 ? Number((promotionSpend / totalContacts).toFixed(2)) : 0;
          const isActive = this.isActiveListingStatus(latest.statusLabel);
          const signals = leadSignalsByListing.get(listingKey);
          const leadStarts = signals?.leadStarts || 0;
          const strongLeadStarts = signals?.strongLeadStarts || 0;
          const phoneSignals = signals?.phoneSignals || 0;
          const siteRegistrations = signals?.siteRegistrations || 0;
          const bestDemandHour =
            signals?.bestDemandHour == null
              ? null
              : `${String(signals.bestDemandHour).padStart(2, '0')}:00`;
          const listingPrice = this.extractPrice(latest.priceLabel);
          const family = this.extractProductFamily(latest.title);

          listingContext.set(listingKey, {
            family,
            price: listingPrice,
            leadStartMoments: signals?.leadStartMoments || [],
          });

          const recommendation =
            services.length && contactRate >= 2.5
              ? 'Продвижение работает стабильно — можно удерживать текущий пакет.'
              : services.length && totalContacts === 0 && promotionSpend > 0
                ? 'Продвижение активно, но обращений нет — проверьте оффер, цену и первый экран объявления.'
                : totalViews >= 150 && contactRate < 1
                  ? 'Просмотры есть, но контакты слабые — стоит пересобрать цену, заголовок и комплект.'
                  : totalContacts >= 5
                    ? 'Объявление собирает тёплые лиды — оставляйте в топе и следите за наличием.'
                    : 'Нужна дополнительная проверка заголовка, оффера и времени продвижения.';

          return {
            accountId: latest.marketplaceAccountId,
            accountName: latest.marketplaceAccount.displayName,
            externalItemId: latest.externalItemId,
            title: latest.title,
            url: latest.url,
            priceLabel: latest.priceLabel,
            statusLabel: latest.statusLabel,
            services,
            totalViews,
            totalFavorites,
            totalContacts,
            statsContacts,
            inboundChatContacts,
            favoriteRate,
            contactRate,
            promotionSpend,
            costPerContact,
            firstTrackedAt: group[0].statDate,
            lastTrackedAt: latest.statDate,
            lastSpendAt: lastSpendAtByListing.get(listingKey) || null,
            leadStarts,
            strongLeadStarts,
            phoneSignals,
            siteRegistrations,
            bestDemandHour,
            estimatedClosedDeals: 0,
            estimatedRevenue: 0,
            estimatedProfit: 0,
            dealConversionRate: 0,
            costPerDeal: 0,
            score: Number(
              (contactRate * 0.7 + favoriteRate * 0.3 + services.length * 0.4).toFixed(2),
            ),
            recommendation,
            isActive,
          };
        })
        .filter(item => item.isActive);

      for (const order of completedOrders) {
        const orderPrice = money(order.totalPrice);
        const orderText = [
          this.normalizeLearningText(order.comment),
          ...order.items.map(item => this.normalizeLearningText(item.product?.name)),
        ]
          .filter(Boolean)
          .join(' ');
        const orderFamily = this.extractProductFamily(orderText);

        let bestKey: string | null = null;
        let bestScore = 0;
        for (const [listingKey, context] of listingContext.entries()) {
          let score = 0;
          if (orderFamily && context.family && orderFamily === context.family) {
            score += 3;
          }

          if (orderPrice > 0 && context.price > 0) {
            const relativeDiff =
              Math.abs(orderPrice - context.price) / Math.max(orderPrice, context.price);
            if (relativeDiff <= 0.08) score += 2.2;
            else if (relativeDiff <= 0.18) score += 1.4;
            else if (relativeDiff <= 0.32) score += 0.7;
          }

          if (context.leadStartMoments.length) {
            const nearestMs = Math.min(
              ...context.leadStartMoments.map(point =>
                Math.abs(order.date.getTime() - new Date(point).getTime()),
              ),
            );
            const daysGap = nearestMs / (24 * 60 * 60 * 1000);
            if (daysGap <= 1) score += 2.2;
            else if (daysGap <= 3) score += 1.6;
            else if (daysGap <= 7) score += 1.0;
            else if (daysGap <= 14) score += 0.5;
          }

          if (score > bestScore) {
            bestScore = score;
            bestKey = listingKey;
          }
        }

        if (!bestKey || bestScore < 2.3) continue;
        const current = dealStatsByListing.get(bestKey) || {
          closedDeals: 0,
          revenue: 0,
          profit: 0,
        };
        current.closedDeals += 1;
        current.revenue += orderPrice;
        current.profit += money(order.profit);
        dealStatsByListing.set(bestKey, current);
      }

      for (const item of items) {
        const listingKey = `${item.accountId}:${item.externalItemId}`;
        const deals = dealStatsByListing.get(listingKey);
        if (!deals) continue;
        item.estimatedClosedDeals = deals.closedDeals;
        item.estimatedRevenue = Number(deals.revenue.toFixed(2));
        item.estimatedProfit = Number(deals.profit.toFixed(2));
        item.dealConversionRate =
          item.totalContacts > 0
            ? Number(((deals.closedDeals / item.totalContacts) * 100).toFixed(2))
            : 0;
        item.costPerDeal =
          deals.closedDeals > 0 ? Number((item.promotionSpend / deals.closedDeals).toFixed(2)) : 0;

        if (item.promotionSpend > 0 && deals.closedDeals === 0 && item.leadStarts === 0) {
          item.recommendation = `Потрачено ${item.promotionSpend.toLocaleString('ru-RU')} ₽, но не найдено лидов с явным стартом сделки. Проверьте цену, обложку и первые 2 строки объявления.`;
        } else if (deals.closedDeals > 0) {
          const avgDealCheck = deals.closedDeals > 0 ? deals.revenue / deals.closedDeals : 0;
          item.recommendation =
            `За период оценочно закрыто ${deals.closedDeals} сделок при рекламном бюджете ${item.promotionSpend.toLocaleString('ru-RU')} ₽ (стоимость привлечения сделки: ${item.costPerDeal.toLocaleString('ru-RU')} ₽, средний чек закрытия: ${avgDealCheck.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽). ${item.bestDemandHour ? `Пиковый час входящих: ${item.bestDemandHour}.` : ''}`.trim();
        } else if (item.leadStarts > 0 && deals.closedDeals === 0) {
          item.recommendation = `Есть ${item.leadStarts} лидов со стартом сделки, но закрытий пока нет — усильте дожим после отправки ссылки и фиксации телефона.`;
        }
      }

      const sorted = items.sort((left, right) => {
        if (right.estimatedClosedDeals !== left.estimatedClosedDeals) {
          return right.estimatedClosedDeals - left.estimatedClosedDeals;
        }
        if (right.leadStarts !== left.leadStarts) {
          return right.leadStarts - left.leadStarts;
        }
        if (right.totalContacts !== left.totalContacts) {
          return right.totalContacts - left.totalContacts;
        }
        return right.totalViews - left.totalViews;
      });

      const best = sorted.slice(0, 3).map(item => {
        if (item.estimatedClosedDeals > 0) {
          const avgDealCheck =
            item.estimatedRevenue && item.estimatedClosedDeals
              ? item.estimatedRevenue / item.estimatedClosedDeals
              : 0;
          return `${item.title}: ${item.estimatedClosedDeals} закрытых сделок, стоимость привлечения ${item.costPerDeal ? `${item.costPerDeal.toLocaleString('ru-RU')} ₽` : 'н/д'}, средний чек ${avgDealCheck ? `${avgDealCheck.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽` : 'н/д'}`;
        }
        return `${item.title}: ${item.contactRate}% контактов от просмотров`;
      });
      const weak = sorted
        .filter(item => item.totalViews >= 80 && item.contactRate < 1)
        .slice(0, 3)
        .map(item =>
          item.promotionSpend > 0
            ? `${item.title}: бюджет ${item.promotionSpend.toLocaleString('ru-RU')} ₽, закрытых сделок не найдено`
            : `${item.title}: много трафика, но слабая конверсия`,
        );

      const serviceInsightsMap = new Map<
        string,
        {
          title: string;
          listings: number;
          totalViews: number;
          totalContacts: number;
          totalSpend: number;
        }
      >();
      for (const item of sorted) {
        const normalizedServices =
          Array.isArray(item.services) && item.services.length > 0
            ? item.services.map(service => serviceTitle(service))
            : ['Без продвижения'];
        for (const title of normalizedServices) {
          const current = serviceInsightsMap.get(title) || {
            title,
            listings: 0,
            totalViews: 0,
            totalContacts: 0,
            totalSpend: 0,
          };
          current.listings += 1;
          current.totalViews += item.totalViews;
          current.totalContacts += item.totalContacts;
          current.totalSpend += item.promotionSpend;
          serviceInsightsMap.set(title, current);
        }
      }

      const serviceInsights = Array.from(serviceInsightsMap.values())
        .map(service => ({
          ...service,
          avgContactRate:
            service.totalViews > 0
              ? Number(((service.totalContacts / service.totalViews) * 100).toFixed(2))
              : 0,
          costPerContact:
            service.totalContacts > 0
              ? Number((service.totalSpend / service.totalContacts).toFixed(2))
              : 0,
        }))
        .sort((left, right) => right.avgContactRate - left.avgContactRate);

      const baselineService =
        serviceInsights.find(service => service.title === 'Без продвижения') ||
        serviceInsights.reduce(
          (winner, current) =>
            !winner || current.totalViews > winner.totalViews ? current : winner,
          serviceInsights[0],
        );
      const baselineRate = baselineService?.avgContactRate || 0;
      const baselineCpl = baselineService?.costPerContact || 0;

      const promotionPlaybook = serviceInsights
        .filter(service => service.title !== 'Без продвижения')
        .map(service => {
          const liftPct =
            baselineRate > 0
              ? Number((((service.avgContactRate - baselineRate) / baselineRate) * 100).toFixed(1))
              : 0;
          const cplDeltaPct =
            baselineCpl > 0
              ? Number((((service.costPerContact - baselineCpl) / baselineCpl) * 100).toFixed(1))
              : 0;
          const marketVolume =
            service.totalViews >= 1200
              ? 'высокий'
              : service.totalViews >= 450
                ? 'средний'
                : 'низкий';
          const verdict =
            liftPct >= 12 && (baselineCpl <= 0 || cplDeltaPct <= 20)
              ? 'Эффективно'
              : liftPct <= -8 || (cplDeltaPct >= 35 && service.avgContactRate <= baselineRate)
                ? 'Слабо'
                : 'Нужно тестировать';
          const recommendation =
            verdict === 'Эффективно'
              ? `${service.title} даёт прирост контактов ${liftPct >= 0 ? `+${liftPct}` : liftPct}% к базовому сценарию. Имеет смысл удерживать пакет и масштабировать в дни с высоким спросом.`
              : verdict === 'Слабо'
                ? `${service.title} не даёт стабильного прироста: ${liftPct >= 0 ? `+${liftPct}` : liftPct}% к базе, CPL ${service.costPerContact.toFixed(0)} ₽. Лучше перераспределить бюджет на другие услуги или обновить оффер.`
                : `${service.title} пока без устойчивого перевеса. Нужен A/B период по цене, заголовку и связке с XL/выделением цены.`;

          return {
            service: service.title,
            listings: service.listings,
            avgContactRate: service.avgContactRate,
            costPerContact: service.costPerContact,
            baselineContactRate: baselineRate,
            baselineCostPerContact: baselineCpl,
            contactLiftPct: liftPct,
            cplDeltaPct,
            marketVolume,
            verdict,
            confidence:
              service.totalContacts >= 18 ? 'high' : service.totalContacts >= 8 ? 'medium' : 'low',
            recommendation,
          };
        })
        .sort((left, right) => {
          const scoreLeft =
            left.contactLiftPct - Math.max(0, left.cplDeltaPct) * 0.35 + left.listings * 0.7;
          const scoreRight =
            right.contactLiftPct - Math.max(0, right.cplDeltaPct) * 0.35 + right.listings * 0.7;
          return scoreRight - scoreLeft;
        });

      return {
        generatedAt: new Date().toISOString(),
        items: sorted,
        recommendations: {
          best,
          weak,
        },
        serviceInsights,
        promotionPlaybook,
      };
    });
  }

  async learningSummary(from?: string, to?: string, accountId?: number, days?: string | number) {
    const key = this.responseCacheKey('learningSummary', [from, to, accountId, days]);
    return this.withResponseCache(key, async () => {
      await this.ensureFreshData();
      const range = rangeOrDefault(from, to, days);
      const scopedAccountId = normalizeAccountId(accountId);

      const [rows, completedOrders] = await Promise.all([
        this.prisma.marketplaceConversationLearning.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            platform: MarketplacePlatform.AVITO,
            ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
            messageAt: { gte: range.from, lte: range.to },
          },
          orderBy: { messageAt: 'asc' },
          take: 5000,
        }),
        this.prisma.order.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            status: OrderStatus.COMPLETED,
            salesChannel: SalesChannel.AVITO,
            date: { gte: range.from, lte: range.to },
          },
          select: {
            date: true,
            client: {
              select: {
                city: true,
              },
            },
          },
        }),
      ]);

      const filteredCategories = new Map<string, number>();
      const normalizedRows = rows.map(row => {
        const text = this.normalizeLearningText(row.text);
        const family = this.extractProductFamily(row.itemTitle);
        const filterReason =
          this.getLearningFilterReason(row.messageType, text, row.hasImage) ||
          this.getTrainingScopeReason(row.itemTitle);
        if (filterReason) {
          filteredCategories.set(filterReason, (filteredCategories.get(filterReason) || 0) + 1);
        }
        return {
          ...row,
          cleanText: text,
          filterReason,
          family,
          variants: this.extractListingVariants(row.itemTitle),
        };
      });

      const usefulRows = normalizedRows.filter(row => !row.filterReason);
      const inbound = usefulRows.filter(row => String(row.direction).toLowerCase() === 'in');
      const outbound = usefulRows.filter(row => String(row.direction).toLowerCase() !== 'in');

      const hourCounts = new Array(24).fill(0);
      inbound.forEach(row => {
        hourCounts[toMoscowDate(row.messageAt).getHours()] += 1;
      });

      const topHours = hourCounts
        .map((count, hour) => ({ hour, count }))
        .filter(row => row.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const weekdayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
      const weekdayCounts = new Array(7).fill(0);
      inbound.forEach(row => {
        weekdayCounts[toMoscowDate(row.messageAt).getDay()] += 1;
      });
      const topWeekdays = weekdayCounts
        .map((count, weekday) => ({ weekday, label: weekdayNames[weekday], count }))
        .filter(row => row.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const observedInboundDays = Math.max(
        1,
        new Set(inbound.map(row => row.messageAt.toISOString().slice(0, 10))).size,
      );
      const observedWeeks = Math.max(1, observedInboundDays / 7);
      const nowMoscow = toMoscowDate(new Date());
      const nextHour = (nowMoscow.getHours() + 1) % 24;
      const expectedIncomingNextHour = Number(
        (hourCounts[nextHour] / observedInboundDays).toFixed(2),
      );
      const tomorrow = new Date(nowMoscow);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowWeekday = tomorrow.getDay();
      const expectedIncomingTomorrowBase = Number(
        ((weekdayCounts[tomorrowWeekday] || 0) / observedWeeks).toFixed(1),
      );
      const weatherDemand = await this.buildWeatherDemandInsights(completedOrders, tomorrow);
      const expectedIncomingTomorrow = Number(
        (expectedIncomingTomorrowBase * (weatherDemand?.demandFactor ?? 1)).toFixed(1),
      );
      const tomorrowHotHours = topHours
        .slice(0, 3)
        .map(item => `${String(item.hour).padStart(2, '0')}:00`);
      const weatherForecastLine = weatherDemand?.summary || '';
      const demandForecastLine = `Прогноз по входящим: в следующий час (${String(nextHour).padStart(2, '0')}:00) ожидается около ${expectedIncomingNextHour} новых обращений, на ${weekdayNames[tomorrowWeekday]} — около ${expectedIncomingTomorrow}.${weatherForecastLine ? ` ${weatherForecastLine}` : ''}`;

      const priceBuckets = new Map<string, number>();
      usefulRows.forEach(row => {
        const numeric = this.extractPrice(row.priceLabel);
        if (!numeric) return;
        const bucket =
          numeric < 30000 ? 'до 30 000 ₽' : numeric < 50000 ? '30 000–50 000 ₽' : 'от 50 000 ₽';
        priceBuckets.set(bucket, (priceBuckets.get(bucket) || 0) + 1);
      });

      const familyMap = new Map<
        string,
        {
          family: string;
          dialogs: Set<string>;
          positiveDialogs: Set<string>;
          variants: Map<string, number>;
          intents: Map<string, number>;
          patterns: Map<string, number>;
          successfulPatterns: Map<string, number>;
          exampleQuestions: Set<string>;
          qaPairs: Map<
            string,
            { question: string; answer: string; count: number; successCount: number }
          >;
        }
      >();
      const intentCounts = new Map<string, number>();
      const responsePatternCounts = new Map<string, number>();
      const successfulResponsePatternCounts = new Map<string, number>();
      const answerPairCounts = new Map<
        string,
        { family: string; question: string; answer: string; count: number; successCount: number }
      >();
      const dialogsWithPositiveSignal = new Set<string>();
      let responsePairs = 0;

      const rowsByChat = new Map<string, typeof normalizedRows>();
      for (const row of normalizedRows) {
        const key = `${row.marketplaceAccountId}:${row.chatId}`;
        const group = rowsByChat.get(key) || [];
        group.push(row);
        rowsByChat.set(key, group);
      }

      for (const [chatKey, chatRows] of rowsByChat.entries()) {
        const usefulChatRows = chatRows.filter(row => !row.filterReason);
        for (let index = 0; index < usefulChatRows.length; index += 1) {
          const current = usefulChatRows[index];
          if (String(current.direction).toLowerCase() !== 'in') continue;

          const family =
            current.family || this.extractProductFamily(current.itemTitle) || 'Общие консультации';
          const bucket = familyMap.get(family) || {
            family,
            dialogs: new Set<string>(),
            positiveDialogs: new Set<string>(),
            variants: new Map<string, number>(),
            intents: new Map<string, number>(),
            patterns: new Map<string, number>(),
            successfulPatterns: new Map<string, number>(),
            exampleQuestions: new Set<string>(),
            qaPairs: new Map<
              string,
              { question: string; answer: string; count: number; successCount: number }
            >(),
          };
          bucket.dialogs.add(chatKey);
          for (const variant of current.variants) {
            this.incrementCounter(bucket.variants, variant);
          }

          const intents = this.detectCustomerIntents(current.cleanText);
          intents.forEach(intent => {
            this.incrementCounter(bucket.intents, intent);
            this.incrementCounter(intentCounts, intent);
          });

          const question = this.normalizeQuestionText(current.cleanText);
          const questionTemplate = this.normalizeQuestionTemplate(
            current.cleanText,
            family,
            current.variants,
          );
          if (question) {
            bucket.exampleQuestions.add(question);
          }

          const nextOutbound = usefulChatRows
            .slice(index + 1)
            .find(row => String(row.direction).toLowerCase() !== 'in');
          if (nextOutbound) {
            const pattern = this.normalizeManagerPattern(
              nextOutbound.cleanText,
              family,
              current.variants,
            );
            const laterInboundRows = usefulChatRows
              .slice(index + 1)
              .filter(row => String(row.direction).toLowerCase() === 'in');
            const hasPositiveSignal = this.isSuccessfulDealSignal(
              current.cleanText,
              laterInboundRows.map(row => row.cleanText),
              nextOutbound.cleanText,
            );
            if (pattern) {
              responsePairs += 1;
              this.incrementCounter(bucket.patterns, pattern);
              this.incrementCounter(responsePatternCounts, pattern);
              if (hasPositiveSignal) {
                this.incrementCounter(bucket.successfulPatterns, pattern);
                this.incrementCounter(successfulResponsePatternCounts, pattern);
              }
            }

            if (questionTemplate && pattern) {
              const pairKey = `${questionTemplate}|||${pattern}`;
              const familyPair = bucket.qaPairs.get(pairKey) || {
                question: questionTemplate,
                answer: pattern,
                count: 0,
                successCount: 0,
              };
              familyPair.count += 1;
              if (hasPositiveSignal) familyPair.successCount += 1;
              bucket.qaPairs.set(pairKey, familyPair);

              const globalPair = answerPairCounts.get(pairKey) || {
                family,
                question: questionTemplate,
                answer: pattern,
                count: 0,
                successCount: 0,
              };
              globalPair.count += 1;
              if (hasPositiveSignal) globalPair.successCount += 1;
              answerPairCounts.set(pairKey, globalPair);
            }

            if (hasPositiveSignal) {
              bucket.positiveDialogs.add(chatKey);
              dialogsWithPositiveSignal.add(chatKey);
            }
          }

          familyMap.set(family, bucket);
        }
      }

      const productFamilies = Array.from(familyMap.values())
        .map(family => {
          const intents = this.sortMapEntries(family.intents, 6);
          const meaningfulIntents =
            intents.length > 1 ? intents.filter(item => item.label !== 'Общее уточнение') : intents;

          return {
            family: family.family,
            dialogs: family.dialogs.size,
            successfulDialogs: family.positiveDialogs.size,
            variants: this.sortMapEntries(family.variants, 6).map(item => item.label),
            customerIntents: meaningfulIntents.slice(0, 5),
            responsePatterns: this.sortMapEntries(
              family.successfulPatterns.size ? family.successfulPatterns : family.patterns,
              4,
            ).map(item => ({
              pattern: item.label,
              count: item.count,
            })),
            answerSuggestions: Array.from(family.qaPairs.values())
              .sort((left, right) => {
                if (right.successCount !== left.successCount)
                  return right.successCount - left.successCount;
                return right.count - left.count;
              })
              .slice(0, 4)
              .map(pair => ({
                question: pair.question,
                answer: pair.answer,
                count: pair.count,
                successCount: pair.successCount,
                successRate:
                  pair.count > 0 ? Number(((pair.successCount / pair.count) * 100).toFixed(1)) : 0,
              })),
            exampleQuestions: Array.from(family.exampleQuestions).slice(0, 4),
          };
        })
        .sort((left, right) => right.dialogs - left.dialogs)
        .slice(0, 8);

      return {
        generatedAt: new Date().toISOString(),
        corpus: {
          totalExamples: rows.length,
          usefulExamples: usefulRows.length,
          filteredExamples: rows.length - usefulRows.length,
          inboundExamples: inbound.length,
          outboundExamples: outbound.length,
          uniqueChats: new Set(rows.map(row => row.chatId)).size,
          uniqueListings: new Set(rows.map(row => row.itemExternalId).filter(Boolean)).size,
          responsePairs,
          positiveSignalDialogs: dialogsWithPositiveSignal.size,
        },
        topHours,
        topWeekdays,
        priceBuckets: Array.from(priceBuckets.entries())
          .map(([rangeLabel, count]) => ({
            rangeLabel,
            count,
          }))
          .sort((left, right) => right.count - left.count),
        productFamilies,
        customerIntents: this.sortMapEntries(intentCounts, 10),
        responsePatterns: this.sortMapEntries(
          successfulResponsePatternCounts.size
            ? successfulResponsePatternCounts
            : responsePatternCounts,
          10,
        ).map(item => ({
          pattern: item.label,
          count: item.count,
        })),
        answerSuggestions: Array.from(answerPairCounts.values())
          .sort((left, right) => {
            if (right.successCount !== left.successCount)
              return right.successCount - left.successCount;
            return right.count - left.count;
          })
          .slice(0, 10)
          .map(pair => ({
            family: pair.family,
            question: pair.question,
            answer: pair.answer,
            count: pair.count,
            successCount: pair.successCount,
            successRate:
              pair.count > 0 ? Number(((pair.successCount / pair.count) * 100).toFixed(1)) : 0,
          })),
        filteredCategories: this.sortMapEntries(filteredCategories, 8),
        demandForecast: {
          nextHourMsk: `${String(nextHour).padStart(2, '0')}:00`,
          expectedIncomingNextHour,
          tomorrowWeekday: weekdayNames[tomorrowWeekday],
          expectedIncomingTomorrow,
          expectedIncomingTomorrowBase,
          weatherAdjustmentPct: weatherDemand
            ? Number(((weatherDemand.demandFactor - 1) * 100).toFixed(1))
            : 0,
          weatherSummary: weatherDemand?.summary || null,
          weatherConfidence: weatherDemand?.confidence || null,
          weatherTopCities: weatherDemand?.topCities || [],
          hotHours: tomorrowHotHours,
        },
        recommendations: [
          demandForecastLine,
          ...this.buildLearningRecommendations({
            topHours,
            topWeekdays,
            productFamilies,
            customerIntents: this.sortMapEntries(intentCounts, 5),
            responsePatterns: Array.from(answerPairCounts.values())
              .sort((left, right) => {
                if (right.successCount !== left.successCount)
                  return right.successCount - left.successCount;
                return right.count - left.count;
              })
              .slice(0, 5)
              .map(pair => ({ label: pair.answer, count: pair.count })),
            filteredExamples: rows.length - usefulRows.length,
            positiveSignalDialogs: dialogsWithPositiveSignal.size,
          }),
        ],
      };
    });
  }

  async replySuggestions(input: {
    question?: string;
    itemTitle?: string;
    accountId?: number;
    days?: string | number;
    limit?: number;
  }) {
    const cleanQuestion = this.normalizeLearningText(input.question);
    const scopedAccountId = normalizeAccountId(input.accountId);
    const normalizedLimit =
      Number.isFinite(Number(input.limit)) && Number(input.limit) > 0
        ? Math.min(Math.floor(Number(input.limit)), 6)
        : 3;
    const family = this.extractProductFamily(input.itemTitle);
    const variants = this.extractListingVariants(input.itemTitle);
    const key = this.responseCacheKey('replySuggestions', [
      cleanQuestion,
      input.itemTitle,
      scopedAccountId,
      input.days,
      normalizedLimit,
    ]);

    return this.withResponseCache(key, async () => {
      if (!cleanQuestion || cleanQuestion.length < 6) {
        return {
          generatedAt: new Date().toISOString(),
          family,
          intents: [],
          suggestions: [],
        };
      }

      await this.ensureFreshData();

      const range = rangeOrDefault(undefined, undefined, input.days || 120);
      const questionTemplate =
        this.normalizeQuestionTemplate(cleanQuestion, family || undefined, variants) ||
        this.normalizeQuestionTemplate(cleanQuestion, undefined, variants) ||
        this.normalizeQuestionText(cleanQuestion);
      const requestedIntents = this.detectCustomerIntents(cleanQuestion);

      const tokenize = (value?: string | null) =>
        Array.from(
          new Set(
            this.normalizeLearningText(value)
              .toLowerCase()
              .replace(/\{[^}]+\}/g, ' ')
              .replace(/[^\p{L}\p{N}\s]/gu, ' ')
              .split(/\s+/)
              .map(token => token.trim())
              .filter(token => token.length >= 3 && !TRAINING_STOPWORDS.has(token)),
          ),
        );

      const requestedTokens = tokenize(questionTemplate || cleanQuestion);
      const rows = await this.prisma.marketplaceConversationLearning.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          platform: MarketplacePlatform.AVITO,
          ...(scopedAccountId ? { marketplaceAccountId: scopedAccountId } : {}),
          messageAt: { gte: range.from, lte: range.to },
        },
        orderBy: { messageAt: 'asc' },
        take: 5000,
      });

      const normalizedRows = rows.map(row => {
        const text = this.normalizeLearningText(row.text);
        const rowFamily = this.extractProductFamily(row.itemTitle);
        const filterReason =
          this.getLearningFilterReason(row.messageType, text, row.hasImage) ||
          this.getTrainingScopeReason(row.itemTitle);

        return {
          ...row,
          cleanText: text,
          filterReason,
          family: rowFamily,
          variants: this.extractListingVariants(row.itemTitle),
        };
      });

      const rowsByChat = new Map<string, typeof normalizedRows>();
      for (const row of normalizedRows) {
        const chatKey = `${row.marketplaceAccountId}:${row.chatId}`;
        const bucket = rowsByChat.get(chatKey) || [];
        bucket.push(row);
        rowsByChat.set(chatKey, bucket);
      }

      const candidateMap = new Map<
        string,
        {
          answer: string;
          family: string;
          count: number;
          successCount: number;
          exactQuestionMatches: number;
          sameFamilyMatches: number;
          maxOverlap: number;
          score: number;
          matchedIntents: Set<string>;
          exampleQuestions: Map<string, number>;
        }
      >();

      for (const chatRows of rowsByChat.values()) {
        const usefulChatRows = chatRows.filter(row => !row.filterReason);
        for (let index = 0; index < usefulChatRows.length; index += 1) {
          const current = usefulChatRows[index];
          if (String(current.direction).toLowerCase() !== 'in') continue;

          const nextOutbound = usefulChatRows
            .slice(index + 1)
            .find(row => String(row.direction).toLowerCase() !== 'in');
          if (!nextOutbound) continue;

          const currentFamily = current.family || 'Общие консультации';
          const pairQuestionTemplate =
            this.normalizeQuestionTemplate(
              current.cleanText,
              current.family || undefined,
              current.variants,
            ) ||
            this.normalizeQuestionTemplate(current.cleanText, undefined, current.variants) ||
            this.normalizeQuestionText(current.cleanText);
          const answerPattern = this.normalizeManagerPattern(
            nextOutbound.cleanText,
            current.family || undefined,
            current.variants,
          );

          if (!answerPattern) continue;

          const pairIntents = this.detectCustomerIntents(current.cleanText);
          const pairTokens = tokenize(pairQuestionTemplate || current.cleanText);
          const overlapCount = pairTokens.filter(token => requestedTokens.includes(token)).length;
          const tokenOverlap = requestedTokens.length ? overlapCount / requestedTokens.length : 0;
          const exactQuestion = Boolean(
            questionTemplate && pairQuestionTemplate && pairQuestionTemplate === questionTemplate,
          );
          const sameFamily = Boolean(family && current.family && current.family === family);
          const matchedIntents = requestedIntents.filter(intent => pairIntents.includes(intent));
          const shouldUseCandidate =
            exactQuestion || sameFamily || matchedIntents.length > 0 || tokenOverlap >= 0.34;

          if (!shouldUseCandidate) continue;

          const laterInboundRows = usefulChatRows
            .slice(index + 1)
            .filter(row => String(row.direction).toLowerCase() === 'in');
          const hasPositiveSignal = this.isSuccessfulDealSignal(
            current.cleanText,
            laterInboundRows.map(row => row.cleanText),
            nextOutbound.cleanText,
          );
          const candidateKey = `${currentFamily}|||${answerPattern}`;
          const candidate = candidateMap.get(candidateKey) || {
            answer: answerPattern,
            family: currentFamily,
            count: 0,
            successCount: 0,
            exactQuestionMatches: 0,
            sameFamilyMatches: 0,
            maxOverlap: 0,
            score: 0,
            matchedIntents: new Set<string>(),
            exampleQuestions: new Map<string, number>(),
          };

          candidate.count += 1;
          if (hasPositiveSignal) candidate.successCount += 1;
          if (exactQuestion) candidate.exactQuestionMatches += 1;
          if (sameFamily) candidate.sameFamilyMatches += 1;
          candidate.maxOverlap = Math.max(candidate.maxOverlap, tokenOverlap);
          candidate.score +=
            (exactQuestion ? 18 : 0) +
            (sameFamily ? 8 : 0) +
            matchedIntents.length * 4 +
            Math.round(tokenOverlap * 10) +
            (hasPositiveSignal ? 6 : 2);
          matchedIntents.forEach(intent => candidate.matchedIntents.add(intent));

          const exampleQuestion = this.normalizeQuestionText(current.cleanText);
          if (exampleQuestion) {
            candidate.exampleQuestions.set(
              exampleQuestion,
              (candidate.exampleQuestions.get(exampleQuestion) || 0) + 1,
            );
          }

          candidateMap.set(candidateKey, candidate);
        }
      }

      const suggestions = Array.from(candidateMap.values())
        .sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score;
          if (right.successCount !== left.successCount)
            return right.successCount - left.successCount;
          return right.count - left.count;
        })
        .slice(0, normalizedLimit)
        .map(candidate => {
          const successRate =
            candidate.count > 0
              ? Number(((candidate.successCount / candidate.count) * 100).toFixed(1))
              : 0;
          const reason = candidate.exactQuestionMatches
            ? 'Совпадает с похожим вопросом клиента'
            : candidate.sameFamilyMatches && candidate.matchedIntents.size
              ? 'Совпадает товарная группа и сценарий обращения'
              : candidate.sameFamilyMatches
                ? 'Подходит по той же товарной группе'
                : candidate.matchedIntents.size
                  ? 'Подходит по типу клиентского вопроса'
                  : 'Похоже на удачный ответ из обученного корпуса';

          return {
            answer: candidate.answer,
            family: candidate.family,
            count: candidate.count,
            successCount: candidate.successCount,
            successRate,
            exactQuestionMatches: candidate.exactQuestionMatches,
            sameFamilyMatches: candidate.sameFamilyMatches,
            matchedIntents: Array.from(candidate.matchedIntents),
            tokenOverlap: Number(candidate.maxOverlap.toFixed(2)),
            reason,
            exampleQuestions: Array.from(candidate.exampleQuestions.entries())
              .sort((left, right) => right[1] - left[1])
              .slice(0, 2)
              .map(([question]) => question),
          };
        });

      return {
        generatedAt: new Date().toISOString(),
        family,
        question: cleanQuestion,
        questionTemplate,
        intents: requestedIntents,
        suggestions,
      };
    });
  }

  private async buildWeatherDemandInsights(
    completedOrders: Array<{ date: Date; client: { city: string | null } | null }>,
    tomorrow: Date,
  ) {
    const cityBuckets = new Map<string, { city: string; dates: Date[] }>();
    for (const order of completedOrders) {
      const normalizedCity = this.normalizeCityName(order.client?.city);
      if (!normalizedCity) continue;
      const bucket = cityBuckets.get(normalizedCity) || {
        city: this.displayCityName(order.client?.city || normalizedCity),
        dates: [],
      };
      bucket.dates.push(order.date);
      cityBuckets.set(normalizedCity, bucket);
    }

    const topCities = Array.from(cityBuckets.entries())
      .map(([key, value]) => ({
        key,
        city: value.city,
        dates: value.dates,
      }))
      .filter(row => row.dates.length >= 2)
      .sort((left, right) => right.dates.length - left.dates.length)
      .slice(0, 4);

    if (!topCities.length) return null;

    const totalCityDeals = topCities.reduce((acc, city) => acc + city.dates.length, 0);
    if (!totalCityDeals) return null;

    const tomorrowDateKey = toMoscowDate(tomorrow).toISOString().slice(0, 10);
    const citySummaries: Array<{
      city: string;
      deals: number;
      tomorrowClass: WeatherDemandClass;
      tomorrowTempMin: number | null;
      tomorrowTempMax: number | null;
      tomorrowPrecipitation: number | null;
      historicalScore: number;
      matchedDeals: number;
    }> = [];

    for (const city of topCities) {
      const geo = await this.getWeatherGeo(city.key, city.city);
      if (!geo) continue;

      const dateKeys = city.dates.map(date => toMoscowDate(date).toISOString().slice(0, 10));
      const sortedDateKeys = [...dateKeys].sort((left, right) => left.localeCompare(right));
      const startDate = sortedDateKeys[0];
      const endDate = sortedDateKeys[sortedDateKeys.length - 1];
      const archive = await this.getArchiveWeather(geo.latitude, geo.longitude, startDate, endDate);
      const tomorrowWeather = await this.getForecastWeather(
        geo.latitude,
        geo.longitude,
        tomorrowDateKey,
      );
      if (!tomorrowWeather) continue;

      let historicalScore = 0;
      let matchedDeals = 0;
      for (const dateKey of dateKeys) {
        const point = archive?.get(dateKey);
        if (!point) continue;
        const weatherClass = this.classifyWeatherDemand(
          point.tempMean,
          point.precipitationMm,
          null,
        );
        historicalScore += WEATHER_CLASS_DEMAND_SCORE[weatherClass];
        matchedDeals += 1;
      }
      if (matchedDeals > 0) {
        historicalScore /= matchedDeals;
      }

      const tomorrowClass = this.classifyWeatherDemand(
        tomorrowWeather.tempMax != null && tomorrowWeather.tempMin != null
          ? (tomorrowWeather.tempMax + tomorrowWeather.tempMin) / 2
          : null,
        tomorrowWeather.precipitationMm,
        tomorrowWeather.precipitationProbability,
      );

      citySummaries.push({
        city: city.city,
        deals: city.dates.length,
        tomorrowClass,
        tomorrowTempMin: tomorrowWeather.tempMin,
        tomorrowTempMax: tomorrowWeather.tempMax,
        tomorrowPrecipitation: tomorrowWeather.precipitationMm,
        historicalScore,
        matchedDeals,
      });
    }

    if (!citySummaries.length) return null;

    let weightedHistoricalScore = 0;
    let weightedTomorrowScore = 0;
    let matchedDealsTotal = 0;

    for (const city of citySummaries) {
      const weight = city.deals / totalCityDeals;
      weightedHistoricalScore += city.historicalScore * weight;
      weightedTomorrowScore += WEATHER_CLASS_DEMAND_SCORE[city.tomorrowClass] * weight;
      matchedDealsTotal += city.matchedDeals;
    }

    const deltaScore = weightedTomorrowScore - weightedHistoricalScore;
    const demandFactor = Number(this.clampNumber(1 + deltaScore, 0.82, 1.18).toFixed(3));
    const demandDeltaPct = Number(((demandFactor - 1) * 100).toFixed(1));
    const dominantClass = citySummaries.reduce(
      (acc, row) => {
        acc[row.tomorrowClass] = (acc[row.tomorrowClass] || 0) + row.deals;
        return acc;
      },
      {} as Record<WeatherDemandClass, number>,
    );
    const dominantTomorrowClass = (Object.entries(dominantClass).sort(
      (left, right) => right[1] - left[1],
    )[0]?.[0] || 'DRY_MILD') as WeatherDemandClass;
    const confidence =
      matchedDealsTotal >= 45 ? 'high' : matchedDealsTotal >= 18 ? 'medium' : 'low';

    const citiesText = citySummaries.map(city => city.city).join(', ');
    const shiftText =
      Math.abs(demandDeltaPct) < 1
        ? 'почти без сдвига к базовому спросу'
        : demandDeltaPct > 0
          ? `ожидается прирост вероятности закрытий примерно на ${Math.abs(demandDeltaPct)}%`
          : `ожидается снижение вероятности закрытий примерно на ${Math.abs(demandDeltaPct)}%`;

    const summary = `Погодный фактор: по ключевым городам (${citiesText}) на завтра преобладает ${WEATHER_CLASS_LABELS[dominantTomorrowClass]}; исторически в таких условиях ${shiftText}.`;

    return {
      demandFactor,
      demandDeltaPct,
      confidence,
      topCities: citySummaries.map(city => city.city),
      summary,
      byCity: citySummaries.map(city => ({
        city: city.city,
        deals: city.deals,
        tomorrowClass: city.tomorrowClass,
        tomorrowClassLabel: WEATHER_CLASS_LABELS[city.tomorrowClass],
        tomorrowTempRange:
          city.tomorrowTempMin == null || city.tomorrowTempMax == null
            ? null
            : `${Math.round(city.tomorrowTempMin)}…${Math.round(city.tomorrowTempMax)}°C`,
        tomorrowPrecipitationMm:
          city.tomorrowPrecipitation == null ? null : Number(city.tomorrowPrecipitation.toFixed(1)),
      })),
    };
  }

  private normalizeCityName(value?: string | null) {
    return this.normalizeLearningText(value)
      .toLowerCase()
      .replace(/^г\.\s*/i, '')
      .replace(/^город\s+/i, '')
      .replace(/[.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private displayCityName(value: string) {
    const normalized = this.normalizeLearningText(value)
      .replace(/^г\.\s*/i, '')
      .replace(/^город\s+/i, '')
      .trim();
    if (!normalized) return value;
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  private async getWeatherGeo(normalizedCity: string, displayCity: string) {
    const key = `geo:${normalizedCity}`;
    const cached = this.weatherGeocodeCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const query = encodeURIComponent(displayCity || normalizedCity);
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=ru&format=json`;
    const payload = await this.fetchJson(url);
    const first = Array.isArray(payload?.results) ? payload.results[0] : null;
    const value =
      first && Number.isFinite(Number(first.latitude)) && Number.isFinite(Number(first.longitude))
        ? {
            city: String(first.name || displayCity || normalizedCity),
            latitude: Number(first.latitude),
            longitude: Number(first.longitude),
            timezone: String(first.timezone || 'Europe/Moscow'),
          }
        : null;

    this.weatherGeocodeCache.set(key, {
      expiresAt: Date.now() + this.weatherCacheTtlMs,
      value,
    });

    return value;
  }

  private async getArchiveWeather(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string,
  ) {
    const key = `archive:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${startDate}:${endDate}`;
    const cached = this.weatherArchiveCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}` +
      `&start_date=${startDate}&end_date=${endDate}` +
      `&daily=temperature_2m_mean,precipitation_sum&timezone=Europe/Moscow`;
    const payload = await this.fetchJson(url);
    const dates = Array.isArray(payload?.daily?.time) ? payload.daily.time : [];
    const temps = Array.isArray(payload?.daily?.temperature_2m_mean)
      ? payload.daily.temperature_2m_mean
      : [];
    const precip = Array.isArray(payload?.daily?.precipitation_sum)
      ? payload.daily.precipitation_sum
      : [];
    const map = new Map<string, { tempMean: number | null; precipitationMm: number | null }>();
    for (let index = 0; index < dates.length; index += 1) {
      const date = String(dates[index] || '').trim();
      if (!date) continue;
      const tempMean = Number.isFinite(Number(temps[index])) ? Number(temps[index]) : null;
      const precipitationMm = Number.isFinite(Number(precip[index])) ? Number(precip[index]) : null;
      map.set(date, { tempMean, precipitationMm });
    }

    const value = map.size ? map : null;
    this.weatherArchiveCache.set(key, {
      expiresAt: Date.now() + this.weatherCacheTtlMs,
      value,
    });

    return value;
  }

  private async getForecastWeather(latitude: number, longitude: number, dateKey: string) {
    const key = `forecast:${latitude.toFixed(3)}:${longitude.toFixed(3)}:${dateKey}`;
    const cached = this.weatherForecastCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_mean,precipitation_sum' +
      '&timezone=Europe/Moscow&forecast_days=7';
    const payload = await this.fetchJson(url);
    const dates = Array.isArray(payload?.daily?.time) ? payload.daily.time : [];
    const tempMax = Array.isArray(payload?.daily?.temperature_2m_max)
      ? payload.daily.temperature_2m_max
      : [];
    const tempMin = Array.isArray(payload?.daily?.temperature_2m_min)
      ? payload.daily.temperature_2m_min
      : [];
    const precipSum = Array.isArray(payload?.daily?.precipitation_sum)
      ? payload.daily.precipitation_sum
      : [];
    const precipProb = Array.isArray(payload?.daily?.precipitation_probability_mean)
      ? payload.daily.precipitation_probability_mean
      : [];

    let value: {
      date: string;
      tempMin: number | null;
      tempMax: number | null;
      precipitationMm: number | null;
      precipitationProbability: number | null;
    } | null = null;

    for (let index = 0; index < dates.length; index += 1) {
      const date = String(dates[index] || '').trim();
      if (date !== dateKey) continue;
      value = {
        date,
        tempMin: Number.isFinite(Number(tempMin[index])) ? Number(tempMin[index]) : null,
        tempMax: Number.isFinite(Number(tempMax[index])) ? Number(tempMax[index]) : null,
        precipitationMm: Number.isFinite(Number(precipSum[index]))
          ? Number(precipSum[index])
          : null,
        precipitationProbability: Number.isFinite(Number(precipProb[index]))
          ? Number(precipProb[index])
          : null,
      };
      break;
    }

    this.weatherForecastCache.set(key, {
      expiresAt: Date.now() + 90 * 60 * 1000,
      value,
    });

    return value;
  }

  private classifyWeatherDemand(
    temperatureMean: number | null,
    precipitationMm: number | null,
    precipitationProbability: number | null,
  ): WeatherDemandClass {
    if ((precipitationMm || 0) >= 2.5 || (precipitationProbability || 0) >= 60) {
      return 'WET';
    }
    if (temperatureMean != null && temperatureMean <= -2) {
      return 'COLD';
    }
    if (temperatureMean != null && temperatureMean >= 28) {
      return 'HOT';
    }
    return 'DRY_MILD';
  }

  private clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  private async fetchJson(url: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          accept: 'application/json',
          'user-agent': 'GameCRM-analytics/1.0',
        },
      });
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildLearningRecommendations(input: {
    topHours: Array<{ hour: number; count: number }>;
    topWeekdays: Array<{ weekday: number; label: string; count: number }>;
    productFamilies: Array<{ family: string; dialogs: number; successfulDialogs: number }>;
    customerIntents: Array<{ label: string; count: number }>;
    responsePatterns: Array<{ label: string; count: number }>;
    filteredExamples: number;
    positiveSignalDialogs: number;
  }) {
    const recommendations: string[] = [];
    if (input.topHours[0]) {
      recommendations.push(
        `Пик живых входящих обращений сейчас приходится на ${String(input.topHours[0].hour).padStart(2, '0')}:00.`,
      );
    }
    if (input.topWeekdays[0]) {
      recommendations.push(
        `Самый плотный день по обращениям сейчас: ${input.topWeekdays[0].label}.`,
      );
    }
    if (input.productFamilies[0]) {
      recommendations.push(
        `Больше всего обучающих диалогов сейчас по семейству ${input.productFamilies[0].family}.`,
      );
    }
    if (input.customerIntents[0]) {
      recommendations.push(
        `Чаще всего покупатели приходят с вопросом: ${input.customerIntents[0].label.toLowerCase()}.`,
      );
    }
    if (input.responsePatterns[0]) {
      recommendations.push(
        `Для подсказок менеджеру уже накопились повторяющиеся удачные ответы: ${input.responsePatterns[0].label}.`,
      );
    }
    if (input.positiveSignalDialogs > 0) {
      recommendations.push(
        `Есть ${input.positiveSignalDialogs} диалогов с позитивным клиентским сигналом — их можно использовать как эталон для будущих подсказок.`,
      );
    }
    if (input.filteredExamples > 0) {
      recommendations.push(
        `Системный шум и медиа без текста уже отфильтрованы: ${input.filteredExamples} сообщений не попадают в обучение.`,
      );
    }
    return recommendations;
  }

  private extractPrice(priceLabel?: string | null) {
    const normalized = String(priceLabel || '').replace(/\s/g, '');
    const match = normalized.match(/(\d{2,7})/);
    if (!match) return 0;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : 0;
  }

  private normalizeLearningText(text?: string | null) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .trim();
  }

  private getTrainingScopeReason(itemTitle?: string | null) {
    return this.extractProductFamily(itemTitle) ? null : 'Нерелевантные объявления';
  }

  private getLearningFilterReason(
    messageType?: string | null,
    text?: string | null,
    hasImage?: boolean,
  ) {
    const normalized = this.normalizeLearningText(text);
    if (!normalized) return 'Пустые сообщения';
    if (String(messageType || '').toLowerCase() === 'system') return 'Системные сообщения';
    if (hasImage && normalized.length < 20 && /^(изображение|фото)$/i.test(normalized))
      return 'Медиа без текста';

    for (const pattern of TRAINING_FILTER_PATTERNS) {
      if (pattern.test(normalized)) {
        return pattern.label;
      }
    }

    return null;
  }

  private extractProductFamily(title?: string | null) {
    const normalized = this.normalizeLearningText(title).toLowerCase();
    if (!normalized) return null;

    for (const pattern of PRODUCT_FAMILY_PATTERNS) {
      if (pattern.regex.test(normalized)) {
        return pattern.family;
      }
    }

    if (!GAMING_TITLE_SIGNAL.test(normalized)) {
      return null;
    }

    const words = normalized
      .replace(/[^a-zа-я0-9\s]/gi, ' ')
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length >= 3 && !TRAINING_STOPWORDS.has(token))
      .slice(0, 2);

    if (!words.length) return null;

    return words.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  private extractListingVariants(title?: string | null) {
    const normalized = this.normalizeLearningText(title).toLowerCase();
    if (!normalized) return [];

    const variants = new Set<string>();
    const storageMatches =
      normalized.match(/\b(64|128|256|512|1024|2048)\s?(gb|гб)?\b|\b(1|2)\s?(tb|тб)\b/gi) || [];
    for (const match of storageMatches) {
      const cleaned = match
        .toUpperCase()
        .replace('ГБ', ' GB')
        .replace('GB', ' GB')
        .replace('ТБ', ' TB')
        .replace('TB', ' TB')
        .replace(/\s+/g, ' ')
        .trim();
      variants.add(cleaned);
    }

    ['oled', 'lcd', 'slim', 'pro', 'fat', 'digital', 'disc'].forEach(marker => {
      if (normalized.includes(marker)) {
        variants.add(marker.toUpperCase());
      }
    });

    return Array.from(variants);
  }

  private detectCustomerIntents(text: string) {
    const normalized = this.normalizeLearningText(text).toLowerCase();
    const intents = INTENT_PATTERNS.filter(pattern => pattern.regex.test(normalized)).map(
      pattern => pattern.label,
    );
    if (intents.length) return intents;
    return normalized.length >= 18 &&
      CUSTOMER_QUESTION_SIGNAL.test(normalized) &&
      CUSTOMER_BUSINESS_SIGNAL.test(normalized)
      ? ['Общее уточнение']
      : [];
  }

  private normalizeQuestionText(text: string) {
    const normalized = this.normalizeLearningText(text)
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized || normalized.length < 8) return null;
    if (/сообщение удалено|сообщение скрыто|объявление снято/i.test(normalized)) return null;
    if (!CUSTOMER_QUESTION_SIGNAL.test(normalized)) return null;
    if (!CUSTOMER_BUSINESS_SIGNAL.test(normalized)) return null;
    return normalized.slice(0, 180);
  }

  private normalizeQuestionTemplate(text: string, family?: string, variants: string[] = []) {
    let normalized = this.normalizeLearningText(text)
      .replace(/https?:\/\/\S+/gi, '{ссылка}')
      .replace(/\b\d{2,3}\s?\d{3}\b/g, '{цена}')
      .replace(/\b\d{2,6}\s?₽\b/gi, '{цена}')
      .replace(/\b\d{1,2}\s?(дней|дня|день|часов|часа|час)\b/gi, '{срок}')
      .replace(/\b(64|128|256|512|1024|2048)\s?(gb|гб)\b/gi, '{память}')
      .replace(/\b(1|2)\s?(tb|тб)\b/gi, '{память}');

    for (const variant of variants) {
      if (!variant) continue;
      normalized = normalized.replace(
        new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'),
        '{вариант}',
      );
    }

    if (family) {
      normalized = normalized.replace(
        new RegExp(family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'),
        '{товар}',
      );
    }

    normalized = normalized.replace(/\s+/g, ' ').trim();
    if (!normalized || normalized.length < 10) return null;
    if (!CUSTOMER_QUESTION_SIGNAL.test(normalized)) return null;
    if (!CUSTOMER_BUSINESS_SIGNAL.test(normalized)) return null;
    if (
      /(сообщение удалено|сообщение скрыто|объявление снято|объявление недоступно)/i.test(
        normalized,
      )
    )
      return null;
    return normalized.slice(0, 180);
  }

  private normalizeManagerPattern(text: string, family?: string, variants: string[] = []) {
    let normalized = this.normalizeLearningText(text);
    if (!normalized) return null;

    normalized = normalized
      .replace(/https?:\/\/\S+/gi, '{ссылка}')
      .replace(/\b\d{2,3}\s?\d{3}\b/g, '{цена}')
      .replace(/\b\d{2,6}\s?₽\b/gi, '{цена}')
      .replace(/\b\d{1,2}\s?(дней|дня|день|часов|часа|час)\b/gi, '{срок}')
      .replace(/\b(64|128|256|512|1024|2048)\s?(gb|гб)\b/gi, '{память}')
      .replace(/\b(1|2)\s?(tb|тб)\b/gi, '{память}');

    for (const variant of variants) {
      if (!variant) continue;
      normalized = normalized.replace(
        new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'),
        '{вариант}',
      );
    }

    if (family) {
      normalized = normalized.replace(
        new RegExp(family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'),
        '{товар}',
      );
    }

    normalized = normalized.replace(/\s+/g, ' ').trim();
    if (normalized.length < 12) return null;
    if (WEAK_MANAGER_PATTERNS.some(pattern => pattern.test(normalized))) return null;
    if (/(идиот|дебил|лох|дурак|олду?шк|пош[её]л|не мешай)/i.test(normalized)) return null;
    const informativeText = normalized
      .replace(/\{(цена|ссылка|вариант|память|товар|срок)\}/g, ' ')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .map(token => token.trim().toLowerCase())
      .filter(token => token.length > 2 && !TRAINING_STOPWORDS.has(token));
    if (informativeText.length < 4) return null;
    if (!BUSINESS_RESPONSE_SIGNAL.test(normalized)) return null;
    return normalized.slice(0, 220);
  }

  private hasPhoneSignal(text: string) {
    const normalized = this.normalizeLearningText(text).toLowerCase();
    return /(\+?\d[\d\s\-()]{8,}\d|номер[:\s]|тел[:\s]|телефон[:\s]|whatsapp|ватсап|вацап|tg[:\s]|телега|telegram)/i.test(
      normalized,
    );
  }

  private hasAddressSignal(text: string) {
    const normalized = this.normalizeLearningText(text).toLowerCase();
    return /(адрес|улиц|проспект|дом\s*\d+|квартир|подъезд|этаж|город|индекс|пвз|пункт выдачи|доставк[аи])/i.test(
      normalized,
    );
  }

  private hasManagerOrderLinkSignal(text: string) {
    const normalized = this.normalizeLearningText(text).toLowerCase();
    return (
      /(https?:\/\/\S+|avito\.ru\/|technoprimestore\.ru\/)/i.test(normalized) &&
      /(оформ|заказ|перейд|ссылк|оплат|корзин|доставк|checkout)/i.test(normalized)
    );
  }

  private isSuccessfulDealSignal(
    currentInboundText: string,
    laterInboundTexts: string[],
    nextOutboundText?: string | null,
  ) {
    const inboundTexts = [currentInboundText, ...laterInboundTexts].filter(Boolean);
    if (!inboundTexts.length) return false;

    const hasPositiveIntent = inboundTexts.some(text => this.isPositiveClientSignal(text));
    const hasPhone = inboundTexts.some(text => this.hasPhoneSignal(text));
    const hasAddress = inboundTexts.some(text => this.hasAddressSignal(text));
    const managerSentOrderLink = nextOutboundText
      ? this.hasManagerOrderLinkSignal(nextOutboundText)
      : false;

    if (hasPhone && hasAddress) return true;
    if (managerSentOrderLink && (hasPositiveIntent || hasPhone || hasAddress)) return true;
    return hasPositiveIntent;
  }

  private isPositiveClientSignal(text: string) {
    const normalized = this.normalizeLearningText(text).toLowerCase();
    return /(беру|заберу|подходит|устраивает|давайте оформим|готов(о|а)?|оплач|скиньте реквизиты|куда подъехать|когда забрать|броньте|резервируйте|можно оформить|оформляем|оформил|оформлена|скиньте адрес|отправляйте|подтверждаю|оставляю|заберу сегодня|завтра заберу|скидывайте ссылку|скидывайте реквизиты|забираю|берем|забронируй|бронируйте|готов купить|готова купить|приеду|подъеду|отправка нужна|доставка нужна|пишите адрес|куда оплачивать|давайте заказ|оформляй|оформляйте|вышлите ссылку на заказ|скиньте ссылку на заказ)/i.test(
      normalized,
    );
  }

  private sortMapEntries(
    map: Map<string, number>,
    limit = 10,
  ): Array<{ label: string; count: number }> {
    return Array.from(map.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, limit);
  }

  private incrementCounter(map: Map<string, number>, key: string, amount = 1) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + amount);
  }

  private isActiveListingStatus(statusLabel?: string | null) {
    const normalized = this.normalizeLearningText(statusLabel).toLowerCase();
    if (!normalized) return true;
    if (ARCHIVED_AVITO_STATUS_MARKERS.some(marker => normalized.includes(marker))) return false;
    if (ACTIVE_AVITO_STATUS_MARKERS.some(marker => normalized.includes(marker))) return true;
    return !/(old|removed|blocked|rejected|archiv|снят|архив|заверш|истек|блок|отклон)/i.test(
      normalized,
    );
  }
}
