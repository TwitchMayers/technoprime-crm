import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  CommunicationChannel,
  MarketingAudienceType,
  MarketingCampaign,
  MarketingCampaignStatus,
  MarketingDeliveryStatus,
  OrderStatus,
  SubscriptionStatus,
  Tenant,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  CommunicationAttachment,
  CommunicationService,
} from '../communication/communication.service';
import { CreateMarketingCampaignDto } from './dto/create-marketing-campaign.dto';

type CampaignAttachmentMeta = {
  fileName: string;
  mimeType: string;
  size: number;
  path: string;
};

type CampaignCtaMeta = {
  buttonText: string | null;
  buttonUrl: string | null;
};

type UploadFile = {
  originalname?: string;
  filename?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

const ACTIVE_MARKETING_CHANNELS = [CommunicationChannel.TELEGRAM, CommunicationChannel.VK] as const;

@Injectable()
export class MarketingCampaignsService implements OnModuleInit {
  private readonly logger = new Logger(MarketingCampaignsService.name);
  private readonly queuedCampaignIds: number[] = [];
  private queueRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly communication: CommunicationService,
  ) {}

  async onModuleInit() {
    try {
      const pending = await this.prisma.marketingCampaign.findMany({
        where: {
          status: MarketingCampaignStatus.DRAFT,
          isSending: true,
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
      });

      pending.forEach(item => this.enqueueCampaign(item.id));
    } catch (error) {
      this.logger.warn(`Marketing queue warmup skipped: ${String(error)}`);
    }
  }

  private resolveTenant(tenant?: Tenant | null): Tenant {
    return Tenant.TECHNOPRIME;
  }

  private campaignUploadDir() {
    return join(process.cwd(), '..', 'assets', 'uploads', 'campaigns');
  }

  private normalizeIncomingAttachments(files: UploadFile[] = []) {
    return files.filter(file => file && file.buffer?.byteLength).slice(0, 6);
  }

  private sanitizeCampaignAttachments(raw: unknown): CampaignAttachmentMeta[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map(item => {
        const fileName = String(item?.fileName || '').trim();
        const mimeType = String(item?.mimeType || 'application/octet-stream').trim();
        const path = String(item?.path || '').trim();
        const size = Number(item?.size || 0);
        if (!fileName || !path) return null;
        return {
          fileName,
          mimeType,
          path,
          size: Number.isFinite(size) ? size : 0,
        } as CampaignAttachmentMeta;
      })
      .filter((item): item is CampaignAttachmentMeta => Boolean(item));
  }

  private async persistCampaignAttachments(
    files: UploadFile[] = [],
  ): Promise<CampaignAttachmentMeta[]> {
    const incoming = this.normalizeIncomingAttachments(files);
    if (!incoming.length) return [];

    const dir = this.campaignUploadDir();
    await mkdir(dir, { recursive: true });

    const persisted: CampaignAttachmentMeta[] = [];
    for (const file of incoming) {
      const buffer = file.buffer;
      if (!buffer?.byteLength) continue;

      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const ext = extname(file.originalname || '') || '';
      const safeExt = ext.slice(0, 10);
      const fileName = `${suffix}${safeExt}`;
      const absolutePath = join(dir, fileName);
      await writeFile(absolutePath, buffer);

      persisted.push({
        fileName: file.originalname || fileName,
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size || buffer.byteLength,
        path: absolutePath,
      });
    }

    return persisted;
  }

  private parseDate(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Некорректная дата в фильтре рассылки');
    }
    return parsed;
  }

  private sanitizeChannels(channels: unknown): CommunicationChannel[] {
    if (!Array.isArray(channels)) return [];

    const allowed = new Set<CommunicationChannel>(ACTIVE_MARKETING_CHANNELS);

    const normalized = channels
      .map(item => String(item || '').toUpperCase())
      .filter((item): item is CommunicationChannel => allowed.has(item as CommunicationChannel));

    return Array.from(new Set(normalized));
  }

  private sanitizeAudienceType(value?: string | null): MarketingAudienceType {
    const normalized = String(value || '').toUpperCase();
    if (
      normalized === MarketingAudienceType.ACTIVE_ORDERS ||
      normalized === MarketingAudienceType.SUBSCRIPTIONS ||
      normalized === MarketingAudienceType.REGISTERED_RANGE
    ) {
      return normalized as MarketingAudienceType;
    }
    return MarketingAudienceType.ALL;
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

  private extractCampaignCta(raw: unknown): CampaignCtaMeta {
    if (!Array.isArray(raw)) {
      return { buttonText: null, buttonUrl: null };
    }

    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const metaType = String(item.__metaType || '')
        .trim()
        .toUpperCase();
      if (metaType !== 'CTA_BUTTON') continue;
      const buttonText = String(item.buttonText || '').trim();
      const buttonUrl = String(item.buttonUrl || '').trim();
      if (!buttonText || !buttonUrl) continue;
      return this.sanitizeCtaButton({ buttonText, buttonUrl });
    }

    return { buttonText: null, buttonUrl: null };
  }

  private composeCampaignAttachmentsPayload(
    attachments: CampaignAttachmentMeta[],
    cta: CampaignCtaMeta,
  ) {
    const payload: any[] = [...attachments];
    if (cta.buttonText && cta.buttonUrl) {
      payload.push({
        __metaType: 'CTA_BUTTON',
        buttonText: cta.buttonText,
        buttonUrl: cta.buttonUrl,
      });
    }
    return payload.length ? payload : undefined;
  }

  private buildAudienceWhere(campaign: MarketingCampaign): Prisma.ClientWhereInput {
    const andWhere: Prisma.ClientWhereInput[] = [{ marketingConsent: true }];

    const channelOr: Prisma.ClientWhereInput[] = [];
    const channels = this.sanitizeChannels(campaign.channels);

    if (channels.includes(CommunicationChannel.TELEGRAM)) {
      channelOr.push({ telegramId: { not: null } });
    }
    if (channels.includes(CommunicationChannel.VK)) {
      channelOr.push({ vkId: { not: null } });
    }
    if (channelOr.length) {
      andWhere.push({ OR: channelOr });
    }

    if (campaign.audienceType === MarketingAudienceType.ACTIVE_ORDERS) {
      andWhere.push({
        orders: {
          some: {
            tenant: campaign.tenant,
            status: { in: [OrderStatus.NEW, OrderStatus.IN_PROGRESS] },
          },
        },
      });
    }

    if (campaign.audienceType === MarketingAudienceType.SUBSCRIPTIONS) {
      andWhere.push({
        subscriptions: {
          some: {
            tenant: campaign.tenant,
            status: SubscriptionStatus.ACTIVE,
          },
        },
      });
    }

    if (campaign.audienceType === MarketingAudienceType.REGISTERED_RANGE) {
      const range: Prisma.DateTimeFilter = {};
      if (campaign.registeredFrom) {
        range.gte = campaign.registeredFrom;
      }
      if (campaign.registeredTo) {
        range.lte = campaign.registeredTo;
      }
      if (range.gte || range.lte) {
        andWhere.push({ createdAt: range });
      }
    }

    return {
      tenant: campaign.tenant,
      AND: andWhere,
    };
  }

  private resolveChannelTarget(
    client: { telegramId: string | null; vkId: string | null; maxId: string | null },
    channel: CommunicationChannel,
  ): string | null {
    if (channel === CommunicationChannel.TELEGRAM) return client.telegramId || null;
    if (channel === CommunicationChannel.VK) return client.vkId || null;
    return null;
  }

  private enqueueCampaign(campaignId: number) {
    if (!campaignId || Number.isNaN(campaignId)) return;
    if (!this.queuedCampaignIds.includes(campaignId)) {
      this.queuedCampaignIds.push(campaignId);
    }

    if (!this.queueRunning) {
      this.queueRunning = true;
      void this.runQueue();
    }
  }

  private async runQueue() {
    while (this.queuedCampaignIds.length > 0) {
      const campaignId = this.queuedCampaignIds.shift();
      if (!campaignId) continue;

      try {
        await this.processCampaign(campaignId);
      } catch (error) {
        this.logger.error(`Campaign #${campaignId} processing failed: ${String(error)}`);
      }
    }

    this.queueRunning = false;
  }

  private async processCampaign(campaignId: number) {
    const campaign = await this.prisma.marketingCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return;

    const channels = this.sanitizeChannels(campaign.channels);
    if (!channels.length) {
      await this.prisma.marketingCampaign.update({
        where: { id: campaignId },
        data: {
          isSending: false,
          status: MarketingCampaignStatus.SENT,
          sentAt: new Date(),
        },
      });
      return;
    }

    const batchSize = Math.max(10, Number(process.env.MARKETING_BATCH_SIZE || 100));
    let sentCount = 0;
    let errorCount = 0;
    let cursorId: number | null = null;

    const where = this.buildAudienceWhere(campaign);
    const attachments = this.sanitizeCampaignAttachments(campaign.attachments);
    const cta = this.extractCampaignCta(campaign.attachments);

    for (;;) {
      const clients = await this.prisma.client.findMany({
        where,
        take: batchSize,
        ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
        select: {
          id: true,
          telegramId: true,
          vkId: true,
          maxId: true,
        },
      });

      if (!clients.length) break;
      cursorId = clients[clients.length - 1].id;

      const logs: Prisma.MarketingCampaignLogCreateManyInput[] = [];

      for (const client of clients) {
        for (const channel of channels) {
          const target = this.resolveChannelTarget(client, channel);
          if (!target) continue;

          const result = await this.communication.sendByChannel(
            channel,
            target,
            campaign.message,
            attachments as CommunicationAttachment[],
            {
              title: campaign.title,
              buttonText: cta.buttonText || undefined,
              buttonUrl: cta.buttonUrl || undefined,
            },
          );

          if (result.success) {
            sentCount += 1;
            logs.push({
              campaignId,
              clientId: client.id,
              channel,
              status: MarketingDeliveryStatus.SENT,
              sentAt: new Date(),
            });
          } else {
            errorCount += 1;
            logs.push({
              campaignId,
              clientId: client.id,
              channel,
              status: MarketingDeliveryStatus.FAILED,
              errorMessage: String(result.error || 'Unknown channel error').slice(0, 500),
              sentAt: new Date(),
            });
          }
        }
      }

      if (logs.length) {
        await this.prisma.marketingCampaignLog.createMany({ data: logs });
      }
    }

    await this.prisma.marketingCampaign.update({
      where: { id: campaignId },
      data: {
        isSending: false,
        status: MarketingCampaignStatus.SENT,
        sentAt: new Date(),
        sentCount: { increment: sentCount },
        errorCount: { increment: errorCount },
      },
    });
  }

  async list(rawTenant?: Tenant | null) {
    const tenant = this.resolveTenant(rawTenant);
    return this.prisma.marketingCampaign.findMany({
      where: { tenant },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            logs: true,
          },
        },
      },
      take: 200,
    });
  }

  async findOne(id: number, rawTenant?: Tenant | null) {
    const tenant = this.resolveTenant(rawTenant);

    const campaign = await this.prisma.marketingCampaign.findFirst({
      where: { id, tenant },
      include: {
        logs: {
          orderBy: { sentAt: 'desc' },
          take: 300,
          include: {
            client: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async create(
    dto: CreateMarketingCampaignDto,
    files: UploadFile[] = [],
    rawTenant?: Tenant | null,
    createdById?: number,
  ) {
    const tenant = this.resolveTenant(rawTenant);
    const channels = this.sanitizeChannels(dto.channels);

    if (!channels.length) {
      throw new BadRequestException('Выберите хотя бы один канал рассылки');
    }

    const audienceType = this.sanitizeAudienceType(dto.audienceType);
    const registeredFrom = this.parseDate(dto.registeredFrom);
    const registeredTo = this.parseDate(dto.registeredTo);
    const message = String(dto.message || '').trim();
    const cta = this.sanitizeCtaButton({
      buttonText: dto.buttonText,
      buttonUrl: dto.buttonUrl,
    });

    if (
      audienceType === MarketingAudienceType.REGISTERED_RANGE &&
      !registeredFrom &&
      !registeredTo
    ) {
      throw new BadRequestException('Для кастомного фильтра укажите диапазон дат');
    }

    if (registeredFrom && registeredTo && registeredFrom.getTime() > registeredTo.getTime()) {
      throw new BadRequestException('Начальная дата должна быть раньше конечной');
    }

    const attachments = await this.persistCampaignAttachments(files);
    if (!message && !attachments.length) {
      throw new BadRequestException('Введите текст рассылки или прикрепите файл');
    }

    return this.prisma.marketingCampaign.create({
      data: {
        tenant,
        title: dto.title.trim(),
        message,
        attachments: this.composeCampaignAttachmentsPayload(attachments, cta),
        channels,
        audienceType,
        registeredFrom,
        registeredTo,
        createdById: createdById || null,
      },
    });
  }

  async enqueueSend(id: number, rawTenant?: Tenant | null, force = false) {
    const tenant = this.resolveTenant(rawTenant);

    const campaign = await this.prisma.marketingCampaign.findFirst({
      where: { id, tenant },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.isSending) {
      return { success: true, queued: true, alreadyQueued: true };
    }

    if (!force && campaign.status === MarketingCampaignStatus.SENT) {
      throw new BadRequestException('Рассылка уже отправлена, используйте повтор');
    }

    await this.prisma.marketingCampaign.update({
      where: { id },
      data: {
        isSending: true,
        status: MarketingCampaignStatus.DRAFT,
        sentAt: null,
        ...(force
          ? {
              sentCount: 0,
              errorCount: 0,
            }
          : {}),
      },
    });

    this.enqueueCampaign(id);

    return { success: true, queued: true };
  }

  async duplicate(id: number, rawTenant?: Tenant | null, createdById?: number) {
    const tenant = this.resolveTenant(rawTenant);
    const campaign = await this.prisma.marketingCampaign.findFirst({
      where: { id, tenant },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const channels = this.sanitizeChannels(campaign.channels);
    if (!channels.length) {
      throw new BadRequestException('В исходной кампании нет активных каналов для копирования');
    }

    const duplicate = await this.prisma.marketingCampaign.create({
      data: {
        tenant,
        title: `${campaign.title} (копия)`,
        message: campaign.message,
        attachments: campaign.attachments ?? undefined,
        channels,
        audienceType: campaign.audienceType,
        registeredFrom: campaign.registeredFrom,
        registeredTo: campaign.registeredTo,
        status: MarketingCampaignStatus.DRAFT,
        createdById: createdById || null,
      },
    });

    return duplicate;
  }
}
