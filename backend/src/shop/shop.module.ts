import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ShopProductsController } from './shop-products.controller';
import { ShopProductsService } from './shop-products.service';
import { ShopApiGuard } from './shop-api.guard';
import { ShopAuthController } from './shop-auth.controller';
import { ShopAuthService } from './shop-auth.service';
import { ShopFeaturedService } from './shop-featured.service';
import { ShopFeaturedController } from './shop-featured.controller';
import { ShopFeaturedAdminController } from './shop-featured-admin.controller';
import { ShopOrdersController } from './shop-orders.controller';
import { ShopOrdersService } from './shop-orders.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ShopTelegramController } from './shop-telegram.controller';
import { ShopTelegramCrmService } from './shop-telegram-crm.service';
import { ShopCrmSyncService } from './shop-crm-sync.service';
import { ShopAccountController } from './shop-account.controller';
import { ShopAccountService } from './shop-account.service';
import { EventsModule } from '../events/events.module';
import { ShopVkController } from './shop-vk.controller';
import { ShopVkService } from './shop-vk.service';
import { CommunicationModule } from '../communication/communication.module';
import { LogisticsModule } from '../logistics/logistics.module';

@Module({
  imports: [InventoryModule, EventsModule, CommunicationModule, LogisticsModule],
  controllers: [
    ShopProductsController,
    ShopAuthController,
    ShopFeaturedController,
    ShopFeaturedAdminController,
    ShopOrdersController,
    ShopTelegramController,
    ShopAccountController,
    ShopVkController,
  ],
  providers: [
    ShopProductsService,
    ShopAuthService,
    ShopFeaturedService,
    ShopOrdersService,
    ShopTelegramCrmService,
    ShopCrmSyncService,
    ShopAccountService,
    ShopVkService,
    ShopApiGuard,
    PrismaService,
  ],
})
export class ShopModule {}
