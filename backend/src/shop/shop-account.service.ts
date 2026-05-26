import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  AccountType,
  CommunicationChannel,
  MarketingDeliveryStatus,
  Prisma,
  SubscriptionPeriod,
  SubscriptionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ShopCrmSyncService } from './shop-crm-sync.service';
import { EventsService } from '../events/events.service';

type UpdateProfileInput = {
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
};

type SaveCookieConsentInput = {
  analytics?: boolean;
  version?: string;
};

type ConsultationMessageInput = {
  text?: string | null;
};

type ParsedAttachment = {
  fileName: string;
  mimeType: string | null;
  size: number | null;
};

type ShopInstructionSection = {
  key: string;
  title: string;
  content: string;
  sortOrder: number;
};

type ShopInstructionItem = {
  id: number;
  consoleKey: string;
  consoleLabel: string;
  title: string;
  subtitle: string | null;
  searchAliases: string[];
  sections: ShopInstructionSection[];
};

type ShopAccessField = {
  label: string;
  value: string;
};

type ShopAccessGroup = {
  title: string;
  fields: ShopAccessField[];
};

@Injectable()
export class ShopAccountService {
  private readonly suspiciousProbePatterns = [
    /<script/i,
    /onerror\s*=/i,
    /constructor\.constructor/i,
    /\$where\s*:/i,
    /drop\s+table/i,
    /169\.254\.169\.254/i,
    /webhook\.site/i,
    /pentest/i,
    /floodtest/i,
    /\{\s*"\$gt"\s*:\s*""\s*\}/i,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmSync: ShopCrmSyncService,
    private readonly events: EventsService,
  ) {}

  private normalizeText(value?: string | null) {
    const text = String(value || '').trim();
    return text || null;
  }

  private normalizePhone(input: string) {
    return this.crmSync.normalizePhone(input);
  }

  private accessFields(items: Array<ShopAccessField | null | false | undefined>) {
    return items.filter(Boolean) as ShopAccessField[];
  }

  private donorAccessFields(
    donor?: {
      email?: string | null;
      password?: string | null;
      emailLogin?: string | null;
      emailPassword?: string | null;
      accountPassword?: string | null;
    } | null,
  ) {
    if (!donor) return [] as ShopAccessField[];
    return this.accessFields([
      donor.email ? { label: 'Логин донора', value: donor.email } : null,
      donor.password ? { label: 'Пароль донора', value: donor.password } : null,
      donor.emailLogin ? { label: 'Логин почты донора', value: donor.emailLogin } : null,
      donor.emailPassword ? { label: 'Пароль почты донора', value: donor.emailPassword } : null,
      donor.accountPassword
        ? { label: 'Пароль профиля донора', value: donor.accountPassword }
        : null,
    ]);
  }

  private clientAccessFields(
    source?: {
      emailLogin?: string | null;
      emailPassword?: string | null;
      accountPassword?: string | null;
    } | null,
    labels?: { login: string; password: string; accountPassword: string },
  ) {
    if (!source) return [] as ShopAccessField[];
    return this.accessFields([
      source.emailLogin ? { label: labels?.login || 'Логин', value: source.emailLogin } : null,
      source.emailPassword
        ? { label: labels?.password || 'Пароль почты', value: source.emailPassword }
        : null,
      source.accountPassword
        ? { label: labels?.accountPassword || 'Пароль профиля', value: source.accountPassword }
        : null,
    ]);
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

  private containsSuspiciousProbe(text?: string | null) {
    const source = String(text || '');
    if (!source) return false;
    return this.suspiciousProbePatterns.some(pattern => pattern.test(source));
  }

  private formatSubscriptionType(type: string) {
    const map: Record<string, string> = {
      PS_PLUS: 'PlayStation Plus (Premium)',
      GAME_PASS: 'Xbox Game Pass',
      EA_PLAY: 'EA Play',
    };
    return map[type] || type;
  }

  private formatSubscriptionPeriod(period: SubscriptionPeriod) {
    const map: Record<SubscriptionPeriod, string> = {
      MONTH: '1 месяц',
      THREE_MONTHS: '3 месяца',
      YEAR: '12 месяцев',
    };
    return map[period] || String(period);
  }

  private formatAccountType(type: AccountType) {
    const map: Record<AccountType, string> = {
      PERSONAL: 'Персональная',
      SHARING_DONOR: 'Sharing (Донор)',
      SHARING_CLIENT: 'Sharing (Клиент)',
    };
    return map[type] || String(type);
  }

  private resolveConsoleType(raw?: string | null) {
    const original = this.normalizeText(raw);
    if (!original) return null;
    const value = original.toUpperCase();
    if (value === 'PS4' || value === 'PS5') return value;
    if (value === 'XBOX_1' || value === 'XBOX_2') return value;
    return original;
  }

  private normalizeLookupToken(value: unknown) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeLookupCompact(value: unknown) {
    return this.normalizeLookupToken(value).replace(/\s+/g, '');
  }

  private mapConsoleTypeToInstructionKeys(raw?: string | null) {
    const source = this.normalizeLookupCompact(raw);
    if (!source) return [] as string[];

    const keys = new Set<string>();
    const add = (...items: string[]) => items.forEach(item => keys.add(item));

    if (source.includes('ps5') || source.includes('playstation5')) {
      add('ps5', 'playstation', 'playstation_5', 'ps');
    }
    if (source.includes('ps4') || source.includes('playstation4')) {
      add('ps4', 'playstation', 'playstation_4', 'ps');
    }
    if (source.includes('xbox1') || source.includes('xbox_1')) {
      add('xbox_1', 'xbox_game_pass_1', 'xbox', 'xbox_series');
    }
    if (source.includes('xbox2') || source.includes('xbox_2')) {
      add('xbox_2', 'xbox_game_pass_2', 'xbox', 'xbox_series');
    }
    if (source.includes('steamdeck')) {
      add('steam_deck', 'steamdeck', 'steam');
    }
    if (
      source.includes('xboxseriess') ||
      source.includes('xboxseriesx') ||
      source.includes('xboxone')
    ) {
      add('xbox', 'xbox_series', 'xbox_one');
    }
    if (source.includes('switch') || source.includes('nintendo')) {
      add('nintendo_switch', 'switch', 'nintendo');
    }

    return Array.from(keys);
  }

  private requiredExactInstructionKey(consoleKey?: string | null) {
    const key = this.normalizeLookupCompact(consoleKey);
    if (key === 'xboxgamepass1') return 'xbox1';
    if (key === 'xboxgamepass2') return 'xbox2';
    return null;
  }

  private mapTextToInstructionKeys(raw?: string | null) {
    const source = this.normalizeLookupCompact(raw);
    if (!source) return [] as string[];

    const keys = new Set<string>();
    const add = (...items: string[]) => items.forEach(item => keys.add(item));

    if (source.includes('steamdeck')) {
      add('steam_deck', 'steamdeck');
    }
    if (source.includes('playstation5') || source.includes('ps5')) {
      add('ps5', 'playstation_5', 'playstation');
    }
    if (source.includes('playstation4') || source.includes('ps4')) {
      add('ps4', 'playstation_4', 'playstation');
    }
    if (
      source.includes('xboxseriess') ||
      source.includes('xboxseriesx') ||
      source.includes('xboxone') ||
      source.includes('xbox')
    ) {
      add('xbox', 'xbox_series', 'xbox_one');
    }
    if (source.includes('nintendoswitch') || source.includes('switch')) {
      add('nintendo_switch', 'switch', 'nintendo');
    }

    return Array.from(keys);
  }

  private parseInstructionAliases(raw: unknown) {
    if (!Array.isArray(raw)) return [] as string[];
    return Array.from(new Set(raw.map(item => this.normalizeLookupToken(item)).filter(Boolean)));
  }

  private parseInstructionSections(raw: unknown) {
    if (!Array.isArray(raw)) return [] as ShopInstructionSection[];
    return raw
      .map((item, index) => {
        const row = (item || {}) as Record<string, unknown>;
        const title = this.normalizeText(String(row.title || ''));
        const content = this.normalizeText(String(row.content || ''));
        if (!title || !content) return null;
        const key = this.normalizeLookupCompact(row.key || title) || `section_${index + 1}`;
        const sortOrder =
          typeof row.sortOrder === 'number' && Number.isFinite(row.sortOrder)
            ? row.sortOrder
            : index;
        return {
          key,
          title,
          content,
          sortOrder,
        } as ShopInstructionSection;
      })
      .filter((item): item is ShopInstructionSection => Boolean(item))
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private isXboxGamePassInstructionKey(value?: string | null) {
    const key = this.normalizeLookupCompact(value);
    return key === 'xboxgamepass1' || key === 'xboxgamepass2';
  }

  private hasXboxSlotAccess(grantedKeys: Set<string>, slot: 1 | 2) {
    return grantedKeys.has(`xbox${slot}`) || grantedKeys.has(`xboxgamepass${slot}`);
  }

  private getXboxDnsInstructionSection(): ShopInstructionSection {
    return {
      key: 'dns',
      title: 'Настройка на Xbox',
      sortOrder: 0,
      content: [
        'Нажмите кнопку **Xbox** на геймпаде, чтобы открыть гид.',
        'Перейдите в **Профиль и система** > **Параметры** > **Общие** > **Параметры сети**.',
        'Выберите **Дополнительные параметры**, а затем **Параметры DNS**.',
        'Выберите **Вручную** и введите:',
        '**Основной сервер:** **111.88.96.50**',
        '**Дополнительный:** **111.88.96.51**',
        'Сохраните настройки и перезагрузите консоль.',
      ].join('\n'),
    };
  }

  private getXboxActivationInstructionSection(
    grantedKeys: Set<string>,
  ): ShopInstructionSection | null {
    const blocks: string[] = [];

    if (this.hasXboxSlotAccess(grantedKeys, 1)) {
      blocks.push(
        [
          '**Xbox #1**',
          '',
          '**Шаг 1. Добавьте аккаунт-донор из личного кабинета на консоль**',
          '',
          '1. Включите **Xbox** и перейдите в главное меню.',
          '2. Нажмите на геймпаде кнопку **Xbox**.',
          '3. Перейдите вправо до раздела **Профиль и система**.',
          '4. Выберите **Добавить или сменить**.',
          '5. Нажмите **Добавить новый**.',
          '6. Введите логин, который мы отправили.',
          '7. Затем введите пароль.',
          '',
          '**Шаг 2. Правильно пройдите окна после входа**',
          '',
          'После ввода логина и пароля могут появиться дополнительные окна. Выбирайте следующие варианты:',
          '',
          '- Если появится вопрос **Сделать эту консоль домашней консолью Xbox?** — нажмите **Возможно, позже**.',
          '- Если появится окно с предложением улучшить игровой опыт — выберите **Нет, спасибо**.',
          '- Если появится предложение дополнительных настроек — выберите **Спасибо, не надо** или аналогичный вариант отказа.',
          '',
          '**Важные правила**',
          '- Не делайте донор аккаунт **Домашней консолью Xbox**.',
          '- Это запрещено. При нарушении доступ может быть отключён без возврата.',
          '- Не удаляйте наш аккаунт с консоли до окончания срока подписки.',
          '- Не выходите из нашего аккаунта.',
          '- Не меняйте пароль, почту, аватар, настройки безопасности и другие данные аккаунта.',
          '- Не покупайте ничего с нашего аккаунта.',
          '- Не передавайте данные третьим лицам.',
          '- Для работы подписки нужен стабильный интернет.',
        ].join('\n'),
      );
    }

    if (this.hasXboxSlotAccess(grantedKeys, 2)) {
      blocks.push(
        [
          '**Xbox #2**',
          '',
          '**Шаг 1. Добавьте аккаунт-донор из личного кабинета на консоль**',
          '',
          '1. Включите **Xbox** и перейдите в главное меню.',
          '2. Нажмите на геймпаде кнопку **Xbox**.',
          '3. Перейдите вправо до раздела **Профиль и система**.',
          '4. Выберите **Добавить или сменить**.',
          '5. Нажмите **Добавить новый**.',
          '6. Введите логин, который мы отправили.',
          '7. Затем введите пароль.',
          '',
          '**Шаг 2. Правильно пройдите окна после входа**',
          '',
          'После ввода логина и пароля могут появиться дополнительные окна. Выбирайте следующие варианты:',
          '',
          '- Если появится вопрос **Сделать эту консоль домашней консолью Xbox?** — нажмите.',
          '- Если появится окно с предложением улучшить игровой опыт — выберите **Нет, спасибо**.',
          '- Если появится предложение дополнительных настроек — выберите **Спасибо, не надо** или аналогичный вариант отказа.',
          '',
          '**Шаг 3. Добавьте свой личный аккаунт из личного кабинета на консоль**',
          '',
          '1. После добавления нашего аккаунта нажмите кнопку **Xbox** на геймпаде.',
          '2. Перейдите в раздел **Профиль и система**.',
          '3. Выберите свой личный профиль.',
          '4. Не выходите из нашего аккаунта, просто переключитесь на свой.',
          '',
          '**Важные правила**',
          '- Не удаляйте наш аккаунт с консоли до окончания срока подписки.',
          '- Не выходите из нашего аккаунта.',
          '- Нужно просто переключиться на свой профиль и играть с него.',
          '- Не меняйте пароль, почту, аватар, настройки безопасности и другие данные аккаунта.',
          '- Не покупайте ничего с нашего аккаунта.',
          '- Не передавайте данные третьим лицам.',
          '- Для работы подписки нужен стабильный интернет.',
        ].join('\n'),
      );
    }

    if (!blocks.length) return null;

    return {
      key: 'activation_ultimate_game_pass',
      title: 'Активация Ultimate Game Pass',
      sortOrder: 1,
      content: blocks.join('\n\n'),
    };
  }

  private getXboxLaunchGamesInstructionSection(): ShopInstructionSection {
    return {
      key: 'launch_games',
      title: 'Как запускать игры',
      sortOrder: 2,
      content: [
        'После подключения:',
        '1. Откройте **Game Pass** или библиотеку игр.',
        '2. Выберите нужную игру.',
        '3. Установите её на консоль.',
        '4. Запускайте игру со своего личного профиля.',
      ].join('\n'),
    };
  }

  private getXboxInstructionSections(sections: ShopInstructionSection[], grantedKeys: Set<string>) {
    const nextSections = [
      this.getXboxDnsInstructionSection(),
      ...sections.filter(section => {
        const key = this.normalizeLookupCompact(section.key || section.title);
        return key !== 'dns' && key !== 'launchgames' && key !== 'activationultimategamepass';
      }),
    ];
    const activationSection = this.getXboxActivationInstructionSection(grantedKeys);
    if (activationSection) {
      nextSections.push(activationSection);
      nextSections.push(this.getXboxLaunchGamesInstructionSection());
    }
    return nextSections.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  private buildInstructionTerms(item: {
    consoleKey?: string | null;
    consoleLabel?: string | null;
    title?: string | null;
    searchAliases?: unknown;
  }) {
    const terms = new Set<string>();
    const add = (value: unknown) => {
      const normalized = this.normalizeLookupToken(value);
      if (normalized && normalized.length >= 2) {
        terms.add(normalized);
      }
      const compact = this.normalizeLookupCompact(value);
      if (compact && compact.length >= 2) {
        terms.add(compact);
      }
    };

    add(item.consoleKey);
    add(item.consoleLabel);
    add(item.title);
    for (const alias of this.parseInstructionAliases(item.searchAliases)) {
      add(alias);
    }

    return Array.from(terms);
  }

  private matchInstructionBySignals(
    terms: string[],
    signals: Set<string>,
    sourceText: string,
    sourceCompact: string,
  ) {
    return terms.some(term => {
      const plain = this.normalizeLookupToken(term);
      const compact = this.normalizeLookupCompact(term);
      return (
        (plain && (signals.has(plain) || sourceText.includes(plain))) ||
        (compact && sourceCompact.includes(compact))
      );
    });
  }

  private async resolveClientIds(input: {
    phone?: string | null;
    telegramId?: string | null;
    vkId?: string | null;
    maxId?: string | null;
  }) {
    const phoneAliases = this.buildPhoneAliases(input.phone);
    const telegramId = this.normalizeText(input.telegramId);
    const vkId = this.normalizeText(input.vkId);
    const maxId = this.normalizeText(input.maxId);

    const orConditions: Prisma.ClientWhereInput[] = [];

    if (phoneAliases.length) {
      orConditions.push({ phone: { in: phoneAliases } });
    }

    if (telegramId) {
      orConditions.push({ telegramId });
    }

    if (vkId) {
      orConditions.push({ vkId });
    }

    if (maxId) {
      orConditions.push({ maxId });
    }

    if (!orConditions.length) {
      return [] as number[];
    }

    const clients = await this.prisma.client.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        OR: orConditions,
      },
      select: { id: true },
      take: 50,
    });

    return Array.from(new Set(clients.map(client => client.id)));
  }

  private parseAttachmentMeta(raw: unknown) {
    if (!Array.isArray(raw)) return [] as ParsedAttachment[];

    return raw
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const fileName = String(item.fileName || '').trim();
        if (!fileName) return null;
        const size = Number(item.size || 0);
        return {
          fileName,
          mimeType: String(item.mimeType || '').trim() || null,
          size: Number.isFinite(size) && size > 0 ? size : null,
        } as ParsedAttachment;
      })
      .filter((item): item is ParsedAttachment => Boolean(item));
  }

  private parseConsultationText(rawComment?: string | null) {
    const raw = String(rawComment || '').trim();
    if (!raw) return '';

    if (raw.includes('[SHOP_CHAT]')) {
      const compact = raw.replace(/\r/g, '');
      const messageLine = compact
        .split('\n')
        .find(line => line.trim().toLowerCase().startsWith('сообщение:'));
      if (messageLine) {
        const parsed = messageLine.replace(/^сообщение:\s*/i, '').trim();
        return this.containsSuspiciousProbe(parsed) ? '' : parsed;
      }
      const parsed = compact.replace('[SHOP_CHAT]', '').trim();
      return this.containsSuspiciousProbe(parsed) ? '' : parsed;
    }

    if (raw.includes('[SHOP_LEAD]')) {
      const compact = raw.replace(/\r/g, '');
      const commentLine = compact
        .split('\n')
        .find(line => line.trim().toLowerCase().startsWith('комментарий:'));
      if (commentLine) {
        const parsed = commentLine.replace(/^комментарий:\s*/i, '').trim();
        return this.containsSuspiciousProbe(parsed) ? '' : parsed;
      }

      const productLine = compact
        .split('\n')
        .find(line => line.trim().toLowerCase().startsWith('товар:'));
      if (productLine) {
        const productText = productLine.replace(/^товар:\s*/i, '').trim();
        const parsed = productText ? `Заявка по товару: ${productText}` : 'Новая заявка с сайта';
        return this.containsSuspiciousProbe(parsed) ? '' : parsed;
      }

      const parsed = compact.replace('[SHOP_LEAD]', '').trim();
      return this.containsSuspiciousProbe(parsed) ? '' : parsed;
    }

    if (this.containsSuspiciousProbe(raw)) return '';
    return raw;
  }

  private normalizeConsultationText(input?: string | null) {
    const text = String(input || '')
      .replace(/\\r\\n|\\n|\\r/g, '\n')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
    if (!text) return '';
    if (this.containsSuspiciousProbe(text)) {
      throw new BadRequestException('Сообщение похоже на технический тест и было отклонено');
    }
    return text.slice(0, 2000);
  }

  private async ensureSystemEmployeeId() {
    const preferredLogin = process.env.SHOP_SYSTEM_LOGIN || 'shop.bot';
    const byLogin = await this.prisma.employee.findUnique({
      where: { login: preferredLogin },
      select: { id: true },
    });
    if (byLogin) return byLogin.id;

    const fallback = await this.prisma.employee.findFirst({
      where: { tenant: 'TECHNOPRIME' },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (fallback) {
      return fallback.id;
    }

    const created = await this.prisma.employee
      .create({
        data: {
          name: 'Shop Bot',
          login: preferredLogin,
          passwordHash: '!shop_system_login_disabled!',
          role: 'MANAGER',
          tenant: 'TECHNOPRIME',
        },
        select: { id: true },
      })
      .catch(async () => {
        const existing = await this.prisma.employee.findUnique({
          where: { login: preferredLogin },
          select: { id: true },
        });
        return existing;
      });

    if (created?.id) {
      return created.id;
    }

    const lastFallback = await this.prisma.employee.findFirst({
      where: { tenant: 'TECHNOPRIME' },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!lastFallback) {
      throw new BadRequestException('Не удалось определить сотрудника для обращения');
    }
    return lastFallback.id;
  }

  private async resolveConsultationClient(customerId: number) {
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

    if (!customer) {
      throw new UnauthorizedException('Session is invalid');
    }

    const phoneAliases = this.buildPhoneAliases(customer.phone);
    if (!phoneAliases.length) {
      throw new BadRequestException('Для консультации нужен подтвержденный номер телефона');
    }

    const existingClient = await this.prisma.client.findFirst({
      where: {
        tenant: 'TECHNOPRIME',
        phone: { in: phoneAliases },
      },
      select: { id: true },
      orderBy: { id: 'desc' },
    });

    if (existingClient) {
      return { customer, clientId: existingClient.id };
    }

    const synced = await this.crmSync.upsertClientByPhone({
      phone: phoneAliases[0],
      name: this.crmSync.formatDisplayName(customer.firstName, customer.lastName, phoneAliases[0]),
      telegramId: customer.telegramId || null,
      telegramUsername: customer.telegramUsername || null,
      vkId: customer.vkId || null,
      maxId: customer.maxId || null,
      marketingConsent: customer.marketingConsent,
    });

    if (!synced?.id) {
      throw new BadRequestException('Не удалось создать карточку клиента для консультации');
    }

    return { customer, clientId: synced.id };
  }

  async getConsultationHistory(customerId: number) {
    const { clientId } = await this.resolveConsultationClient(customerId);

    const [legacyLeadTasks, leadOrders, directLogs] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          clientId,
          comment: { contains: '[SHOP_LEAD]' },
        },
        orderBy: { createdAt: 'asc' },
        take: 60,
        select: {
          id: true,
          title: true,
          comment: true,
          createdAt: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.order.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          clientId,
          comment: { contains: '[SHOP_LEAD]' },
        },
        orderBy: { date: 'asc' },
        take: 60,
        select: {
          id: true,
          comment: true,
          date: true,
          manager: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.clientCommunicationLog.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          clientId,
        },
        orderBy: { sentAt: 'asc' },
        take: 200,
        select: {
          id: true,
          channel: true,
          status: true,
          text: true,
          attachments: true,
          errorMessage: true,
          readByCustomerAt: true,
          createdById: true,
          sentAt: true,
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const unreadManagerIds = directLogs
      .filter(
        item =>
          (item.channel !== CommunicationChannel.WEBSITE || Boolean(item.createdById)) &&
          item.status === MarketingDeliveryStatus.SENT &&
          !item.readByCustomerAt,
      )
      .map(item => item.id);

    if (unreadManagerIds.length) {
      await this.prisma.clientCommunicationLog.updateMany({
        where: {
          id: { in: unreadManagerIds },
        },
        data: {
          readByCustomerAt: new Date(),
        },
      });
    }

    type HistoryItem = {
      id: string;
      direction: 'CUSTOMER' | 'MANAGER' | 'SYSTEM';
      source: 'CHAT' | 'LEAD' | 'CRM' | 'SYSTEM';
      title: string | null;
      text: string;
      sentAt: Date;
      channel: CommunicationChannel;
      status: MarketingDeliveryStatus;
      errorMessage: string | null;
      createdBy: { id: number; name: string } | null;
      attachments: ParsedAttachment[];
    };

    const logItems: HistoryItem[] = directLogs
      .flatMap(item => {
        const cleanText = String(item.text || '').trim();
        if (this.containsSuspiciousProbe(cleanText)) return [];
        const isCustomerWebsiteMessage =
          item.channel === CommunicationChannel.WEBSITE && !item.createdById;
        return [
          {
            id: `log-${item.id}`,
            direction: isCustomerWebsiteMessage ? ('CUSTOMER' as const) : ('MANAGER' as const),
            source: isCustomerWebsiteMessage ? ('CHAT' as const) : ('CRM' as const),
            title: null,
            text: cleanText,
            sentAt: item.sentAt,
            channel: item.channel,
            status: item.status,
            errorMessage: item.errorMessage || null,
            createdBy: item.createdBy || null,
            attachments: this.parseAttachmentMeta(item.attachments),
          },
        ];
      })
      .filter(item => Boolean(item.text) || Boolean(item.attachments.length));

    const legacyLeadItems: HistoryItem[] = [...legacyLeadTasks, ...leadOrders]
      .map(item => ({
        id: `lead-${item.id}`,
        direction: 'CUSTOMER' as const,
        source: 'LEAD' as const,
        title: 'title' in item ? item.title : `Заявка с сайта #${item.id}`,
        text: this.parseConsultationText(item.comment),
        sentAt: 'createdAt' in item ? item.createdAt : item.date,
        channel: CommunicationChannel.WEBSITE,
        status: MarketingDeliveryStatus.SENT,
        errorMessage: null,
        createdBy: 'assignedTo' in item ? item.assignedTo || null : item.manager || null,
        attachments: [] as ParsedAttachment[],
      }))
      .filter(item => Boolean(item.text));

    const items: HistoryItem[] = [...legacyLeadItems, ...logItems]
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime())
      .slice(-160);

    const lastCustomerMessage = [...items].reverse().find(item => item.direction === 'CUSTOMER');
    const lastManagerMessage = [...items].reverse().find(item => item.direction === 'MANAGER');
    const queueState =
      lastCustomerMessage &&
      (!lastManagerMessage ||
        new Date(lastCustomerMessage.sentAt).getTime() >
          new Date(lastManagerMessage.sentAt).getTime())
        ? ('WAITING_MANAGER' as const)
        : ('WAITING_CUSTOMER' as const);

    return {
      items,
      conversation: {
        status: 'OPEN' as const,
        queueState,
        slaMinutes: 10,
      },
    };
  }

  async sendConsultationMessage(customerId: number, input: ConsultationMessageInput) {
    const text = this.normalizeConsultationText(input.text);
    if (!text) {
      throw new BadRequestException('Введите текст сообщения');
    }

    const { clientId } = await this.resolveConsultationClient(customerId);
    const assignedToId = await this.ensureSystemEmployeeId();

    const createdLog = await this.prisma.clientCommunicationLog
      .create({
        data: {
          tenant: 'TECHNOPRIME',
          clientId,
          channel: CommunicationChannel.WEBSITE,
          status: MarketingDeliveryStatus.SENT,
          text,
          attachments: Prisma.JsonNull,
          errorMessage: null,
          readByCustomerAt: new Date(),
          createdById: null,
        },
        select: {
          id: true,
          sentAt: true,
          text: true,
        },
      })
      .catch(() => undefined);

    if (createdLog?.id) {
      this.events.broadcast('WEBSITE_CHAT_UPDATED', {
        tenant: 'TECHNOPRIME',
        clientId,
        messageId: createdLog.id,
        text: String(createdLog.text || text).trim(),
        sentAt: createdLog.sentAt.toISOString(),
        author: 'CLIENT',
      });
    }

    await this.prisma.notification
      .create({
        data: {
          userId: assignedToId,
          type: 'SHOP_CONSULTATION_MESSAGE',
          payload: {
            clientId,
            text,
            source: 'WEBSITE',
          } as any,
        },
      })
      .catch(() => undefined);

    return {
      success: true,
      message: 'Сообщение отправлено. Обычно отвечаем в течение 10 минут.',
    };
  }

  async getOverview(customerId: number) {
    const customer = await this.prisma.shopCustomer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        phone: true,
        telegramId: true,
        vkId: true,
        maxId: true,
        telegramUsername: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        deliveryCity: true,
        deliveryAddress: true,
        notifyOrderStatus: true,
        notifySubscription: true,
        notifyService: true,
        notifyMarketing: true,
        marketingConsent: true,
        cookieConsentAt: true,
        cookieConsentVersion: true,
        cookieConsentAnalytics: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!customer) {
      throw new UnauthorizedException('Session is invalid');
    }

    const clientIds = await this.resolveClientIds({
      phone: customer.phone,
      telegramId: customer.telegramId,
      vkId: customer.vkId,
      maxId: customer.maxId,
    });

    const orderWhere = {
      tenant: 'TECHNOPRIME' as const,
      OR: [
        { shopCustomerId: customer.id },
        ...(clientIds.length ? [{ clientId: { in: clientIds } }] : []),
      ],
    };

    const [storeOrdersCount, subscriptions] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      clientIds.length
        ? this.prisma.subscription.findMany({
            where: {
              tenant: 'TECHNOPRIME',
              clientId: { in: clientIds },
            },
            include: {
              client: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  consoleType: true,
                  emailLogin: true,
                  emailPassword: true,
                  accountPassword: true,
                },
              },
              clientSlot: {
                select: {
                  consoleType: true,
                  emailLogin: true,
                  emailPassword: true,
                  accountPassword: true,
                  startDate: true,
                  endDate: true,
                  sharingSystem: {
                    select: {
                      donor: {
                        select: {
                          email: true,
                          password: true,
                          emailLogin: true,
                          emailPassword: true,
                          accountPassword: true,
                          consoleType: true,
                          subscriptionPeriod: true,
                          endDate: true,
                        },
                      },
                    },
                  },
                },
              },
              donorAccount: {
                select: {
                  email: true,
                  password: true,
                  emailLogin: true,
                  emailPassword: true,
                  accountPassword: true,
                  consoleType: true,
                  subscriptionPeriod: true,
                  endDate: true,
                },
              },
            },
            orderBy: { endDate: 'desc' },
            take: 100,
          })
        : Promise.resolve([]),
    ]);

    const now = Date.now();
    const mappedSubscriptions = subscriptions
      .map(sub => {
        const consoleType =
          this.resolveConsoleType(sub.clientSlot?.consoleType || null) ||
          this.resolveConsoleType(sub.donorAccount?.consoleType || null) ||
          this.resolveConsoleType(sub.clientSlot?.sharingSystem?.donor?.consoleType || null) ||
          this.resolveConsoleType(sub.client?.consoleType || null);
        const isXboxDonorSlot = consoleType === 'XBOX_1';
        const isXboxPersonalSlot = consoleType === 'XBOX_2';
        const isXboxSharingSlot = isXboxDonorSlot || isXboxPersonalSlot;
        const donorAccount = sub.donorAccount || sub.clientSlot?.sharingSystem?.donor || null;
        const donorFields = this.donorAccessFields(donorAccount);
        const personalSlotFields = this.clientAccessFields(sub.clientSlot, {
          login: isXboxPersonalSlot ? 'Логин личного аккаунта' : 'Логин',
          password: isXboxPersonalSlot ? 'Пароль личного аккаунта' : 'Пароль почты',
          accountPassword: isXboxPersonalSlot
            ? 'Пароль профиля личного аккаунта'
            : 'Пароль профиля',
        });
        const accessGroups: ShopAccessGroup[] = [];

        const visibleAccountData =
          sub.accountType === AccountType.PERSONAL
            ? {
                emailLogin: sub.client?.emailLogin || null,
                emailPassword: sub.client?.emailPassword || null,
                accountPassword: sub.client?.accountPassword || null,
              }
            : sub.accountType === AccountType.SHARING_CLIENT
              ? isXboxDonorSlot
                ? {
                    emailLogin: donorAccount?.email || null,
                    emailPassword: donorAccount?.password || null,
                    accountPassword: donorAccount?.accountPassword || null,
                  }
                : {
                    emailLogin: sub.clientSlot?.emailLogin || null,
                    emailPassword: sub.clientSlot?.emailPassword || null,
                    accountPassword: sub.clientSlot?.accountPassword || null,
                  }
              : {
                  emailLogin: null,
                  emailPassword: null,
                  accountPassword: null,
                };

        if (
          (sub.accountType === AccountType.SHARING_CLIENT ||
            sub.accountType === AccountType.SHARING_DONOR) &&
          isXboxSharingSlot &&
          donorFields.length
        ) {
          accessGroups.push({ title: 'Данные донора для входа', fields: donorFields });
        }
        if (sub.accountType === AccountType.SHARING_CLIENT && isXboxSharingSlot) {
          if (personalSlotFields.length) {
            accessGroups.push({ title: 'Личный аккаунт для игры', fields: personalSlotFields });
          }
        }

        let effectiveStartDate = sub.startDate;
        let effectiveEndDate = sub.endDate;
        let effectiveSubscriptionPeriod = sub.subscriptionPeriod;
        if (sub.accountType === AccountType.SHARING_CLIENT) {
          if (
            sub.clientSlot?.startDate &&
            sub.clientSlot.startDate.getTime() < effectiveStartDate.getTime()
          ) {
            effectiveStartDate = sub.clientSlot.startDate;
          }
          if (
            sub.clientSlot?.endDate &&
            sub.clientSlot.endDate.getTime() > effectiveEndDate.getTime()
          ) {
            effectiveEndDate = sub.clientSlot.endDate;
          }

          const donorEndDate = donorAccount?.endDate || null;
          const donorPeriod = donorAccount?.subscriptionPeriod || null;
          const dayMs = 24 * 60 * 60 * 1000;
          const subDurationDays = Math.max(
            0,
            Math.ceil((sub.endDate.getTime() - sub.startDate.getTime()) / dayMs),
          );
          const donorAheadDays = donorEndDate
            ? Math.ceil((donorEndDate.getTime() - sub.endDate.getTime()) / dayMs)
            : 0;
          const looksLikeLegacyMonthMismatch =
            donorPeriod === SubscriptionPeriod.YEAR &&
            sub.subscriptionPeriod === SubscriptionPeriod.MONTH &&
            subDurationDays <= 40 &&
            donorAheadDays >= 120;

          if (
            looksLikeLegacyMonthMismatch &&
            donorEndDate &&
            donorEndDate.getTime() > effectiveEndDate.getTime()
          ) {
            effectiveEndDate = donorEndDate;
            effectiveSubscriptionPeriod = donorPeriod;
          }
        }

        const diffDays = Math.ceil((effectiveEndDate.getTime() - now) / (24 * 60 * 60 * 1000));
        const daysLeft = Math.max(0, diffDays);
        const isActive =
          sub.status === SubscriptionStatus.ACTIVE && effectiveEndDate.getTime() > now;
        const canRenew = !isActive || daysLeft <= 7;

        return {
          id: sub.id,
          type: sub.type,
          typeLabel: this.formatSubscriptionType(sub.type),
          status: sub.status,
          accountType: sub.accountType,
          accountTypeLabel: this.formatAccountType(sub.accountType),
          subscriptionPeriod: effectiveSubscriptionPeriod,
          subscriptionPeriodLabel: this.formatSubscriptionPeriod(effectiveSubscriptionPeriod),
          consoleType,
          startDate: effectiveStartDate,
          endDate: effectiveEndDate,
          emailLogin: visibleAccountData.emailLogin,
          emailPassword: visibleAccountData.emailPassword,
          accountPassword: visibleAccountData.accountPassword,
          accessGroups,
          daysLeft,
          isActive,
          canRenew,
        };
      })
      .sort((left, right) => {
        if (Number(left.isActive) !== Number(right.isActive)) {
          return Number(right.isActive) - Number(left.isActive);
        }
        return new Date(right.endDate).getTime() - new Date(left.endDate).getTime();
      });

    const activeSubscriptions = mappedSubscriptions.filter(sub => sub.isActive);

    return {
      user: customer,
      linkedAccounts: {
        telegram: {
          connected: Boolean(customer.telegramId),
          username: customer.telegramUsername,
        },
        vk: {
          connected: Boolean(customer.vkId),
          id: customer.vkId,
        },
        max: {
          connected: Boolean(customer.maxId),
          comingSoon: !customer.maxId,
        },
      },
      stats: {
        storeOrdersCount,
        subscriptionsCount: mappedSubscriptions.length,
        activeSubscriptionsCount: activeSubscriptions.length,
        nextSubscriptionExpireAt:
          activeSubscriptions
            .map(sub => sub.endDate)
            .sort((a, b) => a.getTime() - b.getTime())[0] || null,
      },
      subscriptions: mappedSubscriptions,
    };
  }

  async getAccessibleInstructions(customerId: number) {
    const customer = await this.prisma.shopCustomer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        phone: true,
        telegramId: true,
        vkId: true,
        maxId: true,
      },
    });

    if (!customer) {
      throw new UnauthorizedException('Session is invalid');
    }

    const clientIds = await this.resolveClientIds({
      phone: customer.phone,
      telegramId: customer.telegramId,
      vkId: customer.vkId,
      maxId: customer.maxId,
    });

    const orderWhere = {
      tenant: 'TECHNOPRIME' as const,
      OR: [
        { shopCustomerId: customer.id },
        ...(clientIds.length ? [{ clientId: { in: clientIds } }] : []),
      ],
    };

    const [instructions, subscriptions, orders] = await Promise.all([
      this.prisma.consoleInstruction.findMany({
        where: {
          tenant: 'TECHNOPRIME',
          isPublished: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
        select: {
          id: true,
          consoleKey: true,
          consoleLabel: true,
          title: true,
          subtitle: true,
          searchAliases: true,
          sections: true,
        },
      }),
      clientIds.length
        ? this.prisma.subscription.findMany({
            where: {
              tenant: 'TECHNOPRIME',
              clientId: { in: clientIds },
            },
            select: {
              client: { select: { consoleType: true } },
              clientSlot: { select: { consoleType: true } },
              donorAccount: { select: { consoleType: true } },
            },
            orderBy: { id: 'desc' },
            take: 200,
          })
        : Promise.resolve([]),
      this.prisma.order.findMany({
        where: orderWhere,
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  brand: true,
                  model: true,
                  version: true,
                  category: true,
                  storefrontCategory: true,
                  catalogMainKey: true,
                  catalogSubKey: true,
                  catalogFamilyKey: true,
                },
              },
            },
          },
        },
        orderBy: { id: 'desc' },
        take: 250,
      }),
    ]);

    const grantedKeys = new Set<string>();
    const addGrantedKey = (value: unknown) => {
      const plain = this.normalizeLookupToken(value);
      if (plain) grantedKeys.add(plain);
      const compact = this.normalizeLookupCompact(value);
      if (compact) grantedKeys.add(compact);
    };

    for (const sub of subscriptions) {
      const effectiveConsoleType =
        sub.clientSlot?.consoleType || sub.client?.consoleType || sub.donorAccount?.consoleType;
      for (const mappedKey of this.mapConsoleTypeToInstructionKeys(effectiveConsoleType)) {
        addGrantedKey(mappedKey);
      }
    }

    for (const order of orders) {
      for (const item of order.items) {
        const textCandidates = [
          item.variantLabel,
          item.product?.name,
          item.product?.brand,
          item.product?.model,
          item.product?.version,
          item.product?.category,
          item.product?.storefrontCategory,
          item.product?.catalogMainKey,
          item.product?.catalogSubKey,
          item.product?.catalogFamilyKey,
        ];
        for (const candidate of textCandidates) {
          for (const mappedKey of this.mapTextToInstructionKeys(String(candidate || ''))) {
            addGrantedKey(mappedKey);
          }
        }
      }
    }

    const hasGrantedAccess = grantedKeys.size > 0;

    const accessible = instructions
      .map(row => {
        if (!hasGrantedAccess) return null;
        if (this.isXboxGamePassInstructionKey(row.consoleKey)) return null;

        const instructionTerms = this.buildInstructionTerms({
          consoleKey: row.consoleKey,
          consoleLabel: row.consoleLabel,
          title: row.title,
          searchAliases: row.searchAliases,
        });
        const requiredExactKey = this.requiredExactInstructionKey(row.consoleKey);
        if (requiredExactKey && !grantedKeys.has(requiredExactKey)) {
          return null;
        }
        const mappedTerms = new Set<string>();
        for (const term of instructionTerms) {
          const normalized = this.normalizeLookupToken(term);
          if (normalized) mappedTerms.add(normalized);
          const compact = this.normalizeLookupCompact(term);
          if (compact) mappedTerms.add(compact);
          for (const mappedKey of this.mapTextToInstructionKeys(term)) {
            const mappedNormalized = this.normalizeLookupToken(mappedKey);
            const mappedCompact = this.normalizeLookupCompact(mappedKey);
            if (mappedNormalized) mappedTerms.add(mappedNormalized);
            if (mappedCompact) mappedTerms.add(mappedCompact);
          }
        }

        const matched = Array.from(mappedTerms).some(term => grantedKeys.has(term));
        if (!matched) {
          return null;
        }

        const isXboxInstruction = this.normalizeLookupCompact(row.consoleKey) === 'xbox';
        const sections = isXboxInstruction
          ? this.getXboxInstructionSections(
              this.parseInstructionSections(row.sections),
              grantedKeys,
            )
          : this.parseInstructionSections(row.sections);
        if (!sections.length) return null;

        return {
          id: row.id,
          consoleKey: row.consoleKey,
          consoleLabel: row.consoleLabel,
          title: row.title,
          subtitle: row.subtitle || null,
          searchAliases: this.parseInstructionAliases(row.searchAliases),
          sections,
        } as ShopInstructionItem;
      })
      .filter((item): item is ShopInstructionItem => Boolean(item));

    return {
      items: accessible,
      total: accessible.length,
    };
  }

  async updateProfile(customerId: number, input: UpdateProfileInput) {
    const existing = await this.prisma.shopCustomer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        phone: true,
        telegramId: true,
        telegramUsername: true,
        vkId: true,
        maxId: true,
        marketingConsent: true,
      },
    });

    if (!existing) {
      throw new UnauthorizedException('Session is invalid');
    }

    let nextBirthDate: Date | null | undefined = undefined;
    if (input.birthDate !== undefined) {
      const normalizedBirthDate = this.normalizeText(input.birthDate);
      if (!normalizedBirthDate) {
        nextBirthDate = null;
      } else {
        const parsed = new Date(normalizedBirthDate);
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('Некорректная дата рождения');
        }
        nextBirthDate = parsed;
      }
    }

    const updated = await this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: {
        firstName: input.firstName !== undefined ? this.normalizeText(input.firstName) : undefined,
        lastName: input.lastName !== undefined ? this.normalizeText(input.lastName) : undefined,
        birthDate: nextBirthDate,
        deliveryCity:
          input.deliveryCity !== undefined ? this.normalizeText(input.deliveryCity) : undefined,
        deliveryAddress:
          input.deliveryAddress !== undefined
            ? this.normalizeText(input.deliveryAddress)
            : undefined,
        notifyOrderStatus:
          input.notifyOrderStatus !== undefined ? Boolean(input.notifyOrderStatus) : undefined,
        notifySubscription:
          input.notifySubscription !== undefined ? Boolean(input.notifySubscription) : undefined,
        notifyService: input.notifyService !== undefined ? Boolean(input.notifyService) : undefined,
        notifyMarketing:
          input.notifyMarketing !== undefined ? Boolean(input.notifyMarketing) : undefined,
        marketingConsent:
          input.marketingConsent !== undefined
            ? Boolean(input.marketingConsent)
            : input.notifyMarketing !== undefined
              ? Boolean(input.notifyMarketing)
              : undefined,
      },
      select: {
        id: true,
        phone: true,
        telegramId: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        deliveryCity: true,
        deliveryAddress: true,
        notifyOrderStatus: true,
        notifySubscription: true,
        notifyService: true,
        notifyMarketing: true,
        marketingConsent: true,
      },
    });

    if (updated.phone) {
      await this.crmSync
        .upsertClientByPhone({
          phone: updated.phone,
          name: this.crmSync.formatDisplayName(updated.firstName, updated.lastName, updated.phone),
          city: updated.deliveryCity,
          address: updated.deliveryAddress,
          telegramId: updated.telegramId || existing.telegramId || null,
          telegramUsername: existing.telegramUsername,
          vkId: existing.vkId || null,
          maxId: existing.maxId || null,
          marketingConsent: updated.marketingConsent,
        })
        .catch(() => undefined);
    }

    return { success: true, user: updated };
  }

  async unlinkTelegram(customerId: number) {
    const updated = await this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: {
        telegramId: null,
        telegramUsername: null,
      },
      select: {
        id: true,
        phone: true,
        telegramId: true,
        telegramUsername: true,
        vkId: true,
        maxId: true,
        firstName: true,
        lastName: true,
        marketingConsent: true,
      },
    });

    if (updated.phone) {
      await this.crmSync
        .upsertClientByPhone({
          phone: updated.phone,
          name: this.crmSync.formatDisplayName(updated.firstName, updated.lastName, updated.phone),
          telegramId: null,
          telegramUsername: null,
          vkId: updated.vkId || null,
          maxId: updated.maxId || null,
          marketingConsent: updated.marketingConsent,
        })
        .catch(() => undefined);
    }

    return { success: true, user: updated };
  }

  async unlinkVk(customerId: number) {
    const updated = await this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: {
        vkId: null,
      },
      select: {
        id: true,
        phone: true,
        telegramId: true,
        telegramUsername: true,
        vkId: true,
        maxId: true,
        firstName: true,
        lastName: true,
        marketingConsent: true,
      },
    });

    if (updated.phone) {
      await this.crmSync
        .upsertClientByPhone({
          phone: updated.phone,
          name: this.crmSync.formatDisplayName(updated.firstName, updated.lastName, updated.phone),
          telegramId: updated.telegramId || null,
          telegramUsername: updated.telegramUsername || null,
          vkId: null,
          maxId: updated.maxId || null,
          marketingConsent: updated.marketingConsent,
        })
        .catch(() => undefined);
    }

    return { success: true, user: updated };
  }

  async unlinkMax(customerId: number) {
    const updated = await this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: {
        maxId: null,
      },
      select: {
        id: true,
        phone: true,
        telegramId: true,
        telegramUsername: true,
        vkId: true,
        maxId: true,
        firstName: true,
        lastName: true,
        marketingConsent: true,
      },
    });

    if (updated.phone) {
      await this.crmSync
        .upsertClientByPhone({
          phone: updated.phone,
          name: this.crmSync.formatDisplayName(updated.firstName, updated.lastName, updated.phone),
          telegramId: updated.telegramId || null,
          telegramUsername: updated.telegramUsername || null,
          vkId: updated.vkId || null,
          maxId: null,
          marketingConsent: updated.marketingConsent,
        })
        .catch(() => undefined);
    }

    return { success: true, user: updated };
  }

  async saveCookieConsent(customerId: number | undefined, input: SaveCookieConsentInput) {
    const analytics = Boolean(input.analytics);
    const version = this.normalizeText(input.version) || '2026-02';

    if (!customerId) {
      return {
        success: true,
        persisted: false,
        consent: {
          analytics,
          version,
        },
      };
    }

    await this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: {
        cookieConsentAt: new Date(),
        cookieConsentVersion: version,
        cookieConsentAnalytics: analytics,
      },
    });

    return {
      success: true,
      persisted: true,
      consent: {
        analytics,
        version,
      },
    };
  }
}
