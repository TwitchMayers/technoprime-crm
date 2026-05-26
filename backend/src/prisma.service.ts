import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    await this.ensureRuntimeCompatibility();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Если хочешь, чтобы приложение корректно завершалось вместе с Prisma
  enableShutdownHooks(app: INestApplication) {
    process.on('beforeExit', async () => {
      await app.close();
    });
  }

  private async ensureRuntimeCompatibility() {
    const envToggle = String(process.env.PRISMA_RUNTIME_PATCHES_ENABLED || '')
      .trim()
      .toLowerCase();
    const patchesEnabled = envToggle
      ? ['1', 'true', 'yes', 'on'].includes(envToggle)
      : process.env.NODE_ENV !== 'production';

    if (!patchesEnabled) {
      return;
    }

    // Compatibility patch for older local databases:
    // add WEBSITE channel and read receipts column if migrations were not applied.
    try {
      await this.$executeRawUnsafe(
        `ALTER TYPE "CommunicationChannel" ADD VALUE IF NOT EXISTS 'WEBSITE'`,
      );
    } catch (error) {
      console.warn(
        'Prisma compatibility patch (CommunicationChannel.WEBSITE) skipped:',
        String(error),
      );
    }

    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "ClientCommunicationLog" ADD COLUMN IF NOT EXISTS "readByCustomerAt" TIMESTAMP(3)`,
      );
    } catch (error) {
      console.warn(
        'Prisma compatibility patch (ClientCommunicationLog.readByCustomerAt) skipped:',
        String(error),
      );
    }

    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "InventoryUnit" ADD COLUMN IF NOT EXISTS "previousSalePrice" DECIMAL(10, 2)`,
      );
    } catch (error) {
      console.warn(
        'Prisma compatibility patch (InventoryUnit.previousSalePrice) skipped:',
        String(error),
      );
    }

    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "ShopFeaturedItem" ADD COLUMN IF NOT EXISTS "promoVariantKey" TEXT`,
      );
      await this.$executeRawUnsafe(
        `ALTER TABLE "ShopFeaturedItem" ADD COLUMN IF NOT EXISTS "promoVariantLabel" TEXT`,
      );
    } catch (error) {
      console.warn(
        'Prisma compatibility patch (ShopFeaturedItem promo variant fields) skipped:',
        String(error),
      );
    }

    try {
      await this.$executeRawUnsafe(
        `UPDATE "Product"
         SET "isArchived" = true
         WHERE "isActive" = false
           AND "archivedAt" IS NOT NULL
           AND COALESCE("isArchived", false) = false`,
      );
    } catch (error) {
      console.warn(
        'Prisma compatibility patch (Product.isArchived backfill) skipped:',
        String(error),
      );
    }
  }
}
