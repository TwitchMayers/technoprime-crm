import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ShopAccountService } from './shop-account.service';
import { ShopCrmSyncService } from './shop-crm-sync.service';
import { ShopOrdersService } from './shop-orders.service';
import { PrismaService } from '../prisma.service';
import { CommunicationService } from '../communication/communication.service';
import { resolveShopPublicUrl } from './shop-public-url.util';

type MaxIncomingMessage = {
  userId: string;
  chatId: string;
  text: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
};

@Injectable()
export class ShopMaxService {
  private readonly logger = new Logger(ShopMaxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accountService: ShopAccountService,
    private readonly ordersService: ShopOrdersService,
    private readonly crmSync: ShopCrmSyncService,
    private readonly communication: CommunicationService,
  ) {}

  private getWebhookSecret() {
    return String(
      process.env.SHOP_MAX_WEBHOOK_SECRET || process.env.CRM_MAX_WEBHOOK_SECRET || '',
    ).trim();
  }

  private getOutboundConfigured() {
    return Boolean(
      String(process.env.CRM_MAX_WEBHOOK_URL || process.env.MAX_WEBHOOK_URL || '').trim(),
    );
  }

  private getShopUrl() {
    return resolveShopPublicUrl();
  }

  private getBotLink() {
    return String(process.env.SHOP_MAX_BOT_LINK || '').trim();
  }

  async diagnostics() {
    return {
      outboundConfigured: this.getOutboundConfigured(),
      webhookSecretConfigured: Boolean(this.getWebhookSecret()),
      shopUrlConfigured: Boolean(this.getShopUrl()),
      botLinkConfigured: Boolean(this.getBotLink()),
      mode: 'webhook',
    };
  }

  private normalizePhone(input?: string | null) {
    const digits = String(input || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
    if (digits.length >= 11) return digits.slice(-11);
    return '';
  }

  private buildPhoneVariants(phone?: string | null) {
    const normalized = this.normalizePhone(phone);
    if (!normalized) return [] as string[];
    const variants = new Set<string>([
      normalized,
      `+${normalized}`,
      normalized.slice(-10),
      `+7${normalized.slice(-10)}`,
      `7${normalized.slice(-10)}`,
    ]);
    return Array.from(variants);
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

  private extractNestedValue(source: any, paths: string[]) {
    for (const path of paths) {
      const parts = path.split('.');
      let current = source;
      let ok = true;
      for (const key of parts) {
        if (!current || typeof current !== 'object' || !(key in current)) {
          ok = false;
          break;
        }
        current = current[key];
      }
      if (ok && current !== undefined && current !== null) {
        return current;
      }
    }
    return undefined;
  }

  private extractIncomingMessage(rawBody: Record<string, unknown>) {
    const body = rawBody || {};
    const object = ((body.object || body.data || body.message) as any) || body;
    const payload = this.parsePayload(object?.payload);

    const eventType = String((body as any).type || (body as any).event || '').toLowerCase();
    if (eventType && !eventType.includes('message')) {
      return null;
    }

    const userIdRaw = this.extractNestedValue(object, [
      'user_id',
      'from_id',
      'sender_id',
      'from.id',
      'user.id',
      'author.id',
      'chat.user_id',
    ]);
    const chatIdRaw = this.extractNestedValue(object, [
      'chat_id',
      'peer_id',
      'conversation_id',
      'chat.id',
      'dialog.id',
    ]);
    const textRaw = this.extractNestedValue(object, ['text', 'message', 'body']);
    const payloadAction = String((payload as any)?.action || '').trim();
    const payloadPhone = this.extractNestedValue(object, [
      'phone',
      'from.phone',
      'user.phone',
      'sender.phone',
      'contact.phone',
    ]);

    const userId = String(userIdRaw || '').trim();
    if (!userId) return null;
    const chatId = String(chatIdRaw || userId).trim() || userId;
    const text = String(textRaw || payloadAction || '').trim();
    const phone = String(payloadPhone || '').trim() || null;
    const firstName =
      String(
        this.extractNestedValue(object, ['first_name', 'from.first_name', 'user.first_name']) || '',
      ).trim() || null;
    const lastName =
      String(
        this.extractNestedValue(object, ['last_name', 'from.last_name', 'user.last_name']) || '',
      ).trim() || null;

    return {
      userId,
      chatId,
      text,
      phone,
      firstName,
      lastName,
    } as MaxIncomingMessage;
  }

  private parsePhoneFromText(text: string) {
    const normalized = String(text || '')
      .replace(/[^\d+]/g, '')
      .trim();
    if (!normalized) return '';
    return this.normalizePhone(normalized);
  }

  private normalizeCommand(text: string) {
    const value = String(text || '')
      .trim()
      .toLowerCase();
    if (!value) return 'menu';
    if (
      value === 'start' ||
      value === '/start' ||
      value === '/help' ||
      value === 'меню' ||
      value === 'начать'
    ) {
      return 'menu';
    }
    if (value.includes('проф')) return 'profile';
    if (value.includes('заказ')) return 'orders';
    if (value.includes('подпис')) return 'subscriptions';
    if (value.includes('рассыл') || value.includes('уведом')) return 'campaigns';
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

  private async sendMessage(userId: string, text: string) {
    const message = String(text || '').trim();
    if (!message) return;
    const result = await this.communication.sendMaxMessage(userId, message, []);
    if (!result.success) {
      this.logger.warn(`MAX send failed: ${String(result.error || 'unknown error')}`);
    }
  }

  private async findCustomerByMaxId(maxId: string) {
    const customer = await this.prisma.shopCustomer
      .findFirst({
        where: { maxId },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
      .catch(() => null);
    return customer?.id || null;
  }

  private async sendUnlinkedMessage(userId: string) {
    const accountUrl = `${this.getShopUrl()}/account`;
    const botLink = this.getBotLink();
    const tail = botLink ? `MAX-бот: ${botLink}` : `Личный кабинет: ${accountUrl}`;
    await this.sendMessage(
      userId,
      [
        'Аккаунт MAX пока не связан с профилем магазина.',
        'Автоматическая привязка по номеру телефона отключена из соображений безопасности.',
        'Используйте вход по телефону или Telegram в личном кабинете TechnoPrime.',
        tail,
      ].join('\n'),
    );
  }

  private async sendMenu(userId: string, customerId: number) {
    const overview = await this.accountService.getOverview(customerId);
    const name =
      [overview.user.firstName, overview.user.lastName].filter(Boolean).join(' ').trim() ||
      'пользователь';
    await this.sendMessage(
      userId,
      [
        `Здравствуйте, ${name}.`,
        'Доступные разделы: Профиль, Заказы, Подписки, Рассылки.',
        'Команды: "профиль", "заказы", "подписки", "рассылки".',
      ].join('\n'),
    );
  }

  private async sendProfile(userId: string, customerId: number) {
    const overview = await this.accountService.getOverview(customerId);
    const user = overview.user;
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || '—';

    await this.sendMessage(
      userId,
      [
        'Профиль TechnoPrime',
        `Имя: ${fullName}`,
        `Телефон: ${this.maskPhone(user.phone)}`,
        `MAX: ${user.maxId ? 'привязан' : 'не привязан'}`,
      ].join('\n'),
    );
  }

  private async sendSubscriptions(userId: string, customerId: number) {
    const overview = await this.accountService.getOverview(customerId);
    if (!overview.subscriptions.length) {
      await this.sendMessage(userId, 'Активных подписок пока нет.');
      return;
    }

    const lines = overview.subscriptions.slice(0, 12).map((item, index) => {
      const status = item.isActive ? `активна, ${item.daysLeft} дн.` : 'неактивна';
      return `${index + 1}. ${item.typeLabel} (${item.consoleType || 'платформа не указана'}) - ${status}`;
    });

    await this.sendMessage(userId, ['Подписки:', ...lines].join('\n'));
  }

  private async sendOrders(userId: string, customerId: number) {
    const orders = await this.ordersService.myOrders(customerId);
    const items = Array.isArray((orders as any)?.items)
      ? ((orders as any).items as Array<any>)
      : [];

    if (!items.length) {
      await this.sendMessage(userId, 'История заказов пока пустая.');
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
      await this.sendMessage(userId, [header, ...chunk].join('\n'));
    }
  }

  private async sendCampaignSettings(userId: string, customerId: number) {
    const overview = await this.accountService.getOverview(customerId);
    const user = overview.user;

    await this.sendMessage(
      userId,
      [
        'Настройки рассылок',
        `Статусы заказов: ${user.notifyOrderStatus ? 'включено' : 'выключено'}`,
        `Подписки и продления: ${user.notifySubscription ? 'включено' : 'выключено'}`,
        `Сервисные сообщения: ${user.notifyService ? 'включено' : 'выключено'}`,
        `Рекламные рассылки: ${user.notifyMarketing ? 'включено' : 'выключено'}`,
      ].join('\n'),
    );
  }

  private async handleIncomingMessage(message: MaxIncomingMessage) {
    const maxId = String(message.userId || '').trim();
    if (!maxId) return;

    const customerId = await this.findCustomerByMaxId(maxId);

    if (!customerId) {
      await this.sendUnlinkedMessage(maxId);
      return;
    }

    const command = this.normalizeCommand(message.text);
    if (command === 'profile') {
      await this.sendProfile(maxId, customerId);
      return;
    }
    if (command === 'orders') {
      await this.sendOrders(maxId, customerId);
      return;
    }
    if (command === 'subscriptions') {
      await this.sendSubscriptions(maxId, customerId);
      return;
    }
    if (command === 'campaigns') {
      await this.sendCampaignSettings(maxId, customerId);
      return;
    }

    await this.sendMenu(maxId, customerId);
  }

  async handleWebhook(event: Record<string, unknown>, headerSecret?: string) {
    const expectedSecret = this.getWebhookSecret();
    if (expectedSecret) {
      const providedSecret = String(
        headerSecret || (event?.secret as string) || (event?.webhook_secret as string) || '',
      ).trim();
      if (!providedSecret || providedSecret !== expectedSecret) {
        throw new UnauthorizedException('Invalid MAX webhook secret');
      }
    }

    const message = this.extractIncomingMessage(event || {});
    if (message) {
      await this.handleIncomingMessage(message);
    }
    return 'ok';
  }
}
