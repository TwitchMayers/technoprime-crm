import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as webpush from 'web-push';

type PushSubscriptionInput = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  } | null;
  userAgent?: string | null;
};

type WebPushPayload = {
  title?: string;
  body?: string;
  text?: string;
  href?: string;
  tag?: string;
  data?: Record<string, any>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly webPushPublicKey = String(process.env.WEB_PUSH_PUBLIC_KEY || '').trim();
  private readonly webPushPrivateKey = String(process.env.WEB_PUSH_PRIVATE_KEY || '').trim();
  private readonly webPushSubject =
    String(process.env.WEB_PUSH_SUBJECT || '').trim() || 'https://crm.technoprimestore.ru';
  private readonly webPushEnabled: boolean;

  constructor(private prisma: PrismaService) {
    this.webPushEnabled = Boolean(this.webPushPublicKey && this.webPushPrivateKey);

    if (this.webPushEnabled) {
      webpush.setVapidDetails(this.webPushSubject, this.webPushPublicKey, this.webPushPrivateKey);
    } else {
      this.logger.warn('Web push disabled: WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY are missing');
    }
  }

  list(userId: number, unread?: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, readAt: unread ? null : undefined },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(id: number, userId: number) {
    if (!id || Number.isNaN(id)) {
      throw new BadRequestException('Invalid notification id');
    }

    const result = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });

    if (!result.count) {
      throw new NotFoundException('Notification not found');
    }

    return { success: true };
  }

  async push(userId: number, type: string, payload?: any) {
    return this.prisma.notification.create({ data: { userId, type, payload } });
  }

  getWebPushPublicKey() {
    return {
      supported: this.webPushEnabled,
      publicKey: this.webPushEnabled ? this.webPushPublicKey : null,
    };
  }

  async upsertPushSubscription(userId: number, input: PushSubscriptionInput) {
    const endpoint = String(input?.endpoint || '').trim();
    const p256dh = String(input?.keys?.p256dh || '').trim();
    const auth = String(input?.keys?.auth || '').trim();
    const userAgent = String(input?.userAgent || '').trim() || null;

    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException('Invalid push subscription payload');
    }

    return this.prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId,
        endpoint,
        p256dh,
        auth,
        userAgent,
        disabledAt: null,
        lastUsedAt: new Date(),
      },
      update: {
        userId,
        p256dh,
        auth,
        userAgent,
        disabledAt: null,
        lastUsedAt: new Date(),
      },
    });
  }

  async removePushSubscription(userId: number, endpoint?: string | null) {
    const value = String(endpoint || '').trim();

    if (!value) {
      return this.prisma.pushSubscription.updateMany({
        where: { userId, disabledAt: null },
        data: { disabledAt: new Date() },
      });
    }

    return this.prisma.pushSubscription.updateMany({
      where: { userId, endpoint: value },
      data: { disabledAt: new Date() },
    });
  }

  async sendWebPushToUser(userId: number, payload: WebPushPayload) {
    if (!this.webPushEnabled) {
      return { sent: 0, skipped: true };
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        userId,
        disabledAt: null,
      },
      select: {
        id: true,
        endpoint: true,
        p256dh: true,
        auth: true,
      },
    });

    if (!subscriptions.length) {
      return { sent: 0, skipped: true };
    }

    let sent = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          },
          JSON.stringify({
            title: payload.title || 'TechnoPrime CRM',
            body: payload.body || payload.text || 'Новое уведомление',
            text: payload.text || payload.body || 'Новое уведомление',
            data: {
              ...(payload.data || {}),
              href: payload.href || payload.data?.href || '/dashboard',
            },
            tag: payload.tag || undefined,
          }),
        );

        sent += 1;
        await this.prisma.pushSubscription
          .update({
            where: { id: subscription.id },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => undefined);
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || error?.status || 0);
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription
            .update({
              where: { id: subscription.id },
              data: { disabledAt: new Date() },
            })
            .catch(() => undefined);
          continue;
        }

        this.logger.warn(
          `Failed to send web push to user ${userId} via subscription ${subscription.id}: ${String(error?.message || error)}`,
        );
      }
    }

    return { sent, skipped: false };
  }
}
