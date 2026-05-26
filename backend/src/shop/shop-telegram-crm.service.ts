import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { OrderSource } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma.service';
import { Cron } from '@nestjs/schedule';
import crypto from 'crypto';
import os from 'os';
import { ShopCrmSyncService } from './shop-crm-sync.service';
import { resolveShopPublicUrl, resolveTelegramShopPublicUrl } from './shop-public-url.util';

type TelegramUser = {
  id: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramChat = {
  id: number | string;
};

type TelegramMessage = {
  text?: string;
  from?: TelegramUser;
  chat?: TelegramChat;
  contact?: {
    phone_number?: string;
    user_id?: number | string;
  };
};

type TelegramCallbackQuery = {
  id?: string;
  from?: TelegramUser;
  message?: TelegramMessage;
  data?: string;
};

type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

type TelegramRequestOptions = {
  timeoutMs?: number;
  retryAttempts?: number;
};

type TelegramSendMode = 'interactive' | 'background';

@Injectable()
export class ShopTelegramCrmService {
  private readonly logger = new Logger(ShopTelegramCrmService.name);
  private pollingOffset = 0;
  private pollingInitialized = false;
  private pollingBusy = false;
  private pollingDisabledUntilTs = 0;
  private readonly processedUpdatesCache = new Map<number, number>();
  private readonly consentCache = new Map<string, CachedValue<boolean>>();
  private readonly shopCustomerByTelegramCache = new Map<
    string,
    CachedValue<{ id: number; phone: string | null } | null>
  >();
  private readonly telegramAuthTtlMinutes = 5;
  private readonly policyVersion = process.env.SHOP_TELEGRAM_POLICY_VERSION || '2026-02';
  private readonly telegramRequestTimeoutMs = Math.max(
    3000,
    Number(process.env.SHOP_TELEGRAM_REQUEST_TIMEOUT_MS || 9000),
  );
  private readonly telegramInteractiveTimeoutMs = Math.max(
    2500,
    Number(process.env.SHOP_TELEGRAM_INTERACTIVE_TIMEOUT_MS || 4500),
  );
  private readonly telegramInteractiveRetryAttempts = Math.min(
    2,
    Math.max(1, Number(process.env.SHOP_TELEGRAM_INTERACTIVE_RETRY_ATTEMPTS || 1)),
  );
  private readonly telegramBackgroundTimeoutMs = Math.max(
    3000,
    Number(process.env.SHOP_TELEGRAM_BACKGROUND_TIMEOUT_MS || this.telegramRequestTimeoutMs),
  );
  private readonly telegramBackgroundRetryAttempts = Math.min(
    5,
    Math.max(1, Number(process.env.SHOP_TELEGRAM_BACKGROUND_RETRY_ATTEMPTS || 2)),
  );
  private readonly telegramRetryAttempts = Math.min(
    5,
    Math.max(1, Number(process.env.SHOP_TELEGRAM_API_RETRY_ATTEMPTS || 2)),
  );
  private readonly telegramRetryBaseDelayMs = Math.max(
    200,
    Number(process.env.SHOP_TELEGRAM_RETRY_BASE_DELAY_MS || 800),
  );
  private readonly consentCacheTtlMs = Math.max(
    15000,
    Number(process.env.SHOP_TELEGRAM_CONSENT_CACHE_TTL_MS || 120000),
  );
  private readonly shopCustomerCacheTtlMs = Math.max(
    15000,
    Number(process.env.SHOP_TELEGRAM_CUSTOMER_CACHE_TTL_MS || 120000),
  );
  private readonly updateDedupTtlMs = Math.max(
    60000,
    Number(process.env.SHOP_TELEGRAM_UPDATE_DEDUP_TTL_MS || 600000),
  );
  private readonly broadcastConcurrency = Math.min(
    6,
    Math.max(1, Number(process.env.SHOP_TELEGRAM_BROADCAST_CONCURRENCY || 3)),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmSync: ShopCrmSyncService,
  ) {}

  validateWebhookSecret(secretHeader?: string) {
    const expectedSecret = process.env.SHOP_TELEGRAM_WEBHOOK_SECRET;
    if (expectedSecret && secretHeader !== expectedSecret) {
      throw new UnauthorizedException('Invalid telegram webhook secret');
    }
  }

  async handleWebhook(update: TelegramUpdate, secretHeader?: string) {
    this.validateWebhookSecret(secretHeader);
    await this.processUpdate(update);
  }

  async processWebhookAsync(update: TelegramUpdate) {
    await this.processUpdate(update);
  }

  private hasWebhookConfig() {
    return Boolean(
      String(process.env.SHOP_TELEGRAM_WEBHOOK_URL || '').trim() ||
      String(process.env.SHOP_TELEGRAM_WEBHOOK_SECRET || '').trim(),
    );
  }

  private isPollingEnabled() {
    return process.env.SHOP_TELEGRAM_POLLING === 'true' && !this.hasWebhookConfig();
  }

  @Cron('*/5 * * * * *')
  async pollTelegramUpdates() {
    if (!this.isPollingEnabled()) return;
    if (Date.now() < this.pollingDisabledUntilTs) return;
    const token = this.getBotToken();
    if (!token) return;
    if (this.pollingBusy) return;

    this.pollingBusy = true;
    try {
      const body: Record<string, unknown> = {
        timeout: 20,
        limit: 20,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
      };

      if (this.pollingInitialized) {
        body.offset = this.pollingOffset;
      } else {
        // Skip historical backlog on first poll after startup.
        body.offset = -1;
      }

      const res = await this.sendTelegramRequest('getUpdates', body, {
        timeoutMs: 26000,
        retryAttempts: 1,
      });
      if (!res) {
        return;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        this.logger.warn(`Telegram getUpdates failed (${res.status}): ${txt.slice(0, 300)}`);
        if (res.status === 409) {
          this.pollingDisabledUntilTs = Date.now() + 10 * 60 * 1000;
          this.logger.warn(
            'Polling paused for 10 minutes because Telegram webhook seems active (HTTP 409).',
          );
        }
        return;
      }

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        result?: Array<{ update_id: number } & TelegramUpdate>;
      } | null;

      if (!data?.ok || !Array.isArray(data.result)) return;

      this.pollingInitialized = true;

      for (const update of data.result) {
        const updateId = Number(update.update_id || 0);
        if (updateId >= this.pollingOffset) {
          this.pollingOffset = updateId + 1;
        }
        await this.processUpdate(update).catch(error => {
          this.logger.warn(`Telegram update handling failed: ${String(error)}`);
        });
      }
    } catch (error) {
      this.logger.warn(`Telegram polling failed: ${String(error)}`);
    } finally {
      this.pollingBusy = false;
    }
  }

  private async processUpdate(update: TelegramUpdate) {
    const startedAt = Date.now();
    const updateId = Number(update?.update_id || 0);
    if (Number.isFinite(updateId) && updateId > 0) {
      const cachedUntil = this.processedUpdatesCache.get(updateId);
      if (cachedUntil && cachedUntil > startedAt) {
        return;
      }
      this.processedUpdatesCache.set(updateId, startedAt + this.updateDedupTtlMs);
      this.clearExpiredUpdateDedupEntries(startedAt);
    }

    try {
      const callbackQuery = update?.callback_query;
      if (callbackQuery?.id) {
        await this.handleCallbackQuery(callbackQuery);
        return;
      }

      const message = update?.message || update?.edited_message;
      if (!message?.from?.id || !message.chat?.id) {
        return;
      }

      await this.handleMessage(message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Telegram update processing failed: ${reason}`);
    } finally {
      const durationMs = Date.now() - startedAt;
      if (durationMs >= 2500) {
        this.logger.warn(`Slow Telegram update processing: ${durationMs}ms`);
      }
    }
  }

  async notifyNewOrder(orderId: number) {
    if (!this.getBotToken()) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order || order.source !== OrderSource.STORE) return;

    const lines = order.items.map(item => {
      const label = item.variantLabel ? ` (${item.variantLabel})` : '';
      return `• ${item.product?.name || `Товар #${item.productId}`}${label} × ${item.qty}`;
    });

    const text = [
      'Новый заказ с витрины',
      `#${order.id}`,
      `Клиент: ${order.client?.name || '—'}`,
      `Телефон: ${order.client?.phone || '—'}`,
      `Сумма: ${new Decimal(order.totalPrice || 0).toFixed(2)} ₽`,
      '',
      'Состав:',
      ...(lines.length ? lines : ['• Нет позиций']),
    ].join('\n');

    await this.broadcastOrder(text, order.id);
  }

  async notifyNewLead(orderId: number) {
    if (!this.getBotToken()) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!order) return;

    const firstItem = order.items[0];
    const productName = firstItem?.product?.name || 'Товар не указан';

    const text = [
      'Новая заявка с витрины',
      `Order #${order.id}`,
      `Клиент: ${order.client?.name || '—'}`,
      `Телефон: ${order.client?.phone || '—'}`,
      '',
      `Товар: ${productName}`,
      order.comment || '',
    ]
      .filter(Boolean)
      .join('\n');

    await this.broadcast(text);
  }

  private getBotToken() {
    const token = process.env.SHOP_BOT_TOKEN;
    if (!token) {
      return null;
    }
    return token;
  }

  private async sendTelegramRequest(
    method: 'sendMessage' | 'answerCallbackQuery' | 'getUpdates',
    body: Record<string, unknown>,
    options?: TelegramRequestOptions,
  ) {
    const token = this.getBotToken();
    if (!token) return null;
    const timeoutMs = Math.max(1000, Number(options?.timeoutMs || this.telegramRequestTimeoutMs));
    const totalAttempts = Math.max(
      1,
      Math.min(6, Number(options?.retryAttempts || this.telegramRetryAttempts)),
    );

    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (
          response.ok ||
          attempt >= totalAttempts ||
          !this.isRetryableTelegramStatus(response.status)
        ) {
          return response;
        }

        const retryAfterSec = await this.extractRetryAfterSeconds(response);
        const delayMs = retryAfterSec
          ? Math.max(500, retryAfterSec * 1000)
          : this.telegramRetryBaseDelayMs * attempt;
        this.logger.warn(
          `Telegram API transient error (${method}, status=${response.status}). Retry in ${delayMs}ms (attempt ${attempt}/${totalAttempts}).`,
        );
        await this.sleep(delayMs);
      } catch (error) {
        const message = String(error || '');
        const isAbort = message.includes('AbortError');
        if (attempt >= totalAttempts) {
          if (!isAbort) {
            this.logger.warn(`Telegram request failed (${method}): ${message}`);
          }
          return null;
        }

        const delayMs = this.telegramRetryBaseDelayMs * attempt;
        this.logger.warn(
          `Telegram request ${isAbort ? 'timeout' : 'error'} (${method}). Retry in ${delayMs}ms (attempt ${attempt}/${totalAttempts}).`,
        );
        await this.sleep(delayMs);
      } finally {
        clearTimeout(timeoutId);
      }
    }

    return null;
  }

  private isRetryableTelegramStatus(status: number) {
    return status === 429 || status >= 500;
  }

  private async extractRetryAfterSeconds(response: Response) {
    try {
      const data = (await response.clone().json()) as {
        parameters?: { retry_after?: number };
      } | null;
      const retryAfter = Number(data?.parameters?.retry_after || 0);
      return Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 0;
    } catch {
      return 0;
    }
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private readCache<T>(cache: Map<string, CachedValue<T>>, key: string) {
    const item = cache.get(key);
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
      cache.delete(key);
      return null;
    }
    return item.value;
  }

  private writeCache<T>(cache: Map<string, CachedValue<T>>, key: string, value: T, ttlMs: number) {
    cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private clearExpiredUpdateDedupEntries(now = Date.now()) {
    if (this.processedUpdatesCache.size <= 2000) return;
    for (const [updateId, expiresAt] of this.processedUpdatesCache.entries()) {
      if (expiresAt <= now) {
        this.processedUpdatesCache.delete(updateId);
      }
    }
  }

  private normalizeCommand(raw: string) {
    const [first] = raw.split('@');
    return first.toLowerCase();
  }

  private normalizePhone(input: string) {
    return this.crmSync.normalizePhone(input);
  }

  private buildPhoneAliases(input?: string | null) {
    const normalized = this.normalizePhone(String(input || ''));
    if (!normalized || normalized.length < 10) return [] as string[];
    const last10 = normalized.slice(-10);
    const aliases = new Set<string>([normalized, `+${normalized}`]);
    if (last10.length === 10) {
      aliases.add(last10);
      aliases.add(`7${last10}`);
      aliases.add(`+7${last10}`);
      aliases.add(`8${last10}`);
      aliases.add(`+8${last10}`);
    }
    return Array.from(aliases).filter(Boolean);
  }

  private generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private hashCode(code: string) {
    const secret = String(process.env.SHOP_OTP_SECRET || process.env.JWT_SECRET || '').trim();
    if (!secret) {
      throw new UnauthorizedException('OTP secret is not configured');
    }
    return crypto
      .createHash('sha256')
      .update(code + secret)
      .digest('hex');
  }

  private getTelegramSafeShopPublicUrl() {
    const raw = resolveTelegramShopPublicUrl();
    try {
      const parsed = new URL(raw);
      const host = parsed.hostname.toLowerCase();

      // In local development, Telegram links must open from the phone inside the LAN.
      // If host points to localhost/tunnel/nip, replace it with current machine private IP.
      if (
        process.env.NODE_ENV !== 'production' &&
        (host === 'localhost' ||
          host === '127.0.0.1' ||
          host === '::1' ||
          host.endsWith('.nip.io') ||
          host.endsWith('.lhr.life'))
      ) {
        const lanIp = this.detectLocalLanIp();
        if (lanIp) {
          parsed.protocol = 'http:';
          parsed.hostname = lanIp;
          parsed.port = parsed.port || '3000';
        }
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return resolveShopPublicUrl(raw);
    }
  }

  private detectLocalLanIp() {
    const interfaces = os.networkInterfaces();
    const candidates: string[] = [];

    for (const records of Object.values(interfaces)) {
      for (const record of records || []) {
        if (!record || record.family !== 'IPv4' || record.internal) continue;
        const ip = String(record.address || '').trim();
        if (!ip) continue;

        const isPrivate =
          ip.startsWith('10.') ||
          ip.startsWith('192.168.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip);
        if (isPrivate) {
          candidates.push(ip);
        }
      }
    }

    return candidates[0] || null;
  }

  private async createShopTelegramLoginLink(phone: string) {
    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + this.telegramAuthTtlMinutes * 60 * 1000);

    await this.prisma.shopAuthCode.create({
      data: {
        phone,
        codeHash,
        expiresAt,
      },
    });

    const baseUrl = this.getTelegramSafeShopPublicUrl();
    return `${baseUrl}/account?tg_phone=${encodeURIComponent(phone)}&tg_code=${encodeURIComponent(code)}`;
  }

  private contactRequestKeyboard() {
    return {
      keyboard: [[{ text: 'Поделиться номером телефона', request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  }

  private websiteButton(url: string, title = 'Перейти в личный кабинет') {
    return {
      inline_keyboard: [[{ text: title, url }]],
    };
  }

  private async sendCustomerLoginLink(
    message: TelegramMessage,
    phone: string,
    mode: 'quick' | 'verified' = 'verified',
  ) {
    const normalized = this.normalizePhone(phone);
    if (!normalized || normalized.length < 11) {
      return false;
    }

    const loginLink = await this.createShopTelegramLoginLink(normalized);
    const prefix =
      mode === 'quick' ? 'Аккаунт уже привязан к вашему Telegram.' : 'Авторизация подтверждена.';
    return this.sendReply(
      message,
      [
        prefix,
        'Нажмите кнопку ниже и вернитесь на сайт.',
        `Ссылка действительна ${this.telegramAuthTtlMinutes} минут.`,
        '',
        'Если кнопка не открылась, используйте ссылку:',
        loginLink,
      ].join('\n'),
      this.websiteButton(loginLink),
    );
  }

  private async tryQuickCustomerLogin(message: TelegramMessage) {
    const telegramId = String(message.from?.id || '');
    if (!telegramId) return false;

    const customer = await this.prisma.shopCustomer.findUnique({
      where: { telegramId },
      select: { id: true, phone: true },
    });
    if (!customer?.phone) return false;

    return this.sendCustomerLoginLink(message, customer.phone, 'quick');
  }

  private consentKeyboard() {
    return {
      inline_keyboard: [
        [
          {
            text: 'Политика данных',
            url: `${this.getTelegramSafeShopPublicUrl()}/legal/privacy`,
          },
          {
            text: 'Cookies',
            url: `${this.getTelegramSafeShopPublicUrl()}/legal/cookies`,
          },
        ],
        [
          { text: 'Согласен', callback_data: 'shop_consent_accept' },
          { text: 'Не согласен', callback_data: 'shop_consent_decline' },
        ],
      ],
    };
  }

  private async hasCustomerConsent(telegramUserId: string) {
    if (!telegramUserId) return false;

    const cached = this.readCache(this.consentCache, telegramUserId);
    if (cached !== null) return cached;

    const consent = await this.prisma.shopTelegramConsent.findUnique({
      where: { telegramUserId },
      select: {
        policyVersion: true,
        consentedAt: true,
        revokedAt: true,
      },
    });

    const hasConsent = Boolean(
      consent?.consentedAt &&
      consent.policyVersion === this.policyVersion &&
      (!consent.revokedAt || consent.revokedAt < consent.consentedAt),
    );

    this.writeCache(this.consentCache, telegramUserId, hasConsent, this.consentCacheTtlMs);
    return hasConsent;
  }

  private async saveCustomerConsent(
    telegramUserId: string,
    telegramChatId: string,
    telegramUsername: string | null,
    accepted: boolean,
  ) {
    await this.prisma.shopTelegramConsent.upsert({
      where: { telegramUserId },
      create: {
        telegramUserId,
        telegramChatId: telegramChatId || null,
        telegramUsername,
        policyVersion: this.policyVersion,
        consentedAt: accepted ? new Date() : null,
        revokedAt: accepted ? null : new Date(),
      },
      update: {
        telegramChatId: telegramChatId || null,
        telegramUsername,
        policyVersion: this.policyVersion,
        consentedAt: accepted ? new Date() : null,
        revokedAt: accepted ? null : new Date(),
      },
    });
    this.writeCache(this.consentCache, telegramUserId, accepted, this.consentCacheTtlMs);
  }

  private async requestCustomerConsent(message: TelegramMessage) {
    await this.sendReply(
      message,
      [
        'Для входа в личный кабинет TechnoPrime нужно согласие на обработку данных.',
        'Мы используем номер телефона и Telegram ID только для авторизации, заказов и сервисных уведомлений.',
        '',
        `Нажимая «Согласен», вы подтверждаете согласие с политикой данных (версия ${this.policyVersion}).`,
      ].join('\n'),
      this.consentKeyboard(),
    );
  }

  private async ensureCustomerConsent(message: TelegramMessage) {
    const telegramUserId = String(message.from?.id || '');
    if (!telegramUserId) return false;

    const hasConsent = await this.hasCustomerConsent(telegramUserId);
    if (hasConsent) return true;

    await this.requestCustomerConsent(message);
    return false;
  }

  private async handleCallbackQuery(query: TelegramCallbackQuery) {
    const queryId = String(query.id || '');
    const data = String(query.data || '');
    const fromUserId = String(query.from?.id || '');
    const message = query.message;
    const chatId = String(message?.chat?.id || '');
    const username = query.from?.username || null;

    if (!queryId || !fromUserId || !data) return;

    if (data !== 'shop_consent_accept' && data !== 'shop_consent_decline') {
      await this.answerCallbackQuery(queryId, 'Команда не поддерживается');
      return;
    }

    const accepted = data === 'shop_consent_accept';
    await this.saveCustomerConsent(fromUserId, chatId, username, accepted);

    if (!accepted) {
      await this.answerCallbackQuery(queryId, 'Без согласия вход недоступен');
      if (message) {
        await this.sendReply(
          message,
          'Без согласия мы не можем принять номер телефона. Вы можете вернуться позже и нажать «Согласен».',
          { remove_keyboard: true },
        );
      }
      return;
    }

    await this.answerCallbackQuery(queryId, 'Согласие сохранено');
    if (message) {
      await this.sendReply(
        message,
        [
          'Спасибо. Согласие сохранено.',
          'Для входа в личный кабинет отправьте контакт с номером телефона.',
        ].join('\n'),
        this.contactRequestKeyboard(),
      );
    }
  }

  private async handleMessage(message: TelegramMessage) {
    if (message.contact?.phone_number) {
      const contactUserId = String(message.contact.user_id || '');
      const senderUserId = String(message.from?.id || '');
      if (contactUserId && senderUserId && contactUserId !== senderUserId) {
        await this.sendReply(
          message,
          'Для входа нужно отправить контакт именно вашего Telegram-аккаунта через кнопку «Поделиться номером телефона».',
          this.contactRequestKeyboard(),
        );
        return;
      }

      const consentReady = await this.ensureCustomerConsent(message);
      if (!consentReady) return;

      const normalized = this.normalizePhone(message.contact.phone_number);
      const telegramUserId = String(message.from?.id || '');

      const activeCrmLink = telegramUserId
        ? await this.prisma.telegramCrmLink.findFirst({
            where: { telegramUserId, isActive: true },
            include: {
              employee: {
                select: { id: true, role: true, phone: true, name: true, login: true },
              },
            },
          })
        : null;

      if (
        activeCrmLink?.employee &&
        activeCrmLink.employee.role !== 'ADMIN' &&
        normalized.length >= 11
      ) {
        if (!activeCrmLink.employee.phone) {
          await this.prisma.employee
            .update({
              where: { id: activeCrmLink.employee.id },
              data: { phone: normalized },
            })
            .catch(() => undefined);
        }

        await this.sendReply(
          message,
          `Номер сохранён для CRM-аккаунта: ${activeCrmLink.employee.name || activeCrmLink.employee.login}`,
        );
        return;
      }

      const linkedCrm = await this.linkCrmByPhone(message, message.contact.phone_number, true);
      if (!linkedCrm) {
        await this.linkShopCustomerByPhone(message, message.contact.phone_number);
      }
      return;
    }

    if (!message.text) return;

    const text = String(message.text || '').trim();
    if (!text.startsWith('/')) {
      const lowered = text.toLowerCase();
      if (lowered === 'вход' || lowered === 'login' || lowered === 'start') {
        await this.handleCustomerLoginCommand(message, []);
        return;
      }

      await this.sendReply(
        message,
        [
          'Чтобы войти в личный кабинет, отправьте контакт через кнопку ниже.',
          'Если уже привязывались раньше, я сразу пришлю персональную ссылку входа.',
        ].join('\n'),
        this.contactRequestKeyboard(),
      );
      return;
    }

    const parts = text.split(/\s+/).filter(Boolean);
    if (!parts.length) return;

    const command = this.normalizeCommand(parts[0]);
    const args = parts.slice(1);

    if (command === '/start' || command === '/help') {
      const payload = String(args[0] || '').toLowerCase();
      if (command === '/start' && payload.startsWith('shop_login')) {
        const consentReady = await this.ensureCustomerConsent(message);
        if (!consentReady) return;

        const quickLoggedIn = await this.tryQuickCustomerLogin(message);
        if (quickLoggedIn) return;

        await this.sendReply(
          message,
          [
            'Для входа в личный кабинет TechnoPrime подтвердите номер телефона.',
            'После подтверждения я отправлю персональную кнопку входа на сайт.',
            `Ссылка будет действовать ${this.telegramAuthTtlMinutes} минут.`,
          ].join('\n'),
          this.contactRequestKeyboard(),
        );
        return;
      }

      if (command === '/start') {
        const consentReady = await this.ensureCustomerConsent(message);
        if (!consentReady) return;

        const quickLoggedIn = await this.tryQuickCustomerLogin(message);
        if (quickLoggedIn) return;
      }

      await this.sendReply(
        message,
        [
          'Добро пожаловать в бот магазина TechnoPrime.',
          '',
          'Клиентские команды:',
          '/login - вход в личный кабинет',
          '/orders - мои заказы',
          '/logout - отвязать Telegram',
          '',
          'Для входа используйте кнопку «Поделиться номером телефона».',
        ].join('\n'),
        this.contactRequestKeyboard(),
      );
      return;
    }

    if (command === '/login') {
      if (String(args[0] || '').toLowerCase() === 'crm') {
        await this.handleCrmLoginCommand(message, args);
      } else {
        await this.handleCustomerLoginCommand(message, args);
      }
      return;
    }

    if (command === '/orders' || command === '/my' || command === '/myorders') {
      await this.handleCustomerOrders(message);
      return;
    }

    if (command === '/logout') {
      if (String(args[0] || '').toLowerCase() === 'crm') {
        await this.handleLogoutCommand(message, args);
      } else {
        await this.handleCustomerLogout(message);
      }
      return;
    }

    await this.sendReply(message, 'Неизвестная команда. Используй /help');
  }

  private async handleCrmLoginCommand(message: TelegramMessage, args: string[]) {
    const scope = String(args[0] || '').toLowerCase();
    const firstArg = String(args[1] || '').trim();
    const password = String(args.slice(2).join(' ') || '').trim();

    if (scope !== 'crm') {
      await this.sendReply(message, 'Формат: /login crm <phone> или /login crm <login> <password>');
      return;
    }

    if (!firstArg) {
      if (message.contact?.phone_number) {
        await this.linkCrmByPhone(message, message.contact.phone_number);
        return;
      }

      await this.sendReply(
        message,
        'Укажи номер: /login crm +79991234567 или отправь контакт. Альтернатива: /login crm <login> <password>',
      );
      return;
    }

    if (!password) {
      await this.linkCrmByPhone(message, firstArg);
      return;
    }

    const login = firstArg;
    const employee = await this.prisma.employee.findUnique({
      where: { login },
      select: { id: true, name: true, login: true, role: true, passwordHash: true },
    });

    if (!employee) {
      await this.sendReply(message, 'Неверный логин или пароль');
      return;
    }

    const isValid = await bcrypt.compare(password, employee.passwordHash);
    if (!isValid) {
      await this.sendReply(message, 'Неверный логин или пароль');
      return;
    }

    if (employee.role === 'ADMIN') {
      await this.sendReply(message, 'Привязка через Telegram для ADMIN отключена');
      return;
    }

    const telegramUserId = String(message.from?.id || '');
    const telegramChatId = String(message.chat?.id || '');
    const telegramUsername = message.from?.username || null;

    await this.prisma.$transaction(async tx => {
      await tx.telegramCrmLink.deleteMany({
        where: {
          OR: [{ employeeId: employee.id }, { telegramUserId }, { telegramChatId }],
        },
      });

      await tx.telegramCrmLink.create({
        data: {
          employeeId: employee.id,
          telegramUserId,
          telegramChatId,
          telegramUsername,
          isActive: true,
        },
      });
    });

    await this.sendReply(
      message,
      `CRM подключена: ${employee.name || employee.login}. Уведомления о заказах включены.`,
    );
  }

  private async handleCustomerLoginCommand(message: TelegramMessage, args: string[]) {
    const consentReady = await this.ensureCustomerConsent(message);
    if (!consentReady) return;

    const firstArg = String(args[0] || '').trim();

    if (!firstArg) {
      const quickLoggedIn = await this.tryQuickCustomerLogin(message);
      if (quickLoggedIn) return;

      await this.sendReply(
        message,
        'Для входа отправьте контакт с номером телефона через кнопку ниже.',
        this.contactRequestKeyboard(),
      );
      return;
    }

    await this.sendReply(
      message,
      'Для безопасности ручной ввод номера отключен. Отправьте контакт через кнопку «Поделиться номером телефона».',
      this.contactRequestKeyboard(),
    );
  }

  private async resolveShopCustomerByTelegram(telegramId: string) {
    if (!telegramId) return null;
    const cached = this.readCache(this.shopCustomerByTelegramCache, telegramId);
    if (cached !== null) {
      return cached;
    }

    const customer = await this.prisma.shopCustomer.findUnique({
      where: { telegramId },
      select: { id: true, phone: true },
    });

    this.writeCache(
      this.shopCustomerByTelegramCache,
      telegramId,
      customer || null,
      this.shopCustomerCacheTtlMs,
    );

    return customer;
  }

  private formatOrderStatus(status: string) {
    const map: Record<string, string> = {
      NEW: 'Новый',
      IN_PROGRESS: 'В работе',
      DONE: 'Готов',
      CANCELED: 'Отменен',
    };
    return map[status] || status;
  }

  private async handleCustomerOrders(message: TelegramMessage) {
    const telegramId = String(message.from?.id || '');
    const customer = await this.resolveShopCustomerByTelegram(telegramId);
    if (!customer) {
      await this.sendReply(
        message,
        'Аккаунт не привязан. Отправьте контакт через кнопку «Поделиться номером телефона».',
        this.contactRequestKeyboard(),
      );
      return;
    }

    const directOrders = await this.prisma.order.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        source: OrderSource.STORE,
        shopCustomerId: customer.id,
      },
      include: {
        items: {
          include: {
            product: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
      take: 5,
    });

    let orders = directOrders;
    if (!orders.length && customer.phone) {
      const phoneAliases = this.buildPhoneAliases(customer.phone);
      if (!phoneAliases.length) {
        await this.sendReply(message, 'Заказов пока нет.');
        return;
      }
      const clients = await this.prisma.client.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          phone: { in: phoneAliases },
        },
        select: { id: true },
        take: 10,
      });

      if (clients.length) {
        orders = await this.prisma.order.findMany({
          where: {
            tenant: 'TECHNOPRIME',
            source: OrderSource.STORE,
            clientId: { in: clients.map(c => c.id) },
          },
          include: {
            items: {
              include: {
                product: {
                  select: { name: true },
                },
              },
            },
          },
          orderBy: { id: 'desc' },
          take: 5,
        });
      }
    }

    if (!orders.length) {
      await this.sendReply(message, 'Заказов пока нет.');
      return;
    }

    const lines = orders.map(order => {
      const topItems = order.items.slice(0, 3).map(it => {
        const label = it.variantLabel ? ` (${it.variantLabel})` : '';
        return `${it.product?.name || 'Товар'}${label} × ${it.qty}`;
      });

      return [
        `#${order.id} • ${this.formatOrderStatus(order.status)}`,
        `Сумма: ${new Decimal(order.totalPrice || 0).toFixed(2)} ₽`,
        ...topItems,
      ].join('\n');
    });

    await this.sendReply(message, ['Ваши последние заказы:', ...lines].join('\n\n'));
  }

  private async handleCustomerLogout(message: TelegramMessage) {
    const telegramId = String(message.from?.id || '');
    if (!telegramId) {
      await this.sendReply(message, 'Не удалось определить Telegram ID');
      return;
    }

    const result = await this.prisma.shopCustomer.updateMany({
      where: { telegramId },
      data: {
        telegramId: null,
        telegramUsername: null,
      },
    });

    if (result.count > 0) {
      this.shopCustomerByTelegramCache.delete(telegramId);
      await this.sendReply(message, 'Telegram отвязан от клиентского аккаунта.');
      return;
    }

    await this.sendReply(message, 'Аккаунт не был привязан.');
  }

  private async mergeShopCustomers(keepId: number, removeId: number) {
    if (keepId === removeId) return;

    await this.prisma.$transaction(async tx => {
      await tx.shopSession.updateMany({
        where: { customerId: removeId },
        data: { customerId: keepId },
      });

      await tx.shopAuthCode.updateMany({
        where: { customerId: removeId },
        data: { customerId: keepId },
      });

      await tx.order.updateMany({
        where: { shopCustomerId: removeId },
        data: { shopCustomerId: keepId },
      });

      await tx.shopCustomer.delete({
        where: { id: removeId },
      });
    });
  }

  private async linkCrmByPhone(message: TelegramMessage, rawPhone: string, silentNoMatch = false) {
    const normalized = this.normalizePhone(rawPhone);
    if (!normalized || normalized.length < 11) {
      if (!silentNoMatch) {
        await this.sendReply(message, 'Не удалось распознать номер телефона');
      }
      return false;
    }

    const phoneAliases = this.buildPhoneAliases(normalized);
    const phoneDigits = normalized.slice(-10);
    const loginAliases = phoneDigits
      ? Array.from(
          new Set([
            normalized,
            `+${normalized}`,
            phoneDigits,
            `7${phoneDigits}`,
            `8${phoneDigits}`,
          ]),
        )
      : [normalized, `+${normalized}`];
    const matches = await this.prisma.employee.findMany({
      where: {
        role: { not: 'ADMIN' },
        OR: [{ phone: { in: phoneAliases } }, { login: { in: loginAliases } }],
      },
      orderBy: { id: 'asc' },
      take: 2,
      select: {
        id: true,
        name: true,
        login: true,
        phone: true,
      },
    });

    if (!matches.length) {
      if (!silentNoMatch) {
        await this.sendReply(
          message,
          'Сотрудник CRM по номеру не найден. Используй /login crm <login> <password> или проверь номер в аккаунте.',
        );
      }
      return false;
    }

    if (matches.length > 1) {
      if (!silentNoMatch) {
        await this.sendReply(
          message,
          'Номер связан с несколькими логинами. Используй /login crm <login> <password>.',
        );
      }
      return false;
    }

    const employee = matches[0];
    const telegramUserId = String(message.from?.id || '');
    const telegramChatId = String(message.chat?.id || '');
    const telegramUsername = message.from?.username || null;

    await this.prisma.$transaction(async tx => {
      if (!employee.phone) {
        await tx.employee.update({
          where: { id: employee.id },
          data: { phone: normalized },
        });
      }

      await tx.telegramCrmLink.deleteMany({
        where: {
          OR: [{ employeeId: employee.id }, { telegramUserId }, { telegramChatId }],
        },
      });

      await tx.telegramCrmLink.create({
        data: {
          employeeId: employee.id,
          telegramUserId,
          telegramChatId,
          telegramUsername,
          isActive: true,
        },
      });
    });

    await this.sendReply(
      message,
      `CRM подключена по номеру: ${employee.name || employee.login}. Уведомления включены.`,
    );

    return true;
  }

  private async linkShopCustomerByPhone(message: TelegramMessage, rawPhone: string) {
    const normalized = this.normalizePhone(rawPhone);
    if (!normalized || normalized.length < 11) {
      await this.sendReply(message, 'Не удалось распознать номер телефона');
      return false;
    }

    const telegramId = String(message.from?.id || '');
    const telegramUsername = message.from?.username || null;

    const byTelegram = telegramId
      ? await this.prisma.shopCustomer.findUnique({
          where: { telegramId },
          select: {
            id: true,
            vkId: true,
            maxId: true,
            marketingConsent: true,
          },
        })
      : null;
    const byPhone = await this.prisma.shopCustomer.findUnique({
      where: { phone: normalized },
      select: {
        id: true,
        vkId: true,
        maxId: true,
        marketingConsent: true,
      },
    });

    if (byTelegram && byPhone && byTelegram.id !== byPhone.id) {
      await this.sendReply(
        message,
        'Этот аккаунт уже привязан. Перейдите в нужный профиль и отвяжите соцсеть, затем повторите.',
      );
      return false;
    }

    const targetId = byPhone?.id || byTelegram?.id || null;

    const fallbackName = this.crmSync.formatDisplayName(
      message.from?.first_name || null,
      message.from?.last_name || null,
      normalized,
    );
    const syncedClient = await this.crmSync.upsertClientByPhone({
      phone: normalized,
      name: fallbackName,
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
    });
    const parsed = this.crmSync.parsePersonName(syncedClient?.name || fallbackName);

    let savedCustomerId = targetId || 0;
    if (targetId) {
      const updated = await this.prisma.shopCustomer.update({
        where: { id: targetId },
        data: {
          phone: normalized,
          telegramId: telegramId || undefined,
          telegramUsername,
          firstName: parsed.firstName || undefined,
          lastName: parsed.lastName || undefined,
          lastLoginAt: new Date(),
        },
      });
      savedCustomerId = updated.id;
    } else {
      const created = await this.prisma.shopCustomer.create({
        data: {
          phone: normalized,
          telegramId: telegramId || null,
          telegramUsername,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          lastLoginAt: new Date(),
        },
      });
      savedCustomerId = created.id;
    }

    if (telegramId) {
      this.writeCache(
        this.shopCustomerByTelegramCache,
        telegramId,
        { id: savedCustomerId, phone: normalized },
        this.shopCustomerCacheTtlMs,
      );
    }

    return this.sendCustomerLoginLink(message, normalized, 'verified');
  }

  private async handleLogoutCommand(message: TelegramMessage, args: string[]) {
    const scope = String(args[0] || '').toLowerCase();
    if (scope !== 'crm') {
      await this.sendReply(message, 'Формат: /logout crm');
      return;
    }

    const telegramUserId = String(message.from?.id || '');
    const telegramChatId = String(message.chat?.id || '');

    const result = await this.prisma.telegramCrmLink.updateMany({
      where: {
        OR: [{ telegramUserId }, { telegramChatId }],
      },
      data: {
        isActive: false,
      },
    });

    if (result.count > 0) {
      await this.sendReply(message, 'CRM отключена. Уведомления остановлены.');
      return;
    }

    await this.sendReply(message, 'Активная CRM-привязка не найдена.');
  }

  private async sendReply(message: TelegramMessage, text: string, replyMarkup?: unknown) {
    const chatId = String(message.chat?.id || '');
    if (!chatId) return false;
    return this.sendMessage(chatId, text, replyMarkup, 'interactive');
  }

  private async forEachWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
  ) {
    if (!items.length) return;
    const limit = Math.max(1, Math.min(concurrency, items.length));
    let index = 0;

    const runWorker = async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        await worker(items[currentIndex]);
      }
    };

    await Promise.all(Array.from({ length: limit }, () => runWorker()));
  }

  private async broadcast(text: string) {
    const links = await this.prisma.telegramCrmLink.findMany({
      where: { isActive: true },
      select: { id: true, telegramChatId: true },
    });

    if (!links.length) return;

    await this.forEachWithConcurrency(links, this.broadcastConcurrency, async link => {
      await this.sendMessage(link.telegramChatId, text, undefined, 'background').catch(error => {
        this.logger.warn(`Telegram send failed for link #${link.id}: ${String(error)}`);
      });
    });
  }

  private async broadcastOrder(text: string, orderId: number) {
    const links = await this.prisma.telegramCrmLink.findMany({
      where: { isActive: true },
      select: { id: true, telegramChatId: true, lastSeenOrderId: true },
    });

    if (!links.length) return;

    const pending = links.filter(link => link.lastSeenOrderId < orderId);
    if (!pending.length) return;

    const deliveredIds: number[] = [];
    await this.forEachWithConcurrency(pending, this.broadcastConcurrency, async link => {
      const sent = await this.sendMessage(link.telegramChatId, text, undefined, 'background').catch(
        error => {
          this.logger.warn(`Telegram send failed for link #${link.id}: ${String(error)}`);
          return false;
        },
      );

      if (sent) {
        deliveredIds.push(link.id);
      }
    });

    if (deliveredIds.length) {
      await this.prisma.telegramCrmLink
        .updateMany({
          where: { id: { in: deliveredIds } },
          data: { lastSeenOrderId: orderId },
        })
        .catch(() => undefined);
    }
  }

  private async answerCallbackQuery(callbackQueryId: string, text: string) {
    if (!callbackQueryId || !this.getBotToken()) return false;

    try {
      const res = await this.sendTelegramRequest(
        'answerCallbackQuery',
        {
          callback_query_id: callbackQueryId,
          text,
          show_alert: false,
        },
        {
          timeoutMs: this.telegramInteractiveTimeoutMs,
          retryAttempts: this.telegramInteractiveRetryAttempts,
        },
      );
      if (!res) return false;
      return res.ok;
    } catch {
      return false;
    }
  }

  private async sendMessage(
    chatId: string,
    text: string,
    replyMarkup?: unknown,
    mode: TelegramSendMode = 'interactive',
  ) {
    if (!this.getBotToken()) return false;
    const requestOptions: TelegramRequestOptions =
      mode === 'background'
        ? {
            timeoutMs: this.telegramBackgroundTimeoutMs,
            retryAttempts: this.telegramBackgroundRetryAttempts,
          }
        : {
            timeoutMs: this.telegramInteractiveTimeoutMs,
            retryAttempts: this.telegramInteractiveRetryAttempts,
          };

    try {
      const res = await this.sendTelegramRequest(
        'sendMessage',
        {
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        },
        requestOptions,
      );
      if (!res) return false;

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`Telegram API error (${res.status}): ${body.slice(0, 300)}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(`Telegram request failed: ${String(error)}`);
      return false;
    }
  }

  async sendOtpCode(telegramChatId: string, code: string, expiresAt: Date) {
    const chatId = String(telegramChatId || '').trim();
    if (!chatId) return false;

    const otpTimezone =
      String(process.env.SHOP_OTP_TIMEZONE || process.env.TZ || 'Europe/Moscow').trim() ||
      'Europe/Moscow';

    const expiresAtLabel = expiresAt.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: otpTimezone,
    });

    return this.sendMessage(
      chatId,
      [
        `Код входа TechnoPrime: ${code}`,
        `Срок действия: до ${expiresAtLabel}.`,
        'Если вы не запрашивали вход, просто проигнорируйте это сообщение.',
      ].join('\n'),
      undefined,
      'interactive',
    );
  }
}
