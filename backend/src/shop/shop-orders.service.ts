import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import {
  OrderSource,
  OrderStatus,
  PaymentMethod,
  Prisma,
  TaskStatus,
  TaskType,
  InventoryUnitStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import Decimal from 'decimal.js';
import * as bcrypt from 'bcrypt';
import { Cron } from '@nestjs/schedule';
import { InventoryService } from '../inventory/inventory.service';
import { ShopTelegramCrmService } from './shop-telegram-crm.service';
import { ShopCrmSyncService } from './shop-crm-sync.service';
import { formatShopLeadComment } from './shop-lead.util';
import { ActiveStorePromotion, ShopFeaturedService } from './shop-featured.service';

type CheckoutItemInput = {
  productId: number;
  qty: number;
  variantKey?: string | null;
};

type CheckoutInput = {
  phone: string;
  name?: string;
  city?: string;
  address?: string;
  comment?: string;
  paymentMethod?: 'CASH' | 'TRANSFER' | 'TRADE_IN';
  items: CheckoutItemInput[];
};

type LeaveLeadInput = {
  productId: number;
  phone: string;
  name?: string;
  city?: string;
  address?: string;
  comment?: string;
};

type ShopVariant = {
  key: string;
  label: string;
  memoryGb: number | null;
  price: number;
  costPrice: number | null;
  stock: number;
  inStock: boolean;
  isDefault: boolean;
};

@Injectable()
export class ShopOrdersService {
  private readonly logger = new Logger(ShopOrdersService.name);
  private readonly reserveMinutes = 15;
  private readonly maxUnitsPerHour = 3;
  private readonly maxSkusPerHour = 3;
  private readonly unpaidLimit = 5;
  private readonly unpaidLookbackMs = 7 * 24 * 60 * 60 * 1000;
  private readonly blockHours = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly featured: ShopFeaturedService,
    private readonly shopTelegramCrm: ShopTelegramCrmService,
    private readonly crmSync: ShopCrmSyncService,
  ) {}

  private normalizePhone(input: string) {
    const digits = String(input || '').replace(/\D/g, '');
    if (digits.length === 10) return `7${digits}`;
    if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
    return digits;
  }

  private buildPhoneAliases(input: string) {
    const normalized = this.normalizePhone(input);
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

  private validateCustomerPhone(input: string) {
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

  private toMoney(v: Decimal | number | string) {
    const d = v instanceof Decimal ? v : new Decimal(v || 0);
    return new Prisma.Decimal(d.toFixed(2));
  }

  private async ensureSystemEmployeeId() {
    const login = process.env.SHOP_SYSTEM_LOGIN || 'shop.bot';
    const existing = await this.prisma.employee.findUnique({
      where: { login },
      select: { id: true },
    });
    if (existing) return existing.id;

    const pass = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const passwordHash = await bcrypt.hash(pass, 10);

    try {
      const created = await this.prisma.employee.create({
        data: {
          name: 'Shop Bot',
          firstName: 'Shop',
          lastName: 'Bot',
          login,
          passwordHash,
          role: 'MANAGER',
          tenant: 'TECHNOPRIME',
        },
        select: { id: true },
      });
      return created.id;
    } catch {
      const fallback = await this.prisma.employee.findFirst({
        where: { tenant: 'TECHNOPRIME' },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      if (!fallback) {
        throw new BadRequestException('No employees found for order assignment');
      }
      return fallback.id;
    }
  }

  private parsePaymentMethod(method?: string): PaymentMethod {
    const key = String(method || 'CASH').toUpperCase();
    if (key === 'TRANSFER') return PaymentMethod.TRANSFER;
    if (key === 'TRADE_IN') return PaymentMethod.TRADE_IN;
    return PaymentMethod.CASH;
  }

  private describeCancellation(comment?: string | null) {
    if (String(comment || '').includes('[AUTO_RESERVE_EXPIRED]')) {
      return `Не успел оплатить в течение ${this.reserveMinutes} минут`;
    }
    return null;
  }

  private mapOrderForAccount(order: {
    id: number;
    status: OrderStatus;
    source: OrderSource;
    reserveUntil: Date | null;
    date: Date;
    totalPrice: Prisma.Decimal;
    paymentMethod: PaymentMethod;
    comment: string | null;
    manager: { id: number; name: string } | null;
    salesChannel?: string | null;
    fulfillmentMethod?: string | null;
    settlementStatus?: string | null;
    shipment?: {
      id: number;
      carrier: string;
      status: string;
      receiverPoint: string | null;
      expectedDeliveryAt: Date | null;
      handedOverAt: Date | null;
      arrivedAt: Date | null;
      receivedAt: Date | null;
      returnedAt: Date | null;
      customerNote: string | null;
      events?: Array<{
        id: number;
        status: string;
        title: string;
        createdAt: Date;
      }>;
    } | null;
    items: Array<{
      id: number;
      qty: number;
      lineTotal: Prisma.Decimal;
      variantKey: string | null;
      variantLabel: string | null;
      product: { id: number; name: string; slug: string | null; coverImage: string | null } | null;
      inventoryUnits?: Array<{ serialNumber: string | null }>;
    }>;
  }) {
    const reserveUntil = order.reserveUntil ? order.reserveUntil.toISOString() : null;
    const cancellationReason = this.describeCancellation(order.comment);
    const canResumePayment =
      order.source === OrderSource.STORE &&
      order.status === OrderStatus.NEW &&
      Boolean(order.reserveUntil && order.reserveUntil.getTime() > Date.now()) &&
      !String(order.comment || '').includes('[SHOP_LEAD]');

    return {
      id: order.id,
      status: order.status,
      source: order.source,
      reserveUntil,
      date: order.date,
      totalPrice: order.totalPrice,
      paymentMethod: order.paymentMethod,
      manager: order.manager,
      salesChannel: order.salesChannel || null,
      fulfillmentMethod: order.fulfillmentMethod || null,
      settlementStatus: order.settlementStatus || null,
      shipment: order.shipment
        ? {
            id: order.shipment.id,
            carrier: order.shipment.carrier,
            status: order.shipment.status,
            receiverPoint: order.shipment.receiverPoint,
            expectedDeliveryAt: order.shipment.expectedDeliveryAt,
            handedOverAt: order.shipment.handedOverAt,
            arrivedAt: order.shipment.arrivedAt,
            receivedAt: order.shipment.receivedAt,
            returnedAt: order.shipment.returnedAt,
            customerNote: order.shipment.customerNote,
            events: (order.shipment.events || []).map(event => ({
              id: event.id,
              status: event.status,
              title: event.title,
              createdAt: event.createdAt,
            })),
          }
        : null,
      cancellationReason,
      paymentState:
        order.source === OrderSource.STORE
          ? order.status === OrderStatus.COMPLETED
            ? 'PAID'
            : order.status === OrderStatus.NEW
              ? 'AWAITING_PAYMENT'
              : order.status === OrderStatus.CANCELED
                ? 'CANCELED'
                : 'PROCESSING'
          : null,
      canResumePayment,
      paymentUrl: canResumePayment ? `/checkout/payment?orderId=${order.id}` : null,
      items: order.items.map(item => ({
        id: item.id,
        qty: item.qty,
        lineTotal: item.lineTotal,
        variantKey: item.variantKey,
        variantLabel: item.variantLabel,
        serialNumber: item.inventoryUnits?.find(unit => unit.serialNumber)?.serialNumber || null,
        product: item.product,
      })),
    };
  }

  private normalizeVariants(input: unknown): ShopVariant[] {
    if (!Array.isArray(input)) return [];

    const rows: ShopVariant[] = [];
    const usedKeys = new Set<string>();

    for (const raw of input) {
      if (!raw || typeof raw !== 'object') continue;
      const row = raw as Record<string, unknown>;
      const key = String(row.key || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      if (!key || usedKeys.has(key)) continue;

      const label = String(row.label || key).trim();
      const memoryGbRaw = Number(row.memoryGb ?? NaN);
      const memoryGb =
        Number.isFinite(memoryGbRaw) && memoryGbRaw > 0 ? Math.round(memoryGbRaw) : null;
      const price = Number(row.price ?? 0);
      if (!Number.isFinite(price) || price < 0) continue;

      const costPriceRaw = Number(row.costPrice ?? NaN);
      const costPrice = Number.isFinite(costPriceRaw) && costPriceRaw >= 0 ? costPriceRaw : null;
      const stock = Math.max(0, Math.floor(Number(row.stock ?? 0)));
      const inStock = row.inStock !== undefined ? Boolean(row.inStock) : stock > 0;
      const isDefault = Boolean(row.isDefault);

      usedKeys.add(key);
      rows.push({
        key,
        label: label || key.toUpperCase(),
        memoryGb,
        price,
        costPrice,
        stock,
        inStock,
        isDefault,
      });
    }

    if (rows.length > 0 && !rows.some(row => row.isDefault)) {
      rows[0].isDefault = true;
    }

    return rows;
  }

  private resolvePromoPriceForCheckout(params: {
    productPrice: number;
    selectedVariant: ShopVariant | null;
    promo?: ActiveStorePromotion | null;
  }) {
    const promo = params.promo;
    if (!promo) return null;

    if (params.selectedVariant) {
      const promoVariantKey = String(promo.promoVariantKey || '')
        .trim()
        .toLowerCase();
      if (promoVariantKey) {
        return promoVariantKey === params.selectedVariant.key ? promo.promoPrice : null;
      }
      return params.selectedVariant.isDefault ? promo.promoPrice : null;
    }

    return promo.promoPrice;
  }

  private async assertCustomerNotBlocked(customerId: number) {
    const customer = await this.prisma.shopCustomer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        blockedUntil: true,
        isBlocked: true,
      },
    });
    if (!customer) {
      throw new UnauthorizedException('Customer session is invalid');
    }

    if (customer.blockedUntil && customer.blockedUntil > new Date()) {
      throw new BadRequestException(
        `Аккаунт временно ограничен до ${customer.blockedUntil.toLocaleString('ru-RU')}`,
      );
    }

    if (customer.isBlocked && customer.blockedUntil && customer.blockedUntil <= new Date()) {
      await this.prisma.shopCustomer.update({
        where: { id: customerId },
        data: {
          isBlocked: false,
          blockedUntil: null,
          blockReason: null,
        },
      });
    }

    return customer;
  }

  private async applyUnpaidSafetyBlock(customerId: number) {
    const since = new Date(Date.now() - this.unpaidLookbackMs);
    const expiredCount = await this.prisma.order.count({
      where: {
        tenant: 'TECHNOPRIME',
        shopCustomerId: customerId,
        source: OrderSource.STORE,
        status: OrderStatus.CANCELED,
        date: { gte: since },
        comment: { contains: '[AUTO_RESERVE_EXPIRED]' },
      },
    });

    if (expiredCount < this.unpaidLimit) return;

    const blockedUntil = new Date(Date.now() + this.blockHours * 60 * 60 * 1000);
    await this.prisma.shopCustomer.update({
      where: { id: customerId },
      data: {
        blockedUntil,
        isBlocked: true,
        blockReason: `Auto block: ${expiredCount} expired reservations`,
      },
    });

    throw new BadRequestException(
      `Слишком много неоплаченных броней. Аккаунт заблокирован до ${blockedUntil.toLocaleString('ru-RU')}`,
    );
  }

  private async assertReservationHourlyLimits(
    customerId: number,
    requestedItems: CheckoutItemInput[],
  ) {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentOrders = await this.prisma.order.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        shopCustomerId: customerId,
        source: OrderSource.STORE,
        date: { gte: hourAgo },
      },
      select: {
        id: true,
        items: {
          select: {
            productId: true,
            qty: true,
          },
        },
      },
    });

    let usedUnits = 0;
    const usedProducts = new Set<number>();
    for (const order of recentOrders) {
      for (const item of order.items) {
        usedUnits += Number(item.qty || 0);
        usedProducts.add(item.productId);
      }
    }

    const requestedUnits = requestedItems.reduce(
      (sum, item) => sum + Math.max(1, Number(item.qty || 1)),
      0,
    );
    const combinedProducts = new Set<number>(usedProducts);
    for (const item of requestedItems) {
      combinedProducts.add(Number(item.productId));
    }

    if (usedUnits + requestedUnits > this.maxUnitsPerHour) {
      throw new BadRequestException(`Лимит брони: максимум ${this.maxUnitsPerHour} шт. в час`);
    }
    if (combinedProducts.size > this.maxSkusPerHour) {
      throw new BadRequestException(
        `Лимит брони: максимум ${this.maxSkusPerHour} разных товара в час`,
      );
    }
  }

  async checkout(input: CheckoutInput, customerId?: number) {
    if (!customerId) {
      throw new UnauthorizedException('Для оформления заказа нужна авторизация');
    }
    await this.assertCustomerNotBlocked(customerId);
    await this.applyUnpaidSafetyBlock(customerId);

    const phone = this.validateCustomerPhone(input.phone || '');
    if (!Array.isArray(input.items) || !input.items.length) {
      throw new BadRequestException('At least one item is required');
    }

    const itemMap = new Map<string, CheckoutItemInput>();
    for (const raw of input.items) {
      const productId = Number(raw.productId);
      const qty = Math.max(1, Number(raw.qty || 1));
      const variantKeyRaw = String(raw.variantKey || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      const variantKey = variantKeyRaw || null;

      if (productId > 0) {
        const key = `${productId}:${variantKey || ''}`;
        const prev = itemMap.get(key);
        if (prev) {
          prev.qty += qty;
        } else {
          itemMap.set(key, { productId, qty, variantKey });
        }
      }
    }
    if (!itemMap.size) {
      throw new BadRequestException('Invalid items payload');
    }

    const normalizedItems = Array.from(itemMap.values());
    await this.assertReservationHourlyLimits(customerId, normalizedItems);

    const productIds = Array.from(new Set(normalizedItems.map(item => item.productId)));

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenant: 'TECHNOPRIME',
        isActive: true,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        stock: true,
        storefrontCategory: true,
        price: true,
        costPrice: true,
        isAlwaysAvailable: true,
        variants: true,
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('Some products are unavailable');
    }

    const productById = new Map(products.map(product => [product.id, product]));
    const promotions = await this.featured.getActivePromotionMap(productIds);

    const checkoutLines = await Promise.all(
      normalizedItems.map(async item => {
        const product = productById.get(item.productId);
        if (!product) {
          throw new BadRequestException('Some products are unavailable');
        }

        const variants = this.normalizeVariants(product.variants);
        const hasVariants = variants.length > 0;
        const selectedVariant = hasVariants
          ? item.variantKey
            ? variants.find(variant => variant.key === item.variantKey)
            : variants.find(variant => variant.isDefault) || variants[0]
          : null;

        if (hasVariants && !selectedVariant) {
          throw new BadRequestException(`Вариант товара недоступен: ${product.name}`);
        }

        if (!product.isAlwaysAvailable) {
          const availableQty = await this.inventory.countAvailableUnitsForProduct({
            productId: product.id,
            variantKey: selectedVariant?.key,
          });
          if (item.qty > availableQty) {
            throw new BadRequestException(
              `Недостаточно наличия для ${product.name}${selectedVariant ? ` (${selectedVariant.label})` : ''}. Доступно: ${availableQty}`,
            );
          }
        }

        const promoUnitPrice = this.resolvePromoPriceForCheckout({
          productPrice: Number(product.price || 0),
          selectedVariant: selectedVariant ?? null,
          promo: promotions.get(product.id),
        });
        const unitPrice =
          promoUnitPrice !== null
            ? promoUnitPrice
            : selectedVariant
              ? selectedVariant.price
              : Number(product.price || 0);
        const unitCost = selectedVariant
          ? (selectedVariant.costPrice ?? Number(product.costPrice || 0))
          : Number(product.costPrice || 0);

        return {
          item,
          product,
          variants,
          selectedVariant,
          unitPrice,
          unitCost,
        };
      }),
    );

    const createdById = await this.ensureSystemEmployeeId();
    const customerSnapshot = customerId
      ? await this.prisma.shopCustomer.findUnique({
          where: { id: customerId },
          select: {
            phone: true,
            telegramId: true,
            telegramUsername: true,
            vkId: true,
            maxId: true,
            marketingConsent: true,
          },
        })
      : null;

    const resolvedClient = await this.crmSync.upsertClientByPhone({
      phone,
      name: input.name || null,
      city: input.city || null,
      address: input.address || null,
      telegramId: customerSnapshot?.telegramId || null,
      telegramUsername: customerSnapshot?.telegramUsername || null,
      vkId: customerSnapshot?.vkId || null,
      maxId: customerSnapshot?.maxId || null,
      marketingConsent:
        customerSnapshot?.marketingConsent !== undefined
          ? Boolean(customerSnapshot.marketingConsent)
          : undefined,
    });
    if (!resolvedClient) {
      throw new BadRequestException('Failed to sync customer with CRM');
    }

    const paymentMethod = this.parsePaymentMethod(input.paymentMethod);

    const createdOrder = await this.prisma.$transaction(async tx => {
      let totalPrice = new Decimal(0);
      let costPrice = new Decimal(0);

      const order = await tx.order.create({
        data: {
          tenant: 'TECHNOPRIME',
          clientId: resolvedClient.id,
          shopCustomerId: customerId,
          createdById,
          managerId: null,
          status: OrderStatus.NEW,
          source: OrderSource.STORE,
          reserveUntil: new Date(Date.now() + this.reserveMinutes * 60 * 1000),
          paymentMethod,
          totalPrice: this.toMoney(0),
          costPrice: this.toMoney(0),
          profit: this.toMoney(0),
          comment: `${input.comment || 'Создано через витрину магазина'} [SOURCE:STORE]`,
          date: new Date(),
        },
        select: { id: true, reserveUntil: true },
      });

      for (const line of checkoutLines) {
        const qty = Math.max(1, Number(line.item.qty || 1));

        const up = new Decimal(line.unitPrice || 0);
        const uc = new Decimal(line.unitCost || 0);
        const lineTotal = up.mul(qty);
        const lineCost = uc.mul(qty);
        totalPrice = totalPrice.add(lineTotal);
        costPrice = costPrice.add(lineCost);

        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: line.product.id,
            variantKey: line.selectedVariant?.key || null,
            variantLabel: line.selectedVariant?.label || null,
            qty,
            unitPrice: this.toMoney(up),
            unitCost: this.toMoney(uc),
            lineTotal: this.toMoney(lineTotal),
            lineCost: this.toMoney(lineCost),
          },
        });

        if (!line.product.isAlwaysAvailable) {
          await this.inventory.consumeAvailableUnits(tx, {
            productId: line.product.id,
            qty,
            orderId: order.id,
            orderItemId: orderItem.id,
            variantKey: line.selectedVariant?.key,
            salePriceOverride: up,
            mode: 'RESERVE',
          });
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          totalPrice: this.toMoney(totalPrice),
          costPrice: this.toMoney(costPrice),
          profit: this.toMoney(totalPrice.sub(costPrice)),
        },
      });

      return order;
    });

    await this.shopTelegramCrm.notifyNewOrder(createdOrder.id).catch(error => {
      this.logger.warn(`Telegram order notification failed: ${String(error)}`);
    });

    return {
      success: true,
      orderId: createdOrder.id,
      reserveUntil: createdOrder.reserveUntil?.toISOString() || null,
      paymentUrl: `/checkout/payment?orderId=${createdOrder.id}`,
    };
  }

  async createLeaveLead(input: LeaveLeadInput, customerId?: number) {
    if (!customerId) {
      throw new UnauthorizedException('Для отправки заявки нужна авторизация');
    }

    await this.assertCustomerNotBlocked(customerId);

    const productId = Number(input.productId);
    if (!productId) {
      throw new BadRequestException('productId is required');
    }

    const phone = this.validateCustomerPhone(input.phone || '');

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        price: true,
        costPrice: true,
        tenant: true,
      },
    });
    if (!product || product.tenant !== 'TECHNOPRIME') {
      throw new BadRequestException('Товар не найден');
    }

    const createdById = await this.ensureSystemEmployeeId();
    const customerSnapshot = customerId
      ? await this.prisma.shopCustomer.findUnique({
          where: { id: customerId },
          select: {
            phone: true,
            telegramId: true,
            telegramUsername: true,
            vkId: true,
            maxId: true,
            marketingConsent: true,
          },
        })
      : null;

    const resolvedClient = await this.crmSync.upsertClientByPhone({
      phone,
      name: input.name || null,
      city: input.city || null,
      address: input.address || null,
      telegramId: customerSnapshot?.telegramId || null,
      telegramUsername: customerSnapshot?.telegramUsername || null,
      vkId: customerSnapshot?.vkId || null,
      maxId: customerSnapshot?.maxId || null,
      marketingConsent:
        customerSnapshot?.marketingConsent !== undefined
          ? Boolean(customerSnapshot.marketingConsent)
          : undefined,
    });
    if (!resolvedClient) {
      throw new BadRequestException('Failed to sync customer with CRM');
    }

    const totalPrice = this.toMoney(product.price || 0);
    const costPrice = this.toMoney(product.costPrice || 0);
    const createdOrder = await this.prisma.order.create({
      data: {
        tenant: 'TECHNOPRIME',
        source: OrderSource.STORE,
        status: OrderStatus.NEW,
        clientId: resolvedClient.id,
        shopCustomerId: customerId || null,
        managerId: null,
        createdById,
        paymentMethod: PaymentMethod.CASH,
        totalPrice,
        costPrice,
        profit: totalPrice.minus(costPrice),
        comment: formatShopLeadComment({
          product: `${product.name} (#${product.id})`,
          price: `${new Decimal(product.price || 0).toFixed(2)} ₽`,
          requestedPhone: phone,
          city: input.city || null,
          address: input.address || null,
          comment: input.comment || null,
          accountPhone: customerSnapshot?.phone || null,
        }),
        items: {
          create: {
            productId: product.id,
            qty: 1,
            unitPrice: totalPrice,
            unitCost: costPrice,
            lineTotal: totalPrice,
            lineCost: costPrice,
          },
        },
      },
      select: { id: true },
    });

    await this.shopTelegramCrm.notifyNewLead(createdOrder.id).catch(error => {
      this.logger.warn(`Telegram lead notification failed: ${String(error)}`);
    });

    return {
      success: true,
      orderId: createdOrder.id,
      message: 'Заявка отправлена менеджеру',
    };
  }

  @Cron('*/1 * * * *')
  async expireStoreReservations() {
    const now = new Date();
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        source: OrderSource.STORE,
        status: OrderStatus.NEW,
        reserveUntil: { lt: now },
      },
      select: {
        id: true,
        comment: true,
      },
      take: 100,
    });

    if (expiredOrders.length) {
      for (const order of expiredOrders) {
        try {
          await this.prisma.$transaction(async tx => {
            const lock = await tx.order.updateMany({
              where: {
                id: order.id,
                status: OrderStatus.NEW,
                source: OrderSource.STORE,
              },
              data: {
                status: OrderStatus.CANCELED,
                comment: `${order.comment || ''}\n[AUTO_RESERVE_EXPIRED]`.trim(),
              },
            });

            if (!lock.count) return;

            await this.inventory.releaseOrderUnits(tx, order.id, 'RESERVED_ONLY');
            await tx.task.deleteMany({
              where: {
                orderId: order.id,
              },
            });

            this.logger.warn(`Order #${order.id} auto-canceled: reserve expired`);
          });
        } catch (error) {
          this.logger.error(`Failed to expire order #${order.id}`, error);
        }
      }
    }

    await this.cleanupCanceledStoreTasks();
  }

  private async cleanupCanceledStoreTasks() {
    const staleTasks = await this.prisma.task.findMany({
      where: {
        order: {
          tenant: 'TECHNOPRIME',
          source: OrderSource.STORE,
          status: OrderStatus.CANCELED,
        },
      },
      select: {
        id: true,
      },
      take: 100,
    });

    if (!staleTasks.length) return 0;

    const deleted = await this.prisma.task.deleteMany({
      where: {
        id: { in: staleTasks.map(task => task.id) },
      },
    });

    if (deleted.count) {
      this.logger.warn(`Cleaned ${deleted.count} stale tasks for canceled store orders`);
    }

    return deleted.count;
  }

  async myOrders(customerId?: number) {
    if (!customerId) {
      throw new UnauthorizedException('Not authorized');
    }

    const directOrders = await this.prisma.order.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        shopCustomerId: customerId,
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                coverImage: true,
              },
            },
            inventoryUnits: {
              select: {
                serialNumber: true,
              },
            },
          },
        },
        manager: {
          select: { id: true, name: true },
        },
        shipment: {
          include: {
            events: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, status: true, title: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });

    if (directOrders.length) {
      return {
        items: directOrders.map(order => this.mapOrderForAccount(order as any)),
      };
    }

    const customer = await this.prisma.shopCustomer.findUnique({
      where: { id: customerId },
      select: { id: true, phone: true },
    });
    if (!customer?.phone) {
      return { items: [] };
    }

    const phoneAliases = this.buildPhoneAliases(customer.phone);
    if (!phoneAliases.length) {
      return { items: [] };
    }

    const clients = await this.prisma.client.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        phone: { in: phoneAliases },
      },
      select: { id: true },
    });

    if (!clients.length) {
      return { items: [] };
    }

    const orders = await this.prisma.order.findMany({
      where: {
        tenant: 'TECHNOPRIME',
        clientId: { in: clients.map(c => c.id) },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                coverImage: true,
              },
            },
            inventoryUnits: {
              select: {
                serialNumber: true,
              },
            },
          },
        },
        manager: {
          select: { id: true, name: true },
        },
        shipment: {
          include: {
            events: {
              orderBy: { createdAt: 'asc' },
              select: { id: true, status: true, title: true, createdAt: true },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
      take: 100,
    });

    return {
      items: orders.map(order => this.mapOrderForAccount(order as any)),
    };
  }

  async myOrder(orderId: number, customerId?: number) {
    if (!orderId || Number.isNaN(orderId)) {
      throw new BadRequestException('orderId is required');
    }

    const payload = await this.myOrders(customerId);
    const item = payload.items.find(order => order.id === orderId) || null;
    if (!item) {
      throw new UnauthorizedException('Order not found');
    }
    return item;
  }
}
