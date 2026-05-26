import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import crypto from 'crypto';
import { ShopCrmSyncService } from './shop-crm-sync.service';
import { ShopTelegramCrmService } from './shop-telegram-crm.service';
import { ShopVkService } from './shop-vk.service';

type VkAuthMode = 'login' | 'link';

type VkStatePayload = {
  mode: VkAuthMode;
  redirectUri: string;
  iat: number;
  nonce: string;
};

type VkIdentity = {
  vkId: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
};

export type ShopVkAuthCompleteResult = {
  success: boolean;
  status: 'LOGGED_IN' | 'LINKED' | 'ALREADY_LINKED' | 'LINK_REQUIRED';
  message: string;
  customer?: any;
  shouldCreateSession?: boolean;
};

type PhoneAuthProvider = 'mock' | 'smsc_sms' | 'smsc_waitcall';

type PhoneAuthRequestResult = {
  success: boolean;
  delivery: 'mock' | 'sms' | 'waitcall' | 'messenger';
  expiresAt: string;
  message?: string;
  waitcallPhone?: string | null;
  channels?: Array<'telegram' | 'vk' | 'sms' | 'waitcall'>;
  retryAfterSec?: number;
};

type ShopCustomerAuthTarget = {
  id: number;
  phone: string | null;
  telegramId: string | null;
  telegramUsername: string | null;
  vkId: string | null;
  firstName: string | null;
  lastName: string | null;
  marketingConsent: boolean;
} | null;

@Injectable()
export class ShopAuthService {
  constructor(
    private prisma: PrismaService,
    private readonly crmSync: ShopCrmSyncService,
    private readonly telegramCrm: ShopTelegramCrmService,
    private readonly vkBot: ShopVkService,
  ) {}

  normalizePhone(input: string) {
    const digits = input.replace(/\D/g, '');
    if (digits.length === 10) {
      return `7${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('8')) {
      return `7${digits.slice(1)}`;
    }
    return digits;
  }

  private maskPhoneForLog(normalizedPhone: string) {
    if (normalizedPhone.length <= 4) return '****';
    return `${normalizedPhone.slice(0, 2)}***${normalizedPhone.slice(-2)}`;
  }

  private validateMobilePhone(input: string) {
    const rawDigits = String(input || '').replace(/\D/g, '');
    const normalized = this.normalizePhone(input || '');

    if (!rawDigits) {
      throw new BadRequestException('Укажите номер телефона.');
    }
    if (rawDigits.length < 11) {
      throw new BadRequestException(
        'Введите полный номер телефона: 11 цифр в формате +7 (9XX) XXX-XX-XX.',
      );
    }
    if (normalized.length !== 11 || !normalized.startsWith('7')) {
      throw new BadRequestException('Введите номер в формате +7 (9XX) XXX-XX-XX.');
    }
    if (!/^79\d{9}$/.test(normalized)) {
      throw new BadRequestException(
        'Укажите действующий мобильный номер в формате +7 (9XX) XXX-XX-XX.',
      );
    }

    return normalized;
  }

  private getPhoneAliases(input: string) {
    const normalized = this.normalizePhone(input);
    if (normalized.length !== 11) return [normalized].filter(Boolean);

    const local = normalized.slice(1);
    return Array.from(new Set([normalized, `8${local}`, `+${normalized}`]));
  }

  private toStoredCustomerPhone(input: string) {
    const normalized = this.normalizePhone(input);
    if (normalized.length === 11 && normalized.startsWith('7')) {
      return `8${normalized.slice(1)}`;
    }
    return normalized;
  }

  generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private generatePhoneAuthCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getPhoneAuthProvider(): PhoneAuthProvider {
    const raw = String(process.env.SHOP_PHONE_AUTH_PROVIDER || '')
      .trim()
      .toLowerCase();
    if (raw === 'smsc_sms') return 'smsc_sms';
    if (raw === 'smsc_waitcall') return 'smsc_waitcall';
    if (raw === 'smsc') return 'smsc_waitcall';
    if (raw === 'waitcall' || raw === 'call') return 'smsc_waitcall';
    if (raw === 'sms') return 'smsc_sms';

    const hasApiKey = Boolean(
      String(process.env.SHOP_SMSC_APIKEY || process.env.SMSC_APIKEY || '').trim(),
    );
    const password = String(
      process.env.SHOP_SMSC_PASSWORD ||
        process.env.SMSC_PASSWORD ||
        process.env.SHOP_SMSC_PSW ||
        process.env.SMSC_PSW ||
        '',
    ).trim();
    const hasLoginPassword =
      Boolean(String(process.env.SHOP_SMSC_LOGIN || process.env.SMSC_LOGIN || '').trim()) &&
      Boolean(password);

    if (hasApiKey || hasLoginPassword) {
      return 'smsc_waitcall';
    }

    return 'mock';
  }

  private appendSmscCredentials(params: URLSearchParams) {
    const apiKey = String(process.env.SHOP_SMSC_APIKEY || process.env.SMSC_APIKEY || '').trim();
    if (apiKey) {
      params.set('apikey', apiKey);
      return;
    }

    const login = String(process.env.SHOP_SMSC_LOGIN || process.env.SMSC_LOGIN || '').trim();
    const password = String(
      process.env.SHOP_SMSC_PASSWORD ||
        process.env.SMSC_PASSWORD ||
        process.env.SHOP_SMSC_PSW ||
        process.env.SMSC_PSW ||
        '',
    ).trim();
    if (!login || !password) {
      throw new ServiceUnavailableException('SMS/Call provider credentials are not configured');
    }

    params.set('login', login);
    params.set('psw', password);
  }

  private async callSmscJson(
    endpoint: 'send' | 'waitcall',
    params: URLSearchParams,
  ): Promise<Record<string, any>> {
    this.appendSmscCredentials(params);
    params.set('fmt', '3');
    params.set('charset', 'utf-8');

    const url =
      endpoint === 'send' ? 'https://smsc.ru/sys/send.php' : 'https://smsc.ru/sys/wait_call.php';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    })
      .catch(() => null)
      .finally(() => {
        clearTimeout(timeoutId);
      });

    if (!res) {
      throw new ServiceUnavailableException('Phone auth provider is unavailable');
    }

    const payload = (await res.json().catch(() => null)) as Record<string, any> | null;
    if (!res.ok) {
      throw new ServiceUnavailableException(`Phone auth provider HTTP ${res.status}`);
    }
    if (!payload) {
      throw new ServiceUnavailableException('Phone auth provider returned invalid payload');
    }
    if (payload.error || payload.error_code) {
      throw new BadRequestException(String(payload.error || 'Phone auth provider error'));
    }
    return payload;
  }

  private async sendSmscOtp(normalizedPhone: string, code: string) {
    const params = new URLSearchParams();
    params.set('phones', normalizedPhone);
    params.set('mes', `Код входа TechnoPrime: ${code}. Никому не сообщайте его.`);
    await this.callSmscJson('send', params);
  }

  private async requestSmscWaitcall(normalizedPhone: string) {
    const params = new URLSearchParams();
    params.set('phone', normalizedPhone);
    const payload = await this.callSmscJson('waitcall', params);
    const waitcallPhone = String(payload.phone || '').trim();
    if (!waitcallPhone) {
      throw new InternalServerErrorException('Phone auth provider did not return waitcall phone');
    }
    return waitcallPhone;
  }

  private getPhoneCallbackSecret() {
    return String(process.env.SHOP_SMSC_CALLBACK_SECRET || '').trim();
  }

  private verifyWaitcallSignature(input: { phone: string; ts: string; md5?: string | null }) {
    const secret = this.getPhoneCallbackSecret();
    if (!secret) {
      return true;
    }

    const md5 = String(input.md5 || '')
      .trim()
      .toLowerCase();
    if (!md5) return false;

    const expected = crypto
      .createHash('md5')
      .update(`${input.phone}:${input.ts}:${secret}`)
      .digest('hex')
      .toLowerCase();

    return expected === md5;
  }

  hashCode(code: string) {
    const secret = String(process.env.SHOP_OTP_SECRET || process.env.JWT_SECRET || '').trim();
    if (!secret) {
      throw new ServiceUnavailableException('OTP secret is not configured');
    }
    return crypto
      .createHash('sha256')
      .update(code + secret)
      .digest('hex');
  }

  private async findShopCustomerByPhone(normalizedPhone: string) {
    return this.prisma.shopCustomer.findFirst({
      where: { phone: { in: this.getPhoneAliases(normalizedPhone) } },
      select: {
        id: true,
        phone: true,
        telegramId: true,
        telegramUsername: true,
        vkId: true,
        firstName: true,
        lastName: true,
        marketingConsent: true,
      },
    });
  }

  private async enrichCustomerMessengerLinks(
    normalizedPhone: string,
    customer: ShopCustomerAuthTarget,
  ): Promise<ShopCustomerAuthTarget> {
    if (!customer) return customer;

    let nextTelegramId = customer.telegramId;
    const nextTelegramUsername = customer.telegramUsername;
    let nextVkId = customer.vkId;

    if (!nextTelegramId && nextTelegramUsername) {
      const consent = await this.prisma.shopTelegramConsent.findFirst({
        where: {
          telegramUsername: {
            equals: nextTelegramUsername,
            mode: 'insensitive',
          },
          consentedAt: { not: null },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          telegramUserId: true,
          revokedAt: true,
          consentedAt: true,
        },
      });

      const consentActive = Boolean(
        consent?.consentedAt && (!consent.revokedAt || consent.revokedAt < consent.consentedAt),
      );
      if (consentActive && consent?.telegramUserId) {
        nextTelegramId = consent.telegramUserId;
      }
    }

    if (!nextTelegramId || !nextVkId) {
      const client = await this.prisma.client.findFirst({
        where: {
          tenant: 'TECHNOPRIME',
          phone: { in: this.getPhoneAliases(normalizedPhone) },
        },
        orderBy: { id: 'desc' },
        select: {
          telegramId: true,
          vkId: true,
        },
      });

      if (!nextTelegramId && client?.telegramId) {
        nextTelegramId = client.telegramId;
      }
      if (!nextVkId && client?.vkId) {
        nextVkId = client.vkId;
      }
    }

    if (
      nextTelegramId !== customer.telegramId ||
      nextTelegramUsername !== customer.telegramUsername ||
      nextVkId !== customer.vkId
    ) {
      await this.prisma.shopCustomer
        .update({
          where: { id: customer.id },
          data: {
            telegramId: nextTelegramId || null,
            telegramUsername: nextTelegramUsername || null,
            vkId: nextVkId || null,
          },
        })
        .catch(() => undefined);
    }

    return {
      ...customer,
      telegramId: nextTelegramId,
      telegramUsername: nextTelegramUsername,
      vkId: nextVkId,
    };
  }

  private async invalidateUnusedCodes(phone: string) {
    await this.prisma.shopAuthCode.updateMany({
      where: {
        phone: { in: this.getPhoneAliases(phone) },
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  private async getPhoneAuthStats(phone: string) {
    const now = Date.now();
    const records = await this.prisma.shopAuthCode.findMany({
      where: {
        phone: { in: this.getPhoneAliases(phone) },
        createdAt: { gt: new Date(now - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        phone: true,
        createdAt: true,
        expiresAt: true,
        usedAt: true,
        customerId: true,
      },
    });

    const active =
      records.find(record => !record.usedAt && record.expiresAt.getTime() > now) || null;
    const last = records[0] || null;
    const count1h = records.filter(
      record => now - record.createdAt.getTime() < 60 * 60 * 1000,
    ).length;
    const count24h = records.length;

    return {
      active,
      last,
      count1h,
      count24h,
    };
  }

  private async sendOtpToLinkedChannels(
    customer: ShopCustomerAuthTarget,
    code: string,
    expiresAt: Date,
  ) {
    const delivered: Array<'telegram' | 'vk'> = [];

    if (customer?.telegramId) {
      const sent = await this.telegramCrm
        .sendOtpCode(customer.telegramId, code, expiresAt)
        .catch(() => false);
      if (sent) delivered.push('telegram');
    }

    if (customer?.vkId) {
      const sent = await this.vkBot.sendOtpCode(customer.vkId, code, expiresAt).catch(() => false);
      if (sent) delivered.push('vk');
    }

    return delivered;
  }

  private buildMessengerDeliveryMessage(channels: Array<'telegram' | 'vk'>) {
    if (channels.length === 2) {
      return 'Код отправлен в привязанные Telegram и VK. Если вы не запрашивали вход, просто проигнорируйте сообщение.';
    }
    if (channels[0] === 'telegram') {
      return 'Код отправлен в привязанный Telegram. Если вы не запрашивали вход, просто проигнорируйте сообщение.';
    }
    return 'Код отправлен в привязанный VK. Если вы не запрашивали вход, просто проигнорируйте сообщение.';
  }

  async requestPhoneCode(
    phone: string,
    meta?: { ip?: unknown; userAgent?: unknown; source?: unknown },
  ): Promise<PhoneAuthRequestResult> {
    const normalized = this.validateMobilePhone(phone);
    const rawIp = Array.isArray(meta?.ip) ? meta?.ip[0] : meta?.ip;
    const requestIp = String(rawIp || '')
      .split(',')[0]
      .trim()
      .slice(0, 120);
    const userAgent = String(meta?.userAgent || '')
      .trim()
      .slice(0, 240);
    const source = String(meta?.source || '')
      .trim()
      .slice(0, 240);

    await this.prisma.auditLog
      .create({
        data: {
          tenant: 'TECHNOPRIME',
          action: 'SHOP_PHONE_CODE_REQUEST',
          entityType: 'SHOP_AUTH',
          newData: {
            phone: normalized,
            ip: requestIp || null,
            userAgent: userAgent || null,
            source: source || null,
          } as any,
        },
      })
      .catch(() => undefined);

    let customer = await this.findShopCustomerByPhone(normalized);
    customer = await this.enrichCustomerMessengerLinks(normalized, customer);
    const messengerChannels = [
      ...(customer?.telegramId ? (['telegram'] as const) : []),
      ...(customer?.vkId ? (['vk'] as const) : []),
    ];
    const stats = await this.getPhoneAuthStats(normalized);
    const provider = this.getPhoneAuthProvider();
    const activeExpiresInSec = stats.active
      ? Math.max(0, Math.ceil((stats.active.expiresAt.getTime() - Date.now()) / 1000))
      : 0;
    const productionWithoutPhoneProvider =
      messengerChannels.length === 0 &&
      provider === 'mock' &&
      process.env.NODE_ENV === 'production';

    if (stats.count1h >= 5) {
      throw new BadRequestException(
        'Слишком много запросов для этого номера. Попробуйте снова через час.',
      );
    }

    if (stats.count24h >= 12) {
      throw new BadRequestException(
        'Лимит подтверждений для этого номера исчерпан на сегодня. Попробуйте завтра.',
      );
    }

    const resendCooldownSec =
      messengerChannels.length > 0 ? 60 : provider === 'smsc_sms' ? 180 : 120;
    const lastCreatedAt = stats.last?.createdAt?.getTime() || 0;
    const retryAfterSec = lastCreatedAt
      ? Math.max(0, resendCooldownSec - Math.floor((Date.now() - lastCreatedAt) / 1000))
      : 0;

    if (stats.active && messengerChannels.length > 0 && retryAfterSec > 0) {
      return {
        success: true,
        delivery: 'messenger',
        expiresAt: stats.active.expiresAt.toISOString(),
        channels: messengerChannels,
        retryAfterSec,
        message: `Код уже отправлен в ${messengerChannels.length > 1 ? 'привязанные Telegram и VK' : messengerChannels[0] === 'telegram' ? 'привязанный Telegram' : 'привязанный VK'}. Повторная отправка будет доступна через ${retryAfterSec} сек.`,
      };
    }

    if (stats.active && provider === 'smsc_sms') {
      return {
        success: true,
        delivery: 'sms',
        expiresAt: stats.active.expiresAt.toISOString(),
        channels: ['sms'],
        retryAfterSec: activeExpiresInSec,
        message: `Код уже отправлен на номер телефона и действует еще ${activeExpiresInSec} сек. Чтобы не создавать лишние платные отправки, новый код можно запросить после истечения срока.`,
      };
    }

    if (productionWithoutPhoneProvider) {
      return {
        success: false,
        delivery: 'mock',
        expiresAt: new Date().toISOString(),
        channels: [],
        message: customer?.telegramUsername
          ? 'Вход по номеру телефона недоступен: SMS/звонок не подключены. Откройте Telegram-бота и отправьте /login, чтобы обновить привязку.'
          : 'Вход по номеру телефона пока недоступен: SMS или подтверждение звонком еще не подключены.',
      };
    }

    const needPaidDelivery = messengerChannels.length === 0;
    if (needPaidDelivery && stats.count24h >= 3) {
      throw new BadRequestException(
        'Лимит подтверждений для этого номера исчерпан на сегодня. Попробуйте позже.',
      );
    }

    if (stats.active && retryAfterSec > 0 && provider === 'smsc_waitcall') {
      return {
        success: true,
        delivery: 'waitcall',
        expiresAt: stats.active.expiresAt.toISOString(),
        channels: ['waitcall'],
        retryAfterSec,
        message: `Запрос на подтверждение звонком уже создан. Повторный запрос будет доступен через ${retryAfterSec} сек.`,
      };
    }

    await this.invalidateUnusedCodes(normalized);

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    if (messengerChannels.length > 0) {
      const code = this.generatePhoneAuthCode();
      const codeHash = this.hashCode(code);

      await this.prisma.shopAuthCode.create({
        data: {
          phone: normalized,
          customerId: customer?.id || undefined,
          codeHash,
          expiresAt,
        },
      });

      const deliveredChannels = await this.sendOtpToLinkedChannels(customer, code, expiresAt);
      if (deliveredChannels.length > 0) {
        return {
          success: true,
          delivery: 'messenger',
          expiresAt: expiresAt.toISOString(),
          channels: deliveredChannels,
          message: this.buildMessengerDeliveryMessage(deliveredChannels),
        };
      }

      // If free channels exist but delivery failed, fall through to phone delivery below.
      await this.invalidateUnusedCodes(normalized);
    }

    if (provider === 'smsc_waitcall') {
      const waitcallPhone = await this.requestSmscWaitcall(normalized);

      await this.prisma.shopAuthCode.create({
        data: {
          phone: normalized,
          codeHash: this.hashCode(`waitcall:${waitcallPhone}:${expiresAt.getTime()}`),
          expiresAt,
        },
      });

      return {
        success: true,
        delivery: 'waitcall',
        expiresAt: expiresAt.toISOString(),
        waitcallPhone,
        channels: ['waitcall'],
        message:
          'Позвоните на указанный номер именно с того телефона, который ввели на сайте. После звонка вход завершится автоматически.',
      };
    }

    const code = this.generatePhoneAuthCode();
    const codeHash = this.hashCode(code);

    await this.prisma.shopAuthCode.create({
      data: {
        phone: normalized,
        customerId: customer?.id || undefined,
        codeHash,
        expiresAt,
      },
    });

    if (provider === 'smsc_sms') {
      await this.sendSmscOtp(normalized, code);
      return {
        success: true,
        delivery: 'sms',
        expiresAt: expiresAt.toISOString(),
        channels: ['sms'],
        message:
          'Код отправлен на номер телефона. Если вы не запрашивали вход, проигнорируйте сообщение.',
      };
    }

    if (process.env.NODE_ENV !== 'production' && process.env.SHOP_OTP_DEBUG === 'true') {
      console.log(`[SHOP OTP] Phone ${this.maskPhoneForLog(normalized)} => ${code}`);
    }

    if (process.env.NODE_ENV === 'production') {
      return {
        success: false,
        delivery: 'mock',
        expiresAt: expiresAt.toISOString(),
        channels: [],
        message: 'Вход по телефону пока недоступен: провайдер SMS/звонков не подключен.',
      };
    }

    return {
      success: true,
      delivery: 'mock',
      expiresAt: expiresAt.toISOString(),
      channels: [],
      message: 'Код сгенерирован. Для разработки смотрите серверный лог.',
    };
  }

  async createSession(customerId: number) {
    const ttlDays = Number(process.env.SHOP_SESSION_TTL_DAYS || 30);
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

    return this.prisma.shopSession.create({
      data: {
        customerId,
        expiresAt,
      },
    });
  }

  async getSession(sessionId?: string) {
    if (!sessionId) return null;

    return this.prisma.shopSession.findFirst({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { customer: true },
    });
  }

  async revokeSession(sessionId: string) {
    await this.prisma.shopSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(customerId: number) {
    await this.prisma.shopSession.updateMany({
      where: {
        customerId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  verifyTelegramPayload(payload: Record<string, string | number | null | undefined>) {
    const botToken = process.env.SHOP_BOT_TOKEN;
    if (!botToken) {
      return false;
    }

    const { hash, ...data } = payload;
    if (!hash) return false;

    const dataCheckString = Object.keys(data)
      .sort()
      .map(key => `${key}=${String(data[key] ?? '')}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (hmac !== hash) {
      return false;
    }

    const authDate = Number(payload.auth_date || 0);
    if (!authDate || Date.now() - authDate * 1000 > 24 * 60 * 60 * 1000) {
      return false;
    }

    return true;
  }

  private getVkAppId() {
    return String(process.env.SHOP_VK_APP_ID || process.env.VK_APP_ID || '').trim();
  }

  private getVkAppSecret() {
    return String(process.env.SHOP_VK_APP_SECRET || process.env.VK_APP_SECRET || '').trim();
  }

  private getVkApiVersion() {
    return String(
      process.env.SHOP_VK_API_VERSION || process.env.CRM_VK_API_VERSION || '5.199',
    ).trim();
  }

  private getVkOAuthScope() {
    return String(process.env.SHOP_VK_OAUTH_SCOPE || '').trim();
  }

  private getVkOAuthResponseType(): 'code' | 'token' {
    const raw = String(process.env.SHOP_VK_OAUTH_RESPONSE_TYPE || '')
      .trim()
      .toLowerCase();
    return raw === 'code' ? 'code' : 'token';
  }

  private getVkStateSecret() {
    const secret = String(
      process.env.SHOP_VK_OAUTH_STATE_SECRET ||
        process.env.SHOP_OTP_SECRET ||
        process.env.JWT_SECRET ||
        '',
    ).trim();
    if (!secret) {
      throw new ServiceUnavailableException('VK OAuth state secret is not configured');
    }
    return secret;
  }

  private encodeBase64Url(input: string) {
    return Buffer.from(input, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private decodeBase64Url(input: string) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
  }

  private createVkState(payload: VkStatePayload) {
    const encoded = this.encodeBase64Url(JSON.stringify(payload));
    const signature = crypto
      .createHmac('sha256', this.getVkStateSecret())
      .update(encoded)
      .digest('hex');
    return `${encoded}.${signature}`;
  }

  private parseVkState(raw: string): VkStatePayload | null {
    const value = String(raw || '').trim();
    if (!value || !value.includes('.')) return null;

    const [encoded, signature] = value.split('.', 2);
    if (!encoded || !signature) return null;

    const expected = crypto
      .createHmac('sha256', this.getVkStateSecret())
      .update(encoded)
      .digest('hex');

    if (expected !== signature) return null;

    try {
      const parsed = JSON.parse(this.decodeBase64Url(encoded)) as VkStatePayload;
      if (!parsed?.redirectUri) return null;
      if (parsed.mode !== 'login' && parsed.mode !== 'link') return null;

      const issuedAt = Number(parsed.iat || 0);
      if (!issuedAt) return null;
      const ageMs = Date.now() - issuedAt;
      if (ageMs < 0 || ageMs > 15 * 60 * 1000) return null;

      return parsed;
    } catch {
      return null;
    }
  }

  private normalizeVkPhone(raw?: string | null) {
    if (!raw) return null;
    const normalized = this.normalizePhone(String(raw));
    if (!normalized || normalized.length < 11) return null;
    return normalized;
  }

  async createVkAuthUrl(mode: VkAuthMode, redirectUri: string) {
    const appId = this.getVkAppId();
    if (!appId) {
      throw new BadRequestException('VK OAuth не настроен: SHOP_VK_APP_ID');
    }

    const cleanRedirectUri = String(redirectUri || '').trim();
    if (!cleanRedirectUri) {
      throw new BadRequestException('redirectUri обязателен');
    }

    const state = this.createVkState({
      mode,
      redirectUri: cleanRedirectUri,
      iat: Date.now(),
      nonce: crypto.randomBytes(12).toString('hex'),
    });

    const params = new URLSearchParams();
    params.set('client_id', appId);
    params.set('redirect_uri', cleanRedirectUri);
    params.set('response_type', this.getVkOAuthResponseType());
    params.set('v', this.getVkApiVersion());
    params.set('state', state);
    const scope = this.getVkOAuthScope();
    if (scope) {
      params.set('scope', scope);
    }

    return {
      success: true,
      authUrl: `https://oauth.vk.com/authorize?${params.toString()}`,
    };
  }

  private async fetchVkIdentity(code: string, redirectUri: string): Promise<VkIdentity> {
    const appId = this.getVkAppId();
    const appSecret = this.getVkAppSecret();
    if (!appId || !appSecret) {
      throw new BadRequestException('VK OAuth не настроен: SHOP_VK_APP_ID / SHOP_VK_APP_SECRET');
    }

    const tokenUrl = new URL('https://oauth.vk.com/access_token');
    tokenUrl.searchParams.set('client_id', appId);
    tokenUrl.searchParams.set('client_secret', appSecret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenRes = await fetch(tokenUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const tokenData = await tokenRes.json().catch(() => null);
    if (!tokenRes.ok || !tokenData || tokenData.error) {
      throw new BadRequestException('VK вернул ошибку авторизации');
    }

    const accessToken = String(tokenData.access_token || '').trim();
    const vkId = String(tokenData.user_id || '').trim();
    if (!accessToken || !vkId) {
      throw new BadRequestException('Не удалось получить данные VK');
    }

    let firstName: string | null = null;
    let lastName: string | null = null;
    let phone: string | null = null;

    const userUrl = new URL('https://api.vk.com/method/users.get');
    userUrl.searchParams.set('user_ids', vkId);
    userUrl.searchParams.set('fields', 'contacts');
    userUrl.searchParams.set('access_token', accessToken);
    userUrl.searchParams.set('v', this.getVkApiVersion());

    const userRes = await fetch(userUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }).catch(() => null);

    if (userRes?.ok) {
      const userData = await userRes.json().catch(() => null);
      const first = userData?.response?.[0]?.first_name;
      const last = userData?.response?.[0]?.last_name;
      const mobile = userData?.response?.[0]?.mobile_phone;
      firstName = first ? String(first) : null;
      lastName = last ? String(last) : null;
      phone = this.normalizeVkPhone(mobile);
    }

    return {
      vkId,
      firstName,
      lastName,
      phone,
      email: tokenData?.email ? String(tokenData.email) : null,
    };
  }

  private async fetchVkIdentityByAccessToken(accessToken: string): Promise<VkIdentity> {
    const token = String(accessToken || '').trim();
    if (!token) {
      throw new BadRequestException('accessToken обязателен');
    }

    const appId = this.getVkAppId();
    if (appId) {
      const infoUrl = new URL('https://id.vk.ru/oauth2/user_info');
      infoUrl.searchParams.set('client_id', appId);

      const infoRes = await fetch(infoUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({ access_token: token }).toString(),
      }).catch(() => null);

      const infoData = await infoRes?.json().catch(() => null);
      const profile = infoData?.user;
      const vkId = String(profile?.user_id || profile?.id || '').trim();

      if (infoRes?.ok && !infoData?.error && vkId) {
        return {
          vkId,
          firstName: profile?.first_name ? String(profile.first_name) : null,
          lastName: profile?.last_name ? String(profile.last_name) : null,
          phone: this.normalizeVkPhone(profile?.phone ? String(profile.phone) : null),
          email: profile?.email ? String(profile.email) : null,
        };
      }
    }

    // Fallback for classic OAuth tokens.
    const userUrl = new URL('https://api.vk.com/method/users.get');
    userUrl.searchParams.set('fields', 'contacts');
    userUrl.searchParams.set('access_token', token);
    userUrl.searchParams.set('v', this.getVkApiVersion());

    const userRes = await fetch(userUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const userData = await userRes.json().catch(() => null);
    if (!userRes.ok || !userData || userData?.error) {
      throw new BadRequestException('VK вернул ошибку авторизации');
    }

    const profile = userData?.response?.[0];
    const vkId = String(profile?.id || '').trim();
    if (!vkId) {
      throw new BadRequestException('Не удалось получить данные VK');
    }

    return {
      vkId,
      firstName: profile?.first_name ? String(profile.first_name) : null,
      lastName: profile?.last_name ? String(profile.last_name) : null,
      phone: this.normalizeVkPhone(profile?.mobile_phone ? String(profile.mobile_phone) : null),
      email: null,
    };
  }

  private async syncCustomerToCrm(customerId: number) {
    const customer = await this.prisma.shopCustomer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        telegramId: true,
        telegramUsername: true,
        vkId: true,
        maxId: true,
        marketingConsent: true,
      },
    });
    if (!customer?.phone) return;

    await this.crmSync.upsertClientByPhone({
      phone: customer.phone,
      name: this.crmSync.formatDisplayName(customer.firstName, customer.lastName, customer.phone),
      telegramUsername: customer.telegramUsername || null,
      telegramId: customer.telegramId || null,
      vkId: customer.vkId || null,
      maxId: customer.maxId || null,
      marketingConsent: customer.marketingConsent,
    });
  }

  private async linkVkToCustomer(customerId: number, identity: VkIdentity) {
    const existingVkOwner = await this.prisma.shopCustomer.findFirst({
      where: {
        vkId: identity.vkId,
        id: { not: customerId },
      },
      select: { id: true },
    });
    if (existingVkOwner) {
      throw new ConflictException(
        'Этот аккаунт уже привязан. Перейдите в нужный профиль и отвяжите соцсеть, затем повторите.',
      );
    }

    const current = await this.prisma.shopCustomer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        phone: true,
        firstName: true,
        lastName: true,
        vkId: true,
      },
    });
    if (!current) {
      throw new UnauthorizedException('Сессия недействительна');
    }

    if (current.vkId === identity.vkId) {
      return {
        customer: await this.prisma.shopCustomer.findUnique({ where: { id: customerId } }),
        alreadyLinked: true,
      };
    }

    let phoneToSet: string | undefined;
    if (!current.phone && identity.phone) {
      const byPhone = await this.prisma.shopCustomer.findUnique({
        where: { phone: identity.phone },
        select: { id: true },
      });
      if (byPhone && byPhone.id !== customerId) {
        throw new ConflictException(
          'Этот аккаунт уже привязан. Перейдите в нужный профиль и отвяжите соцсеть, затем повторите.',
        );
      }
      phoneToSet = identity.phone;
    }

    const updated = await this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: {
        vkId: identity.vkId,
        phone: phoneToSet,
        firstName: current.firstName || identity.firstName || undefined,
        lastName: current.lastName || identity.lastName || undefined,
        lastLoginAt: new Date(),
      },
    });

    await this.syncCustomerToCrm(customerId).catch(() => undefined);

    return { customer: updated, alreadyLinked: false };
  }

  private async resolveCustomerByVkOrPhone(identity: VkIdentity) {
    const byVk = await this.prisma.shopCustomer.findFirst({
      where: { vkId: identity.vkId },
      orderBy: { id: 'asc' },
    });
    if (byVk) return byVk;

    if (!identity.phone) return null;

    const byPhone = await this.prisma.shopCustomer.findUnique({
      where: { phone: identity.phone },
      select: { id: true },
    });
    if (!byPhone) return null;

    const linked = await this.linkVkToCustomer(byPhone.id, identity);
    return linked.customer || null;
  }

  async loginWithTelegram(payload: Record<string, string | number | null | undefined>) {
    const valid = this.verifyTelegramPayload(payload);
    if (!valid) return null;

    const telegramId = String(payload.id || '');
    if (!telegramId) return null;

    const telegramUsername = payload.username ? String(payload.username) : null;
    const firstNameFromTg = payload.first_name ? String(payload.first_name) : null;
    const lastNameFromTg = payload.last_name ? String(payload.last_name) : null;

    const rawPhone = payload.phone_number || payload.phone;
    const normalizedPhone = rawPhone ? this.normalizePhone(String(rawPhone)) : null;
    const hasPhone = Boolean(normalizedPhone && normalizedPhone.length >= 11);

    const byTelegram = await this.prisma.shopCustomer.findUnique({
      where: { telegramId },
      select: { id: true, vkId: true, maxId: true, marketingConsent: true },
    });
    const byPhone = hasPhone
      ? await this.prisma.shopCustomer.findUnique({
          where: { phone: normalizedPhone! },
          select: { id: true, vkId: true, maxId: true, marketingConsent: true },
        })
      : null;

    if (byTelegram && byPhone && byTelegram.id !== byPhone.id) {
      throw new ConflictException(
        'Этот аккаунт уже привязан. Перейдите в нужный профиль и отвяжите соцсеть, затем повторите.',
      );
    }

    const targetCustomerId = byPhone?.id || byTelegram?.id || null;

    const profileFullName =
      [firstNameFromTg, lastNameFromTg].filter(Boolean).join(' ').trim() || null;
    const syncedClient = hasPhone
      ? await this.crmSync.upsertClientByPhone({
          phone: normalizedPhone!,
          name: profileFullName,
          telegramUsername,
          telegramId,
          vkId: byPhone?.vkId || byTelegram?.vkId || null,
          maxId: byPhone?.maxId || byTelegram?.maxId || null,
          marketingConsent:
            byPhone?.marketingConsent !== undefined
              ? Boolean(byPhone.marketingConsent)
              : byTelegram?.marketingConsent !== undefined
                ? Boolean(byTelegram.marketingConsent)
                : undefined,
        })
      : null;

    const clientName = this.crmSync.parsePersonName(syncedClient?.name);
    const firstName = firstNameFromTg || clientName.firstName;
    const lastName = lastNameFromTg || clientName.lastName;

    if (targetCustomerId) {
      return this.prisma.shopCustomer.update({
        where: { id: targetCustomerId },
        data: {
          phone: hasPhone ? normalizedPhone : undefined,
          telegramId,
          telegramUsername,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          lastLoginAt: new Date(),
        },
      });
    }

    return this.prisma.shopCustomer.create({
      data: {
        phone: hasPhone ? normalizedPhone : null,
        telegramId,
        telegramUsername,
        firstName,
        lastName,
        notifyMarketing: true,
        marketingConsent: true,
        lastLoginAt: new Date(),
      },
    });
  }

  private async finalizeVkIdentityAuth(
    stateRaw: string,
    identity: VkIdentity,
    currentCustomerId?: number | null,
  ): Promise<ShopVkAuthCompleteResult> {
    const state = this.parseVkState(stateRaw);
    if (!state) {
      throw new BadRequestException('Ссылка авторизации VK устарела. Повторите вход.');
    }

    const customerId = currentCustomerId || null;
    if (state.mode === 'link' && !customerId) {
      throw new UnauthorizedException('Для привязки VK сначала войдите в личный кабинет.');
    }

    if (customerId) {
      const linked = await this.linkVkToCustomer(customerId, identity);
      return {
        success: true,
        status: linked.alreadyLinked ? 'ALREADY_LINKED' : 'LINKED',
        message: linked.alreadyLinked
          ? 'VK уже привязан к этому аккаунту.'
          : 'VK успешно привязан.',
        customer: linked.customer,
        shouldCreateSession: false,
      };
    }

    const customer = await this.resolveCustomerByVkOrPhone(identity);
    if (!customer) {
      return {
        success: false,
        status: 'LINK_REQUIRED',
        message:
          'Аккаунт VK пока не связан с профилем магазина. Войдите на сайт и привяжите VK в личном кабинете.',
      };
    }

    const loggedIn = await this.prisma.shopCustomer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      success: true,
      status: 'LOGGED_IN',
      message: 'Вход через VK выполнен.',
      customer: loggedIn,
      shouldCreateSession: true,
    };
  }

  async completeVkAuth(input: {
    code: string;
    state: string;
    currentCustomerId?: number | null;
  }): Promise<ShopVkAuthCompleteResult> {
    const code = String(input.code || '').trim();
    const stateRaw = String(input.state || '').trim();
    if (!code || !stateRaw) {
      throw new BadRequestException('Параметры code/state обязательны');
    }

    const state = this.parseVkState(stateRaw);
    if (!state) {
      throw new BadRequestException('Ссылка авторизации VK устарела. Повторите вход.');
    }

    const identity = await this.fetchVkIdentity(code, state.redirectUri);
    return this.finalizeVkIdentityAuth(stateRaw, identity, input.currentCustomerId || null);
  }

  async completeVkAuthByAccessToken(input: {
    accessToken: string;
    state: string;
    currentCustomerId?: number | null;
  }): Promise<ShopVkAuthCompleteResult> {
    const accessToken = String(input.accessToken || '').trim();
    const stateRaw = String(input.state || '').trim();
    if (!accessToken || !stateRaw) {
      throw new BadRequestException('Параметры accessToken/state обязательны');
    }

    const identity = await this.fetchVkIdentityByAccessToken(accessToken);
    return this.finalizeVkIdentityAuth(stateRaw, identity, input.currentCustomerId || null);
  }

  async verifyPhoneCode(phone: string, code: string) {
    const normalized = this.validateMobilePhone(phone);
    const codeHash = this.hashCode(code);

    const record = await this.prisma.shopAuthCode.findFirst({
      where: {
        phone: { in: this.getPhoneAliases(normalized) },
        codeHash,
        expiresAt: { gt: new Date() },
        usedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    await this.prisma.shopAuthCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const customer =
      (await this.prisma.shopCustomer.findFirst({
        where: { phone: { in: this.getPhoneAliases(normalized) } },
      })) || null;

    const nextCustomer = customer
      ? await this.prisma.shopCustomer.update({
          where: { id: customer.id },
          data: {
            phone: this.toStoredCustomerPhone(normalized),
            lastLoginAt: new Date(),
          },
        })
      : await this.prisma.shopCustomer.create({
          data: {
            phone: this.toStoredCustomerPhone(normalized),
            notifyMarketing: true,
            marketingConsent: true,
            lastLoginAt: new Date(),
          },
        });

    await this.crmSync.upsertClientByPhone({
      phone: normalized,
      name: this.crmSync.formatDisplayName(
        nextCustomer.firstName,
        nextCustomer.lastName,
        normalized,
      ),
      telegramUsername: nextCustomer.telegramUsername || null,
      telegramId: nextCustomer.telegramId || null,
      vkId: nextCustomer.vkId || null,
      maxId: nextCustomer.maxId || null,
      marketingConsent: nextCustomer.marketingConsent,
    });

    return nextCustomer;
  }

  async getPhoneAuthStatus(phone: string) {
    const normalized = this.validateMobilePhone(phone);

    const record = await this.prisma.shopAuthCode.findFirst({
      where: {
        phone: { in: this.getPhoneAliases(normalized) },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      include: { customer: true },
    });

    if (!record) {
      return {
        success: false,
        verified: false,
        state: 'not_found',
      };
    }

    if (record.usedAt && record.customerId) {
      const customer =
        record.customer ||
        (await this.prisma.shopCustomer.findUnique({ where: { id: record.customerId } }));
      if (!customer) {
        return {
          success: false,
          verified: false,
          state: 'customer_missing',
        };
      }

      return {
        success: true,
        verified: true,
        state: 'verified',
        customer,
      };
    }

    return {
      success: true,
      verified: false,
      state: 'pending',
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  async confirmWaitcall(body: {
    waitcall?: string | number | null;
    phone?: string | null;
    ts?: string | number | null;
    md5?: string | null;
  }) {
    const waitcall = String(body.waitcall || '').trim();
    if (waitcall !== '1') {
      throw new BadRequestException('Unsupported callback payload');
    }

    const normalizedPhone = this.normalizePhone(String(body.phone || ''));
    const ts = String(body.ts || '').trim();
    if (normalizedPhone.length !== 11 || !ts) {
      throw new BadRequestException('Invalid callback payload');
    }

    if (!this.verifyWaitcallSignature({ phone: normalizedPhone, ts, md5: body.md5 })) {
      throw new UnauthorizedException('Invalid phone auth callback signature');
    }

    const pending = await this.prisma.shopAuthCode.findFirst({
      where: {
        phone: { in: this.getPhoneAliases(normalizedPhone) },
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pending) {
      return { success: true, matched: false };
    }

    const existingCustomer =
      (await this.prisma.shopCustomer.findFirst({
        where: { phone: { in: this.getPhoneAliases(normalizedPhone) } },
      })) || null;

    const customer = existingCustomer
      ? await this.prisma.shopCustomer.update({
          where: { id: existingCustomer.id },
          data: {
            phone: this.toStoredCustomerPhone(normalizedPhone),
            lastLoginAt: new Date(),
          },
        })
      : await this.prisma.shopCustomer.create({
          data: {
            phone: this.toStoredCustomerPhone(normalizedPhone),
            notifyMarketing: true,
            marketingConsent: true,
            lastLoginAt: new Date(),
          },
        });

    await this.prisma.shopAuthCode.update({
      where: { id: pending.id },
      data: {
        usedAt: new Date(Number(ts) * 1000 || Date.now()),
        customerId: customer.id,
      },
    });

    await this.crmSync.upsertClientByPhone({
      phone: normalizedPhone,
      name: this.crmSync.formatDisplayName(customer.firstName, customer.lastName, normalizedPhone),
      telegramUsername: customer.telegramUsername || null,
      telegramId: customer.telegramId || null,
      vkId: customer.vkId || null,
      maxId: customer.maxId || null,
      marketingConsent: customer.marketingConsent,
    });

    return { success: true, matched: true };
  }
}
