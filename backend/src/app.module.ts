import { Module, Logger } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { EventsModule } from './events/events.module';
import { SharingSystemsModule } from './sharing-systems/sharing-systems.module';

// TechnoPrime modules
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { TasksModule } from './tasks/tasks.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdSpendModule } from './ad-spend/ad-spend.module';
import { NotificationsModule } from './notifications/notifications.module';
import { InventoryModule } from './inventory/inventory.module';
import { MarketingCampaignsModule } from './marketing-campaigns/marketing-campaigns.module';
import { ShopModule } from './shop/shop.module';
import { LogisticsModule } from './logistics/logistics.module';
import { InstructionsModule } from './instructions/instructions.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'production'
          ? ['.env.production', '.env']
          : ['.env.development', '.env'],
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    EmployeesModule,
    EventsModule,

    // TechnoPrime modules - ВАЖНО: порядок может иметь значение
    ClientsModule, // Проверьте что этот модуль работает
    ProductsModule, // Проверьте что этот модуль работает
    OrdersModule, // Проверьте что этот модуль работает
    TasksModule, // Проверьте что этот модуль работает
    SubscriptionsModule, // Проверьте что этот модуль работает
    AnalyticsModule,
    AdSpendModule,
    NotificationsModule,
    InventoryModule,
    LogisticsModule,
    MarketingCampaignsModule,
    InstructionsModule,
    SharingSystemsModule, // НОВЫЙ МОДУЛЬ - ДОЛЖЕН БЫТЬ ПОСЛЕДНИМ

    // Public storefront API
    ShopModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    Logger,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [PrismaService], // Экспортируем PrismaService для других модулей
})
export class AppModule {}
