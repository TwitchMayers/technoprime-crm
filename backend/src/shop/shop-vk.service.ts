import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ShopAccountService } from './shop-account.service';
import { ShopOrdersService } from './shop-orders.service';
import { PrismaService } from '../prisma.service';
import { ShopCrmSyncService } from './shop-crm-sync.service';
import crypto from 'crypto';
import { resolveShopPublicUrl } from './shop-public-url.util';

type VkIncomingMessage = {
  peerId: number;
  fromId: number;
  text: string;
  payload: Record<string, unknown> | null;
};

@Injectable()
export class ShopVkService {
  private readonly logger = new Logger(ShopVkService.name);
  private readonly vkLinkCodeTtlMinutes = 10;

  private longPollServer: string | null = null;
  private longPollKey: string | null = null;
  private longPollTs: string | null = null;
  private pollingBusy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: ShopAccountService,
    private readonly ordersService: ShopOrdersService,
    private readonly crmSync: ShopCrmSyncService,
  ) {}

  private getToken() {
    return String(
      process.env.SHOP_VK_BOT_TOKEN ||
        process.env.CRM_VK_COMMUNITY_TOKEN ||
        process.env.CRM_VK_TOKEN ||
        process.env.VK_GROUP_TOKEN ||
        '',
    ).trim();
  }

  private getApiVersion() {
    return String(
      process.env.SHOP_VK_API_VERSION || process.env.CRM_VK_API_VERSION || '5.199',
    ).trim();
  }

  private getGroupId() {
    const raw = Number(process.env.SHOP_VK_GROUP_ID || 0);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : null;
  }

  private getShopUrl() {
    return resolveShopPublicUrl();
  }

  private getBotLink() {
    const explicit = String(process.env.SHOP_VK_BOT_LINK || '').trim();
    if (explicit) return explicit;
    const groupId = this.getGroupId();
    return groupId ? `https://vk.me/public${groupId}` : null;
  }

  private getWebhookSecret() {
    return String(process.env.SHOP_VK_WEBHOOK_SECRET || '').trim();
  }

  private getConfirmationToken() {
    return String(
      process.env.SHOP_VK_CALLBACK_CONFIRMATION_TOKEN ||
        process.env.SHOP_VK_CONFIRMATION_TOKEN ||
        '',
    ).trim();
  }

  private normalizePhone(input?: string | null) {
    const digits = String(input || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
    if (digits.length >= 11) return digits.slice(-11);
    return '';
  }

  private generateCode() {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private hashCode(code: string) {
    const secret = String(process.env.SHOP_OTP_SECRET || process.env.JWT_SECRET || '').trim();
    if (!secret) {
      throw new ServiceUnavailableException('OTP secret is not configured');
    }
    return crypto
      .createHash('sha256')
      .update(code + secret)
      .digest('hex');
  }

  private normalizeBindingCode(input?: string | null) {
    const value = String(input || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    return /^[A-Z2-9]{8}$/.test(value) ? value : '';
  }

  private generateBindingCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let value = '';
    for (let index = 0; index < 8; index += 1) {
      value += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return value;
  }

  private hashBindingCode(code: string) {
    const normalized = this.normalizeBindingCode(code);
    if (!normalized) {
      throw new ServiceUnavailableException('VK link code is invalid');
    }
    return this.hashCode(`vk-link:${normalized}`);
  }

  private async createShopVkLoginLink(phone: string) {
    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.shopAuthCode.create({
      data: {
        phone,
        codeHash,
        expiresAt,
      },
    });

    const baseUrl = this.getShopUrl();
    return `${baseUrl}/account?tg_phone=${encodeURIComponent(phone)}&tg_code=${encodeURIComponent(code)}`;
  }

  async createVkLinkCode(customerId: number) {
    const customer = await this.findCustomerById(customerId);
    if (!customer) {
      throw new UnauthorizedException('Сессия магазина недействительна');
    }
    if (!customer.phone) {
      throw new UnauthorizedException(
        'Для привязки VK в профиле должен быть подтвержденный номер телефона',
      );
    }
    if (customer.vkId) {
      return {
        success: true,
        alreadyLinked: true,
        botLink: this.getBotLink(),
      };
    }

    const code = this.generateBindingCode();
    const codeHash = this.hashBindingCode(code);
    const expiresAt = new Date(Date.now() + this.vkLinkCodeTtlMinutes * 60 * 1000);

    await this.prisma.shopAuthCode.updateMany({
      where: {
        customerId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await this.prisma.shopAuthCode.create({
      data: {
        phone: customer.phone,
        customerId,
        codeHash,
        expiresAt,
      },
    });

    return {
      success: true,
      code,
      expiresAt: expiresAt.toISOString(),
      botLink: this.getBotLink(),
      alreadyLinked: false,
    };
  }

  private isPollingEnabled() {
    return process.env.SHOP_VK_POLLING === 'true' && !this.hasWebhookConfig();
  }

  private hasWebhookConfig() {
    return Boolean(this.getWebhookSecret() || this.getConfirmationToken());
  }

  private async callVkMethod(method: string, params: Record<string, string>) {
    const token = this.getToken();
    if (!token) {
      throw new Error('VK token is not configured');
    }

    const form = new URLSearchParams();
    form.set('access_token', token);
    form.set('v', this.getApiVersion());

    for (const [key, value] of Object.entries(params)) {
      form.set(key, String(value));
    }

    const res = await fetch(`https://api.vk.com/method/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`VK API HTTP ${res.status}`);
    }
    if (data?.error) {
      throw new Error(
        `${data.error.error_msg || 'VK API error'} (${data.error.error_code || 'n/a'})`,
      );
    }
    return data?.response;
  }

  async diagnostics() {
    const token = this.getToken();
    const groupId = this.getGroupId();

    const result: Record<string, unknown> = {
      oauthConfigured: Boolean(this.getToken() && this.getApiVersion() && this.getShopUrl()),
      botTokenConfigured: Boolean(token),
      groupIdConfigured: Boolean(groupId),
      groupId: groupId || null,
      pollingEnabled: this.isPollingEnabled(),
      webhookSecretConfigured: Boolean(this.getWebhookSecret()),
      callbackConfirmationConfigured: Boolean(this.getConfirmationToken()),
      longPoll: {
        ok: false,
        message: 'Не проверено',
      },
    };

    if (!token || !groupId) {
      result.longPoll = {
        ok: false,
        message: 'Нет токена или group_id',
      };
      return result;
    }

    try {
      await this.callVkMethod('groups.getLongPollServer', {
        group_id: String(groupId),
      });
      result.longPoll = {
        ok: true,
        message: 'Long Poll включен и доступен',
      };
      return result;
    } catch (error) {
      const text = String(error || '');
      result.longPoll = {
        ok: false,
        message: text,
      };
      return result;
    }
  }

  private async sendMessage(
    peerId: number,
    text: string,
    keyboard?: Record<string, unknown> | null,
  ) {
    const message = String(text || '').trim();
    if (!message) return;
    if (!this.getToken()) return;

    const params: Record<string, string> = {
      peer_id: String(peerId),
      random_id: String(Date.now() + Math.floor(Math.random() * 10000)),
      message,
    };
    if (keyboard) {
      params.keyboard = JSON.stringify(keyboard);
    }

    await this.callVkMethod('messages.send', params).catch(error => {
      this.logger.warn(`VK send failed: ${String(error)}`);
      return null;
    });
  }

  async sendOtpCode(vkId: string, code: string, expiresAt: Date) {
    const peerId = Number(vkId || 0);
    if (!peerId) return false;

    const otpTimezone =
      String(process.env.SHOP_OTP_TIMEZONE || process.env.TZ || 'Europe/Moscow').trim() ||
      'Europe/Moscow';

    const expiresAtLabel = expiresAt.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: otpTimezone,
    });

    const text = [
      `Код входа TechnoPrime: ${code}`,
      `Срок действия: до ${expiresAtLabel}.`,
      'Если вы не запрашивали вход, просто проигнорируйте это сообщение.',
    ].join('\n');

    try {
      await this.callVkMethod('messages.send', {
        peer_id: String(peerId),
        random_id: String(Date.now() + Math.floor(Math.random() * 10000)),
        message: text,
      });
      return true;
    } catch (error) {
      this.logger.warn(`VK OTP send failed: ${String(error)}`);
      return false;
    }
  }

  private textButton(label: string, action: string, color: 'primary' | 'secondary' = 'secondary') {
    return {
      action: {
        type: 'text',
        label,
        payload: JSON.stringify({ action }),
      },
      color,
    };
  }

  private openLinkButton(label: string, link: string) {
    return {
      action: {
        type: 'open_link',
        label,
        link,
      },
    };
  }

  private linkedKeyboard() {
    const accountUrl = `${this.getShopUrl()}/account`;
    return {
      one_time: false,
      buttons: [
        [
          this.textButton('Войти на сайт', 'login', 'primary'),
          this.textButton('Профиль', 'profile'),
        ],
        [this.textButton('Заказы', 'orders'), this.textButton('Подписки', 'subscriptions')],
        [this.textButton('Рассылки', 'campaigns')],
        [this.openLinkButton('Открыть сайт', accountUrl)],
      ],
    };
  }

  private unlinkedKeyboard() {
    const accountUrl = `${this.getShopUrl()}/account`;
    return {
      one_time: false,
      buttons: [
        [this.openLinkButton('Открыть личный кабинет', accountUrl)],
        [this.textButton('Как войти через VK', 'help_login', 'primary')],
      ],
    };
  }

  private parsePayload(input: unknown) {
    if (!input) return null;
    if (typeof input === 'object') return input as Record<string, unknown>;
    if (typeof input !== 'string') return null;
    try {
      const parsed = JSON.parse(input) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private extractIncomingMessage(rawObject: any): VkIncomingMessage | null {
    if (!rawObject || typeof rawObject !== 'object') return null;
    const message =
      rawObject.message && typeof rawObject.message === 'object' ? rawObject.message : rawObject;

    const peerId = Number(message?.peer_id || 0);
    const fromId = Number(message?.from_id || 0);
    if (!peerId || !fromId) return null;

    const text = typeof message?.text === 'string' ? message.text : '';
    const payload = this.parsePayload(message?.payload);

    return {
      peerId,
      fromId,
      text,
      payload,
    };
  }

  private async ensureLongPollServer(force = false) {
    if (!force && this.longPollServer && this.longPollKey && this.longPollTs) {
      return;
    }

    const groupId = this.getGroupId();
    const params: Record<string, string> = {};
    if (groupId) {
      params.group_id = String(groupId);
    }

    const data = await this.callVkMethod('groups.getLongPollServer', params);
    const server = String(data?.server || '').trim();
    const key = String(data?.key || '').trim();
    const ts = String(data?.ts || '').trim();

    if (!server || !key || !ts) {
      throw new Error('VK Long Poll server payload is invalid');
    }

    this.longPollServer = server;
    this.longPollKey = key;
    this.longPollTs = ts;
  }

  private resetLongPoll() {
    this.longPollServer = null;
    this.longPollKey = null;
    this.longPollTs = null;
  }

  private normalizeCommand(message: VkIncomingMessage) {
    const payloadAction = String(message.payload?.action || '').toLowerCase();
    if (payloadAction) return payloadAction;

    const text = String(message.text || '')
      .trim()
      .toLowerCase();
    if (!text) return 'menu';
    if (
      text === 'start' ||
      text === '/start' ||
      text === '/help' ||
      text === 'меню' ||
      text === 'начать' ||
      text === '/начать'
    ) {
      return 'menu';
    }
    if (text.includes('вход') || text.includes('login') || text.includes('авториз')) return 'login';
    if (text.includes('проф')) return 'profile';
    if (text.includes('заказ')) return 'orders';
    if (text.includes('подпис')) return 'subscriptions';
    if (text.includes('рассыл') || text.includes('уведом')) return 'campaigns';
    return 'menu';
  }

  private maskPhone(phone?: string | null) {
    const raw = String(phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 10) return raw || '—';
    const last = digits.slice(-10);
    return `+7 (${last.slice(0, 3)}) ***-**-${last.slice(8, 10)}`;
  }

  private formatOrderStatus(status: string) {
    const map: Record<string, string> = {
      NEW: 'Новый',
      IN_PROGRESS: 'В работе',
      COMPLETED: 'Завершен',
      CANCELED: 'Отменен',
    };
    return map[status] || status;
  }

  private async sendUnlinkedMessage(peerId: number) {
    const botLink = this.getBotLink();
    await this.sendMessage(
      peerId,
      [
        'Для безопасности привязка VK по номеру телефона в чате отключена.',
        'Сначала войдите в личный кабинет TechnoPrime на сайте, нажмите «Привязать VK» и получите одноразовый код привязки.',
        'После этого отправьте код сюда одним сообщением.',
        'Если VK уже привязан, просто отправьте слово «вход».',
        botLink ? `Если чат не открылся из сайта, используйте ссылку: ${botLink}` : '',
      ].join('\n'),
      this.unlinkedKeyboard(),
    );
  }

  private async sendCustomerLoginLink(
    peerId: number,
    phone: string,
    mode: 'linked' | 'quick' = 'linked',
  ) {
    const normalized = this.normalizePhone(phone);
    if (!normalized || normalized.length < 11) return false;

    const loginLink = await this.createShopVkLoginLink(normalized);
    await this.sendMessage(
      peerId,
      [
        mode === 'quick'
          ? 'VK успешно привязан к вашему профилю.'
          : 'Авторизация через VK подтверждена.',
        `Откройте ссылку для входа в личный кабинет. Она действует 10 минут:`,
        loginLink,
      ].join('\n'),
      {
        one_time: true,
        buttons: [[this.openLinkButton('Войти в личный кабинет', loginLink)]],
      },
    );
    return true;
  }

  private async sendMenu(peerId: number, customerId: number) {
    const overview = await this.accountService.getOverview(customerId);
    const name =
      [overview.user.firstName, overview.user.lastName].filter(Boolean).join(' ').trim() ||
      'пользователь';
    await this.sendMessage(
      peerId,
      [`Здравствуйте, ${name}.`, 'Доступные разделы: Профиль, Заказы, Подписки, Рассылки.'].join(
        '\n',
      ),
      this.linkedKeyboard(),
    );
  }

  private async sendProfile(peerId: number, customerId: number) {
    const overview = await this.accountService.getOverview(customerId);
    const user = overview.user;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || '—';

    await this.sendMessage(
      peerId,
      [
        'Профиль TechnoPrime',
        `Имя: ${fullName}`,
        `Телефон: ${this.maskPhone(user.phone)}`,
        `VK: ${user.vkId ? 'привязан' : 'не привязан'}`,
      ].join('\n'),
      this.linkedKeyboard(),
    );
  }

  private async sendSubscriptions(peerId: number, customerId: number) {
    const overview = await this.accountService.getOverview(customerId);
    if (!overview.subscriptions.length) {
      await this.sendMessage(peerId, 'Активных подписок пока нет.', this.linkedKeyboard());
      return;
    }

    const lines = overview.subscriptions.slice(0, 12).map((item, index) => {
      const status = item.isActive ? `активна, ${item.daysLeft} дн.` : 'неактивна';
      return `${index + 1}. ${item.typeLabel} (${item.consoleType || 'платформа не указана'}) - ${status}`;
    });

    await this.sendMessage(peerId, ['Подписки:', ...lines].join('\n'), this.linkedKeyboard());
  }

  private async sendOrders(peerId: number, customerId: number) {
    const orders = await this.ordersService.myOrders(customerId);
    const items = Array.isArray((orders as any)?.items)
      ? ((orders as any).items as Array<any>)
      : [];

    if (!items.length) {
      await this.sendMessage(peerId, 'История заказов пока пустая.', this.linkedKeyboard());
      return;
    }

    const lines = items.map((order, index) => {
      const date = new Date(order.date).toLocaleDateString('ru-RU');
      return `${index + 1}. #${order.id} • ${this.formatOrderStatus(order.status)} • ${order.totalPrice} ₽ • ${date}`;
    });

    const chunkSize = 20;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      const header = i === 0 ? 'История заказов:' : 'Продолжение истории заказов:';
      await this.sendMessage(peerId, [header, ...chunk].join('\n'), this.linkedKeyboard());
    }
  }

  private async sendCampaignSettings(peerId: number, customerId: number) {
    const overview = await this.accountService.getOverview(customerId);
    const user = overview.user;

    await this.sendMessage(
      peerId,
      [
        'Настройки рассылок',
        `Статусы заказов: ${user.notifyOrderStatus ? 'включено' : 'выключено'}`,
        `Подписки и продления: ${user.notifySubscription ? 'включено' : 'выключено'}`,
        `Сервисные сообщения: ${user.notifyService ? 'включено' : 'выключено'}`,
        `Рекламные рассылки: ${user.notifyMarketing ? 'включено' : 'выключено'}`,
      ].join('\n'),
      this.linkedKeyboard(),
    );
  }

  private async findCustomerIdByVk(vkId: string) {
    const customer = await this.prisma.shopCustomer
      .findFirst({
        where: { vkId },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      .catch(() => null);
    return customer?.id || null;
  }

  private async findCustomerById(customerId: number) {
    return this.prisma.shopCustomer.findUnique({
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
  }

  private async tryLinkByCode(input: { vkId: string; code: string }) {
    const normalizedCode = this.normalizeBindingCode(input.code);
    if (!normalizedCode) return null;

    const codeHash = this.hashBindingCode(normalizedCode);
    const record = await this.prisma.shopAuthCode.findFirst({
      where: {
        codeHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
        customerId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        customerId: true,
      },
    });
    if (!record?.customerId) return null;

    const customer = await this.findCustomerById(record.customerId);
    if (!customer) return null;

    const conflict = await this.prisma.shopCustomer.findFirst({
      where: {
        vkId: input.vkId,
        NOT: { id: customer.id },
      },
      select: { id: true },
    });
    if (conflict) {
      return { conflict: true as const, customerId: customer.id, phone: customer.phone };
    }

    const updated = await this.prisma.shopCustomer.update({
      where: { id: customer.id },
      data: {
        vkId: input.vkId,
      },
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

    await this.prisma.shopAuthCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    if (updated.phone) {
      await this.crmSync
        .upsertClientByPhone({
          phone: updated.phone,
          name: this.crmSync.formatDisplayName(updated.firstName, updated.lastName, updated.phone),
          telegramId: updated.telegramId || null,
          telegramUsername: updated.telegramUsername || null,
          vkId: updated.vkId || null,
          maxId: updated.maxId || null,
          marketingConsent: updated.marketingConsent,
        })
        .catch(() => undefined);
    }

    return { conflict: false as const, customerId: updated.id, phone: updated.phone };
  }

  private async handleIncomingMessage(message: VkIncomingMessage) {
    // Бот работает только в личных сообщениях сообщества.
    if (message.peerId !== message.fromId) return;

    const customerId = await this.findCustomerIdByVk(String(message.fromId));
    if (!customerId) {
      const bindingCode = this.normalizeBindingCode(message.text);
      if (bindingCode) {
        const linked = await this.tryLinkByCode({
          vkId: String(message.fromId),
          code: bindingCode,
        });
        if (linked?.conflict) {
          await this.sendMessage(
            message.peerId,
            'Этот VK аккаунт уже привязан к другому профилю. Отвяжите его в текущем профиле и повторите попытку.',
          );
          return;
        }
        if (linked?.customerId && linked.phone) {
          await this.sendMessage(
            message.peerId,
            [
              'VK успешно привязан к вашему профилю TechnoPrime.',
              'Теперь для входа на сайт просто отправьте сюда слово «вход».',
            ].join('\n'),
            this.linkedKeyboard(),
          );
          return;
        }
      }

      if (this.normalizeCommand(message) === 'help_login') {
        await this.sendUnlinkedMessage(message.peerId);
        return;
      }

      await this.sendUnlinkedMessage(message.peerId);
      return;
    }

    const command = this.normalizeCommand(message);
    if (command === 'login') {
      const customer = await this.findCustomerById(customerId);
      if (!customer?.phone) {
        await this.sendMessage(
          message.peerId,
          'Для входа нужен подтверждённый номер телефона в профиле.',
        );
        return;
      }
      await this.sendCustomerLoginLink(message.peerId, customer.phone, 'linked');
      return;
    }
    if (command === 'profile') {
      await this.sendProfile(message.peerId, customerId);
      return;
    }
    if (command === 'orders') {
      await this.sendOrders(message.peerId, customerId);
      return;
    }
    if (command === 'subscriptions') {
      await this.sendSubscriptions(message.peerId, customerId);
      return;
    }
    if (command === 'campaigns') {
      await this.sendCampaignSettings(message.peerId, customerId);
      return;
    }

    await this.sendMenu(message.peerId, customerId);
  }

  async handleWebhook(event: Record<string, unknown>) {
    const type = String(event?.type || '');
    if (type === 'confirmation') {
      const token = this.getConfirmationToken();
      if (!token) {
        throw new UnauthorizedException('VK confirmation token is not configured');
      }
      return token;
    }

    const expectedSecret = this.getWebhookSecret();
    if (expectedSecret && String(event?.secret || '') !== expectedSecret) {
      throw new UnauthorizedException('Invalid VK webhook secret');
    }

    if (type === 'message_new') {
      const message = this.extractIncomingMessage((event as any)?.object);
      if (message) {
        await this.handleIncomingMessage(message);
      }
    }

    return 'ok';
  }

  @Cron('*/5 * * * * *')
  async pollUpdates() {
    if (!this.isPollingEnabled()) return;
    if (!this.getToken()) return;
    if (this.pollingBusy) return;

    this.pollingBusy = true;
    try {
      await this.ensureLongPollServer();
      if (!this.longPollServer || !this.longPollKey || !this.longPollTs) return;

      const url = new URL(this.longPollServer);
      url.searchParams.set('act', 'a_check');
      url.searchParams.set('key', this.longPollKey);
      url.searchParams.set('ts', this.longPollTs);
      url.searchParams.set('wait', '25');

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        this.resetLongPoll();
        return;
      }

      if (data.failed) {
        if (Number(data.failed) === 1 && data.ts) {
          this.longPollTs = String(data.ts);
        } else {
          this.resetLongPoll();
        }
        return;
      }

      if (data.ts) {
        this.longPollTs = String(data.ts);
      }

      const updates = Array.isArray(data.updates) ? data.updates : [];
      for (const rawUpdate of updates) {
        if (String(rawUpdate?.type || '') !== 'message_new') continue;
        const message = this.extractIncomingMessage(rawUpdate?.object);
        if (!message) continue;
        await this.handleIncomingMessage(message);
      }
    } catch (error) {
      this.logger.warn(`VK polling failed: ${String(error)}`);
      this.resetLongPoll();
    } finally {
      this.pollingBusy = false;
    }
  }
}
