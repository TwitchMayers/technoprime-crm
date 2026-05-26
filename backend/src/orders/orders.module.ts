import { Module, forwardRef } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from '../prisma.service';
import { EventsModule } from '../events/events.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { SharingSystemsModule } from '../sharing-systems/sharing-systems.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ShopCrmSyncService } from '../shop/shop-crm-sync.service';

@Module({
  imports: [
    EventsModule,
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => SharingSystemsModule),
    InventoryModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService, ShopCrmSyncService],
  exports: [OrdersService],
})
export class OrdersModule {}
