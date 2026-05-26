import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CommunicationChannel,
  MarketingDeliveryStatus,
  OrderStatus,
  Prisma,
  TaskStatus,
  Tenant,
} from '@prisma/client';
import {
  CommunicationAttachment,
  CommunicationService,
} from '../communication/communication.service';
import { EventsService } from '../events/events.service';

type UploadFile = {
  originalname?: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

@Injectable()
export class ClientsService {
  private readonly websiteConversationsCacheTtlMs = 12_000;
  private readonly contactHistoryCacheTtlMs = 8_000;
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
    /admin\s+override\s+test/i,
    /test\s+with\s+attachments/i,
    /старая\s+памятка\s+technoprime/i,
    /boot\s+from\s+file/i,
    /steamcl\.efi/i,
  ];
  private readonly suspiciousProbeNeedles = [
    '<script',
    'onerror=',
    'constructor.constructor',
    '$where',
    'drop table',
    '169.254.169.254',
    'webhook.site',
    'pentest',
    'floodtest',
    '"$gt"',
    'admin override test',
    'test with attachments',
    'старая памятка technoprime',
    'boot from file',
    'steamcl.efi',
  ];
  private readonly websiteConversationsCache = new Map<
    string,
    { expiresAt: number; value?: { items: any[] }; promise?: Promise<{ items: any[] }> }
  >();
  private readonly contactHistoryCache = new Map<
    string,
    {
      expiresAt: number;
      value?: {
        items: any[];
        pagination: {
          offset: number;
          limit: number;
          total: number;
          hasMore: boolean;
          nextOffset: number | null;
        };
      };
      promise?: Promise<{
        items: any[];
        pagination: {
          offset: number;
          limit: number;
          total: number;
          hasMore: boolean;
          nextOffset: number | null;
        };
      }>;
    }
  >();

  constructor(
    private prisma: PrismaService,
    private readonly communication: CommunicationService,
    private readonly events: EventsService,
  ) {}

  private containsSuspiciousProbe(text?: string | null) {
    const source = String(text || '');
    if (!source) return false;
    return this.suspiciousProbePatterns.some(pattern => pattern.test(source));
  }

  private normalizeMessageText(text?: string | null, limit = 2000) {
    const normalized = String(text || '')
      .replace(/\\r\\n|\\n|\\r/g, '\n')
      .replace(/\r\n?/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
    if (!normalized) return '';
    return normalized.slice(0, limit);
  }

  private websiteConversationCacheKey(tenant: Tenant) {
    return tenant;
  }

  private contactHistoryCachePrefix(
    tenant: Tenant,
    clientId: number,
    channel?: 'TELEGRAM' | 'VK' | 'WEBSITE',
  ) {
    return `${tenant}:${clientId}:${channel || 'all'}:`;
  }

  private contactHistoryCacheKey(
    tenant: Tenant,
    clientId: number,
    channel?: 'TELEGRAM' | 'VK' | 'WEBSITE',
    limit = 100,
    offset = 0,
  ) {
    return `${this.contactHistoryCachePrefix(tenant, clientId, channel)}${limit}:${offset}`;
  }

  private invalidateWebsiteConversationsCache(tenant: Tenant) {
    this.websiteConversationsCache.delete(this.websiteConversationCacheKey(tenant));
  }

  private invalidateContactHistoryCache(
    tenant: Tenant,
    clientId: number,
    channel?: 'TELEGRAM' | 'VK' | 'WEBSITE',
  ) {
    const prefixes = channel
      ? [
          this.contactHistoryCachePrefix(tenant, clientId, channel),
          this.contactHistoryCachePrefix(tenant, clientId),
        ]
      : [this.contactHistoryCachePrefix(tenant, clientId)];

    for (const key of this.contactHistoryCache.keys()) {
      if (prefixes.some(prefix => key.startsWith(prefix))) {
        this.contactHistoryCache.delete(key);
      }
    }
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
    const variants = new Set<string>([
      normalized,
      `+${normalized}`,
      normalized.slice(-10),
      `+7${normalized.slice(-10)}`,
      `7${normalized.slice(-10)}`,
    ]);
    return Array.from(variants);
  }

  private async resolveShopContactsByPhone(phones: Array<string | null | undefined>) {
    const variants = Array.from(
      new Set(phones.flatMap(phone => this.buildPhoneVariants(phone)).filter(Boolean)),
    );

    if (!variants.length) {
      return new Map<
        string,
        { telegramId: string | null; vkId: string | null; maxId: string | null }
      >();
    }

    const rows = await this.prisma.shopCustomer.findMany({
      where: {
        phone: { in: variants },
        OR: [{ telegramId: { not: null } }, { vkId: { not: null } }, { maxId: { not: null } }],
      },
      select: {
        phone: true,
        telegramId: true,
        vkId: true,
        maxId: true,
      },
      take: 2000,
    });

    const map = new Map<
      string,
      { telegramId: string | null; vkId: string | null; maxId: string | null }
    >();

    for (const row of rows) {
      const key = this.normalizePhone(row.phone);
      if (!key) continue;
      const prev = map.get(key);
      map.set(key, {
        telegramId: row.telegramId || prev?.telegramId || null,
        vkId: row.vkId || prev?.vkId || null,
        maxId: row.maxId || prev?.maxId || null,
      });
    }

    return map;
  }

  private mergeClientWithShopChannels<
    T extends {
      phone?: string | null;
      telegramId?: string | null;
      vkId?: string | null;
      maxId?: string | null;
    },
  >(
    client: T,
    channelsByPhone: Map<
      string,
      { telegramId: string | null; vkId: string | null; maxId: string | null }
    >,
  ): T {
    const key = this.normalizePhone(client.phone);
    const fallback = key ? channelsByPhone.get(key) : undefined;
    if (!fallback) return client;

    return {
      ...client,
      telegramId: client.telegramId || fallback.telegramId || null,
      vkId: client.vkId || fallback.vkId || null,
      maxId: client.maxId || fallback.maxId || null,
    };
  }

  private async buildCompletedByMap(orderIds: number[]) {
    const uniqueIds = Array.from(new Set(orderIds.filter(id => Number.isFinite(id) && id > 0)));
    if (!uniqueIds.length) {
      return new Map<number, { id: number; name: string; login?: string | null }>();
    }

    const logs = await this.prisma.auditLog.findMany({
      where: {
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'ORDER',
        entityId: { in: uniqueIds },
      },
      orderBy: [{ entityId: 'asc' }, { createdAt: 'desc' }],
      select: {
        entityId: true,
        userId: true,
        newData: true,
        user: {
          select: {
            id: true,
            name: true,
            login: true,
          },
        },
      },
    });

    const map = new Map<number, { id: number; name: string; login?: string | null }>();

    for (const log of logs) {
      if (!log.entityId || !log.userId || map.has(log.entityId)) continue;
      const nextStatus = String((log.newData as any)?.status || '').toUpperCase();
      if (nextStatus !== 'COMPLETED') continue;

      map.set(log.entityId, {
        id: log.user?.id || log.userId,
        name: log.user?.name || log.user?.login || 'Сотрудник',
        login: log.user?.login || null,
      });
    }

    return map;
  }

  private async attachCompletedByToClients<T extends { orders?: any[] }>(clients: T[]) {
    const orderIds = clients.flatMap(client =>
      Array.isArray(client.orders) ? client.orders.map(order => Number(order.id || 0)) : [],
    );
    const completedByMap = await this.buildCompletedByMap(orderIds);

    return clients.map(client => ({
      ...client,
      orders: Array.isArray(client.orders)
        ? client.orders.map((order: any) => ({
            ...order,
            completedBy: completedByMap.get(order.id) || null,
          }))
        : client.orders,
    }));
  }

  private resolveTenant(tenant?: Tenant | null): Tenant {
    return Tenant.TECHNOPRIME;
  }

  private normalizeContactAttachments(files: UploadFile[] = []): CommunicationAttachment[] {
    return files
      .filter(file => file && file.buffer?.byteLength)
      .slice(0, 6)
      .map(file => ({
        fileName: file.originalname || file.filename || 'file',
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        buffer: file.buffer,
      }));
  }

  private serializeAttachmentMeta(
    attachments: CommunicationAttachment[],
    cta?: { buttonText?: string | null; buttonUrl?: string | null },
  ) {
    const payload = attachments.map(item => ({
      fileName: item.fileName,
      mimeType: item.mimeType || 'application/octet-stream',
      size: item.size || null,
    }));
    if (cta?.buttonText && cta?.buttonUrl) {
      payload.push({
        __metaType: 'CTA_BUTTON',
        buttonText: cta.buttonText,
        buttonUrl: cta.buttonUrl,
      } as any);
    }
    return payload;
  }

  private parseAttachmentMeta(raw: unknown) {
    type ParsedFile = { fileName: string; mimeType: string | null; size: number | null };
    if (!Array.isArray(raw)) {
      return {
        files: [] as ParsedFile[],
        cta: { buttonText: null as string | null, buttonUrl: null as string | null },
      };
    }

    let buttonText: string | null = null;
    let buttonUrl: string | null = null;
    const files: ParsedFile[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const metaType = String(item.__metaType || '').toUpperCase();
      if (metaType === 'CTA_BUTTON') {
        const text = String(item.buttonText || '').trim();
        const url = String(item.buttonUrl || '').trim();
        if (text && url) {
          buttonText = text;
          buttonUrl = url;
        }
        continue;
      }
      const fileName = String(item.fileName || '').trim();
      if (!fileName) continue;
      files.push({
        fileName,
        mimeType: (item.mimeType as string | null) || null,
        size: Number(item.size || 0) || null,
      });
    }

    return {
      files,
      cta: { buttonText, buttonUrl },
    };
  }

  private async writeCommunicationLog(input: {
    tenant: Tenant;
    clientId: number;
    channel: CommunicationChannel;
    status: MarketingDeliveryStatus;
    text?: string | null;
    buttonText?: string | null;
    buttonUrl?: string | null;
    attachments?: CommunicationAttachment[];
    errorMessage?: string | null;
    createdById?: number | null;
  }) {
    const saved = await this.prisma.clientCommunicationLog.create({
      data: {
        tenant: input.tenant,
        clientId: input.clientId,
        channel: input.channel,
        status: input.status,
        text: input.text || null,
        attachments:
          input.attachments?.length || (input.buttonText && input.buttonUrl)
            ? this.serializeAttachmentMeta(input.attachments || [], {
                buttonText: input.buttonText || null,
                buttonUrl: input.buttonUrl || null,
              })
            : Prisma.JsonNull,
        errorMessage: input.errorMessage || null,
        createdById: input.createdById || null,
      },
      select: {
        id: true,
        clientId: true,
        channel: true,
        status: true,
        text: true,
        sentAt: true,
        createdById: true,
      },
    });

    const cacheChannel =
      input.channel === CommunicationChannel.TELEGRAM ||
      input.channel === CommunicationChannel.VK ||
      input.channel === CommunicationChannel.WEBSITE
        ? input.channel
        : undefined;
    this.invalidateContactHistoryCache(input.tenant, input.clientId, cacheChannel);
    if (input.channel === CommunicationChannel.WEBSITE) {
      this.invalidateWebsiteConversationsCache(input.tenant);
    }

    return saved;
  }

  private emitWebsiteChatUpdated(input: {
    tenant: Tenant;
    clientId: number;
    messageId: number;
    text?: string | null;
    sentAt: Date;
    author: 'CLIENT' | 'MANAGER';
  }) {
    this.invalidateWebsiteConversationsCache(input.tenant);
    this.invalidateContactHistoryCache(input.tenant, input.clientId, 'WEBSITE');
    this.events.broadcast('WEBSITE_CHAT_UPDATED', {
      tenant: input.tenant,
      clientId: input.clientId,
      messageId: input.messageId,
      text: String(input.text || '').trim(),
      sentAt: input.sentAt.toISOString(),
      author: input.author,
    });
  }

  private sanitizeCtaButton(input: { buttonText?: string | null; buttonUrl?: string | null }) {
    const buttonText = String(input.buttonText || '').trim();
    const buttonUrl = String(input.buttonUrl || '').trim();

    if (!buttonText && !buttonUrl) {
      return { buttonText: null as string | null, buttonUrl: null as string | null };
    }
    if (!buttonText || !buttonUrl) {
      throw new BadRequestException('Для кнопки нужно указать и текст, и ссылку');
    }
    if (!/^https:\/\//i.test(buttonUrl)) {
      throw new BadRequestException('Ссылка кнопки должна начинаться с https://');
    }

    return {
      buttonText: buttonText.slice(0, 80),
      buttonUrl: buttonUrl.slice(0, 500),
    };
  }

  private parseShopMessage(comment?: string | null) {
    const raw = String(comment || '').trim();
    if (!raw) return '';

    const compact = raw.replace(/\r/g, '');
    if (compact.includes('[SHOP_CHAT]')) {
      const directLine = compact
        .split('\n')
        .find(line => line.trim().toLowerCase().startsWith('сообщение:'));
      if (directLine) {
        const parsed = directLine.replace(/^сообщение:\s*/i, '').trim();
        return this.containsSuspiciousProbe(parsed) ? '' : parsed;
      }
      const parsed = compact.replace('[SHOP_CHAT]', '').trim();
      return this.containsSuspiciousProbe(parsed) ? '' : parsed;
    }

    if (compact.includes('[SHOP_LEAD]')) {
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
        const product = productLine.replace(/^товар:\s*/i, '').trim();
        const parsed = product ? `Заявка по товару: ${product}` : 'Новая заявка с сайта';
        return this.containsSuspiciousProbe(parsed) ? '' : parsed;
      }
      const parsed = compact.replace('[SHOP_LEAD]', '').trim();
      return this.containsSuspiciousProbe(parsed) ? '' : parsed;
    }

    if (this.containsSuspiciousProbe(compact)) return '';
    return compact;
  }

  private async closeLatestShopChatTask(clientId: number, tenant: Tenant) {
    const task = await this.prisma.task.findFirst({
      where: {
        tenant,
        clientId,
        status: { in: [TaskStatus.NEW, TaskStatus.IN_PROGRESS] },
        comment: { contains: '[SHOP_CHAT]' },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        comment: true,
      },
    });

    if (!task) return;

    await this.prisma.task
      .update({
        where: { id: task.id },
        data: {
          status: TaskStatus.DONE,
          comment: `${String(task.comment || '').trim()}\n[AUTO_CLOSED_BY_MANAGER_REPLY]`.trim(),
        },
      })
      .catch(() => undefined);
  }

  async list(query?: { q?: string; limit?: string; page?: string }) {
    const page = Number(query?.page) || 1;
    const limit = Math.min(Number(query?.limit) || 50, 200);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q, mode: 'insensitive' } },
        { address: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        skip,
        take: limit,
        include: {
          // Активная подписка.
          subscriptions: {
            where: { status: 'ACTIVE' as any },
            include: {
              clientSlot: {
                include: {
                  sharingSystem: {
                    include: { donor: true },
                  },
                },
              },
              donorAccount: true,
            },
            orderBy: { endDate: 'desc' },
            take: 1,
          },
          // Сокращённая история завершённых заказов для списка.
          orders: {
            where: { status: OrderStatus.COMPLETED },
            include: {
              items: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      serialNumber: true,
                      category: true,
                      price: true,
                    },
                  },
                },
              },
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
              manager: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { date: 'desc' },
            take: 100,
          },
        },
        orderBy: { id: 'desc' },
      }),
      this.prisma.client.count({ where }),
    ]);

    const channelsByPhone = await this.resolveShopContactsByPhone(items.map(item => item.phone));
    const mergedItems = items.map(item => this.mergeClientWithShopChannels(item, channelsByPhone));
    const enrichedItems = await this.attachCompletedByToClients(mergedItems);

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };
  }

  async create(data: {
    name: string;
    phone: string;
    city?: string;
    address?: string;
    consoleType?: string;
    emailLogin?: string;
    emailPassword?: string;
    accountPassword?: string;
    telegramId?: string;
    vkId?: string;
    marketingConsent?: boolean;
  }) {
    if ('maxId' in (data as Record<string, unknown>)) {
      throw new BadRequestException('MAX channel is disabled');
    }

    const created = await this.prisma.client.create({
      data: {
        name: data.name,
        phone: data.phone,
        city: data.city,
        address: data.address,
        consoleType: data.consoleType,
        emailLogin: data.emailLogin,
        emailPassword: data.emailPassword,
        accountPassword: data.accountPassword,
        telegramId: data.telegramId,
        vkId: data.vkId,
        marketingConsent:
          data.marketingConsent !== undefined ? Boolean(data.marketingConsent) : undefined,
      },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' as any },
          include: {
            clientSlot: {
              include: {
                sharingSystem: {
                  include: { donor: true },
                },
              },
            },
            donorAccount: true,
          },
          take: 1,
        },
        orders: {
          where: { status: OrderStatus.COMPLETED },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    serialNumber: true,
                    category: true,
                    price: true,
                  },
                },
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            manager: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 100,
        },
      } as any,
    });

    return (await this.attachCompletedByToClients([created as any]))[0];
  }

  async update(
    id: number,
    data: {
      name?: string;
      phone?: string;
      city?: string;
      address?: string;
      consoleType?: string;
      emailLogin?: string;
      emailPassword?: string;
      accountPassword?: string;
      telegramId?: string | null;
      vkId?: string | null;
      marketingConsent?: boolean;
    },
  ) {
    if ('maxId' in (data as Record<string, unknown>)) {
      throw new BadRequestException('MAX channel is disabled');
    }

    const updated = await this.prisma.client.update({
      where: { id },
      data,
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' as any },
          include: {
            clientSlot: {
              include: {
                sharingSystem: {
                  include: { donor: true },
                },
              },
            },
            donorAccount: true,
          },
          take: 1,
        },
        orders: {
          where: { status: OrderStatus.COMPLETED },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    serialNumber: true,
                    category: true,
                    price: true,
                  },
                },
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            manager: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 100,
        },
      } as any,
    });

    return (await this.attachCompletedByToClients([updated as any]))[0];
  }

  async remove(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        orders: true,
        subscriptions: true,
        tasks: true,
        tradeIns: true,
        clientSlots: true,
      } as any,
    });

    if (!client) {
      throw new BadRequestException('Клиент не найден');
    }

    if (client.clientSlots && client.clientSlots.length > 0) {
      throw new BadRequestException(
        `Невозможно удалить клиента. Он подключен к системе шеринга. Сначала отвяжите его.`,
      );
    }

    if (client.orders && client.orders.length > 0) {
      throw new BadRequestException(
        `Невозможно удалить клиента. У него есть ${client.orders.length} заказ(ов). Сначала удалите заказы.`,
      );
    }

    if (client.subscriptions && client.subscriptions.length > 0) {
      throw new BadRequestException(
        `Невозможно удалить клиента. У него есть ${client.subscriptions.length} подписк(и). Сначала удалите подписки.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.subscription.deleteMany({
        where: {
          clientId: id,
          clientSlotId: null,
        },
      }),
      this.prisma.task.deleteMany({ where: { clientId: id } }),
      this.prisma.tradeIn.deleteMany({ where: { clientId: id } }),
      this.prisma.client.delete({ where: { id } }),
    ]);

    return { success: true, message: 'Клиент удалён' };
  }

  async findOne(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' as any },
          include: {
            clientSlot: {
              include: {
                sharingSystem: {
                  include: { donor: true },
                },
              },
            },
            donorAccount: true,
          },
          orderBy: { endDate: 'desc' },
          take: 1,
        },
        // Полная история заказов со всеми деталями.
        orders: {
          where: { status: OrderStatus.COMPLETED },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    serialNumber: true,
                    category: true,
                    price: true,
                    costPrice: true,
                  },
                },
              },
            },
            // Автор заказа.
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
            // Ответственный менеджер.
            manager: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { date: 'desc' },
          take: 100,
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    const channelsByPhone = await this.resolveShopContactsByPhone([client.phone]);
    const merged = this.mergeClientWithShopChannels(client, channelsByPhone);
    return (await this.attachCompletedByToClients([merged]))[0];
  }

  async contact(
    id: number,
    input: {
      channel: 'PHONE' | 'TELEGRAM' | 'VK' | 'WEBSITE';
      text?: string;
      buttonText?: string;
      buttonUrl?: string;
    },
    files: UploadFile[] = [],
    rawTenant?: Tenant | null,
    createdById?: number,
  ) {
    const tenant = this.resolveTenant(rawTenant);
    const channel = String(input.channel || '').toUpperCase() as
      | 'PHONE'
      | 'TELEGRAM'
      | 'VK'
      | 'WEBSITE';
    const attachments = this.normalizeContactAttachments(files);

    const client = await this.prisma.client.findFirst({
      where: { id, tenant },
      select: {
        id: true,
        name: true,
        phone: true,
        telegramId: true,
        vkId: true,
        maxId: true,
      },
    });

    if (!client) {
      throw new NotFoundException('Клиент не найден');
    }

    if (channel === 'PHONE') {
      if (!client.phone) {
        throw new BadRequestException('У клиента нет номера телефона');
      }

      return {
        success: true,
        channel,
        target: client.phone,
        actionUrl: `tel:${client.phone}`,
      };
    }

    const text = this.normalizeMessageText(input.text);
    if (channel === 'WEBSITE' && text && this.containsSuspiciousProbe(text)) {
      throw new BadRequestException('Сообщение похоже на технический тест и было отклонено');
    }
    const cta = this.sanitizeCtaButton({
      buttonText: input.buttonText,
      buttonUrl: input.buttonUrl,
    });
    if (!text && !attachments.length) {
      throw new BadRequestException('Введите текст сообщения или прикрепите файл');
    }

    let targetId =
      channel === 'TELEGRAM' ? client.telegramId : channel === 'VK' ? client.vkId : null;

    if (!targetId && channel !== 'WEBSITE') {
      const channelsByPhone = await this.resolveShopContactsByPhone([client.phone]);
      const merged = this.mergeClientWithShopChannels(client, channelsByPhone);
      targetId = channel === 'TELEGRAM' ? merged.telegramId : channel === 'VK' ? merged.vkId : null;

      if (targetId) {
        await this.prisma.client
          .update({
            where: { id: client.id },
            data: {
              telegramId: merged.telegramId || undefined,
              vkId: merged.vkId || undefined,
            },
          })
          .catch(() => undefined);
      }
    }

    if (!targetId && channel !== 'WEBSITE') {
      throw new BadRequestException('У клиента не подключен выбранный канал');
    }

    const result = await this.communication.sendByChannel(
      channel,
      targetId || String(client.id),
      text,
      attachments,
      {
        buttonText: cta.buttonText || undefined,
        buttonUrl: cta.buttonUrl || undefined,
      },
    );
    if (!result.success) {
      await this.writeCommunicationLog({
        tenant,
        clientId: client.id,
        channel: channel as CommunicationChannel,
        status: MarketingDeliveryStatus.FAILED,
        text: text || null,
        buttonText: cta.buttonText,
        buttonUrl: cta.buttonUrl,
        attachments,
        errorMessage: result.error || 'Не удалось отправить сообщение',
        createdById: createdById || null,
      }).catch(() => undefined);
      throw new BadRequestException(result.error || 'Не удалось отправить сообщение');
    }

    const savedLog = await this.writeCommunicationLog({
      tenant,
      clientId: client.id,
      channel: channel as CommunicationChannel,
      status: MarketingDeliveryStatus.SENT,
      text: text || null,
      buttonText: cta.buttonText,
      buttonUrl: cta.buttonUrl,
      attachments,
      createdById: createdById || null,
    }).catch(() => undefined);

    if (channel === 'WEBSITE' && savedLog?.id) {
      this.emitWebsiteChatUpdated({
        tenant,
        clientId: client.id,
        messageId: savedLog.id,
        text: savedLog.text || text || null,
        sentAt: savedLog.sentAt || new Date(),
        author: createdById ? 'MANAGER' : 'CLIENT',
      });
    }

    return {
      success: true,
      channel,
      clientId: client.id,
      target: targetId || 'website-chat',
      attachments: attachments.length,
    };
  }

  async purgeSuspiciousWebsiteMessages(rawTenant?: Tenant | null) {
    const tenant = this.resolveTenant(rawTenant);
    const where = {
      tenant,
      channel: CommunicationChannel.WEBSITE,
      OR: this.suspiciousProbeNeedles.map(needle => ({
        text: { contains: needle, mode: 'insensitive' as const },
      })),
    };

    const [dryRunCount, deleted] = await this.prisma.$transaction([
      this.prisma.clientCommunicationLog.count({ where }),
      this.prisma.clientCommunicationLog.deleteMany({ where }),
    ]);

    this.invalidateWebsiteConversationsCache(tenant);
    this.contactHistoryCache.clear();

    return {
      success: true,
      scannedTenant: tenant,
      matched: dryRunCount,
      deleted: deleted.count,
    };
  }

  async getContactHistory(
    id: number,
    query: { channel?: 'TELEGRAM' | 'VK' | 'WEBSITE'; limit?: number; offset?: number },
    rawTenant?: Tenant | null,
  ) {
    const tenant = this.resolveTenant(rawTenant);
    const limit = Math.max(20, Math.min(400, Number(query?.limit) || 120));
    const offset = Math.max(0, Math.min(5000, Number(query?.offset) || 0));
    const cacheKey = this.contactHistoryCacheKey(tenant, id, query.channel, limit, offset);
    const cached = this.contactHistoryCache.get(cacheKey);
    if (cached?.value && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    if (cached?.promise) {
      return cached.promise;
    }

    const pending = (async () => {
      const client = await this.prisma.client.findFirst({
        where: { id, tenant },
        select: { id: true },
      });

      if (!client) {
        throw new NotFoundException('Клиент не найден');
      }

      const fetchTake = Math.max(200, Math.min(5000, offset + limit + 240));

      const directLogs = await this.prisma.clientCommunicationLog.findMany({
        where: {
          tenant,
          clientId: client.id,
          ...(query.channel
            ? {
                OR: [{ channel: query.channel }, { channel: CommunicationChannel.WEBSITE }],
              }
            : {}),
        },
        orderBy: { sentAt: 'desc' },
        take: fetchTake,
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      const campaignLogs = await this.prisma.marketingCampaignLog.findMany({
        where: {
          clientId: client.id,
          ...(query.channel ? { channel: query.channel } : {}),
          campaign: {
            tenant,
          },
        },
        orderBy: { sentAt: 'desc' },
        take: fetchTake,
        include: {
          campaign: {
            select: {
              id: true,
              title: true,
              message: true,
              attachments: true,
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      const [legacySiteTasks, siteLeadOrders] = await Promise.all([
        this.prisma.task.findMany({
          where: {
            tenant,
            clientId: client.id,
            comment: { contains: '[SHOP_LEAD]' },
          },
          orderBy: { createdAt: 'desc' },
          take: fetchTake,
          include: {
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
            tenant,
            clientId: client.id,
            comment: { contains: '[SHOP_LEAD]' },
          },
          orderBy: { date: 'desc' },
          take: fetchTake,
          include: {
            manager: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      const campaignItems = campaignLogs.map(item => {
        const parsed = this.parseAttachmentMeta(item.campaign.attachments);
        return {
          id: `campaign-${item.id}`,
          entryType: 'CAMPAIGN' as const,
          campaignId: item.campaignId,
          campaignTitle: item.campaign.title,
          channel: item.channel,
          status: item.status,
          title: item.campaign.title,
          text: item.campaign.message,
          buttonText: parsed.cta.buttonText,
          buttonUrl: parsed.cta.buttonUrl,
          attachments: parsed.files,
          errorMessage: item.errorMessage,
          sentAt: item.sentAt,
          createdBy: item.campaign.createdBy,
          author: 'MANAGER' as const,
        };
      });

      const directItems = directLogs.flatMap(item => {
        const cleanText = this.normalizeMessageText(item.text);
        if (this.containsSuspiciousProbe(cleanText)) return [];
        const parsed = this.parseAttachmentMeta(item.attachments);
        if (!cleanText && !parsed.files.length && !parsed.cta.buttonText && !item.errorMessage) {
          return [];
        }
        return [
          {
            ...item,
            entryType: 'DIRECT' as const,
            text: cleanText || null,
            buttonText: parsed.cta.buttonText,
            buttonUrl: parsed.cta.buttonUrl,
            attachments: parsed.files,
            author:
              item.channel === CommunicationChannel.WEBSITE && !item.createdById
                ? ('CLIENT' as const)
                : ('MANAGER' as const),
            readByCustomerAt: item.readByCustomerAt || null,
          },
        ];
      });

      const siteItems = [...legacySiteTasks, ...siteLeadOrders]
        .map(item => ({
          id: `site-${item.id}`,
          entryType: 'SITE' as const,
          channel: 'WEBSITE' as const,
          status: 'SENT' as const,
          title: 'title' in item ? item.title : `Заявка с сайта #${item.id}`,
          text: this.parseShopMessage(item.comment),
          buttonText: null,
          buttonUrl: null,
          attachments: [],
          errorMessage: null,
          sentAt: 'createdAt' in item ? item.createdAt : item.date,
          createdBy: 'assignedTo' in item ? item.assignedTo || null : item.manager || null,
          author: 'CLIENT' as const,
        }))
        .filter(item => Boolean(item.text));

      const mergedItems = [...directItems, ...campaignItems, ...siteItems].sort(
        (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
      );
      const pageItems = mergedItems.slice(offset, offset + limit);
      const hasMore = offset + limit < mergedItems.length;

      const result = {
        items: pageItems,
        pagination: {
          offset,
          limit,
          total: mergedItems.length,
          hasMore,
          nextOffset: hasMore ? offset + limit : null,
        },
      };

      this.contactHistoryCache.set(cacheKey, {
        expiresAt: Date.now() + this.contactHistoryCacheTtlMs,
        value: result,
      });

      return result;
    })().catch(error => {
      this.contactHistoryCache.delete(cacheKey);
      throw error;
    });

    this.contactHistoryCache.set(cacheKey, {
      expiresAt: 0,
      promise: pending,
    });

    return pending;
  }

  async getWebsiteConversations(rawTenant?: Tenant | null) {
    const tenant = this.resolveTenant(rawTenant);
    const cacheKey = this.websiteConversationCacheKey(tenant);
    const cached = this.websiteConversationsCache.get(cacheKey);
    if (cached?.value && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    if (cached?.promise) {
      return cached.promise;
    }
    const pending = (async () => {
      const [websiteLogs, legacySiteTasks, siteLeadOrders] = await Promise.all([
        this.prisma.clientCommunicationLog.findMany({
          where: {
            tenant,
            channel: CommunicationChannel.WEBSITE,
          },
          orderBy: { sentAt: 'asc' },
          take: 5000,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                phone: true,
                city: true,
              },
            },
          },
        }),
        this.prisma.task.findMany({
          where: {
            tenant,
            clientId: { not: null },
            comment: { contains: '[SHOP_LEAD]' },
          },
          orderBy: { createdAt: 'asc' },
          take: 2000,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                phone: true,
                city: true,
              },
            },
          },
        }),
        this.prisma.order.findMany({
          where: {
            tenant,
            clientId: { gt: 0 },
            comment: { contains: '[SHOP_LEAD]' },
          },
          orderBy: { date: 'asc' },
          take: 2000,
          select: {
            id: true,
            comment: true,
            date: true,
            client: {
              select: {
                id: true,
                name: true,
                phone: true,
                city: true,
              },
            },
          },
        }),
      ]);

      type ConversationState = {
        clientId: number;
        clientName: string;
        clientPhone: string;
        clientCity: string | null;
        hadClientMessage: boolean;
        unreadCount: number;
        totalMessages: number;
        lastMessageText: string;
        lastMessageAt: Date;
        lastMessageAuthor: 'CLIENT' | 'MANAGER';
      };

      const map = new Map<number, ConversationState>();

      const ensureConversation = (client: {
        id: number;
        name: string;
        phone: string;
        city: string | null;
      }) => {
        const existing = map.get(client.id);
        if (existing) return existing;
        const created: ConversationState = {
          clientId: client.id,
          clientName: client.name,
          clientPhone: client.phone,
          clientCity: client.city || null,
          hadClientMessage: false,
          unreadCount: 0,
          totalMessages: 0,
          lastMessageText: '',
          lastMessageAt: new Date(0),
          lastMessageAuthor: 'CLIENT',
        };
        map.set(client.id, created);
        return created;
      };

      const registerMessage = (
        state: ConversationState,
        payload: {
          text: string;
          sentAt: Date;
          author: 'CLIENT' | 'MANAGER';
        },
      ) => {
        const text = this.normalizeMessageText(payload.text);
        if (this.containsSuspiciousProbe(text)) return;
        if (!text) return;

        state.totalMessages += 1;
        if (payload.author === 'CLIENT') {
          state.hadClientMessage = true;
          state.unreadCount += 1;
        } else {
          state.unreadCount = 0;
        }

        if (payload.sentAt.getTime() >= state.lastMessageAt.getTime()) {
          state.lastMessageAt = payload.sentAt;
          state.lastMessageText = text;
          state.lastMessageAuthor = payload.author;
        }
      };

      for (const log of websiteLogs) {
        if (!log.client) continue;
        const state = ensureConversation({
          id: log.client.id,
          name: log.client.name,
          phone: log.client.phone,
          city: log.client.city || null,
        });
        registerMessage(state, {
          text: this.normalizeMessageText(log.text) || 'Сообщение',
          sentAt: log.sentAt,
          author: log.createdById ? 'MANAGER' : 'CLIENT',
        });
      }

      for (const task of legacySiteTasks) {
        if (!task.client) continue;
        const parsed = this.parseShopMessage(task.comment);
        if (!parsed) continue;
        const state = ensureConversation({
          id: task.client.id,
          name: task.client.name,
          phone: task.client.phone,
          city: task.client.city || null,
        });
        registerMessage(state, {
          text: parsed,
          sentAt: task.createdAt,
          author: 'CLIENT',
        });
      }

      for (const order of siteLeadOrders) {
        const parsed = this.parseShopMessage(order.comment);
        if (!parsed) continue;
        const state = ensureConversation({
          id: order.client.id,
          name: order.client.name,
          phone: order.client.phone,
          city: order.client.city || null,
        });
        registerMessage(state, {
          text: parsed,
          sentAt: order.date,
          author: 'CLIENT',
        });
      }

      const result = {
        items: Array.from(map.values())
          .filter(item => item.hadClientMessage && item.totalMessages > 0)
          .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
          .map(item => ({
            clientId: item.clientId,
            clientName: item.clientName,
            clientPhone: item.clientPhone,
            clientCity: item.clientCity,
            unreadCount: item.unreadCount,
            status: item.unreadCount > 0 ? ('UNREAD' as const) : ('READ' as const),
            responseState:
              item.unreadCount > 0 ? ('WAITING_MANAGER' as const) : ('WAITING_CLIENT' as const),
            totalMessages: item.totalMessages,
            lastMessageText: item.lastMessageText,
            lastMessageAt: item.lastMessageAt,
            lastMessageAuthor: item.lastMessageAuthor,
          })),
      };

      this.websiteConversationsCache.set(cacheKey, {
        expiresAt: Date.now() + this.websiteConversationsCacheTtlMs,
        value: result,
      });

      return result;
    })().catch(error => {
      this.websiteConversationsCache.delete(cacheKey);
      throw error;
    });

    this.websiteConversationsCache.set(cacheKey, {
      expiresAt: 0,
      promise: pending,
    });

    return pending;
  }
}
