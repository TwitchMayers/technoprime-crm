import { Module, Logger } from '@nestjs/common';
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

// RichMarket modules
import { RichMarketClientsModule } from './richmarket/clients/richmarket-clients.module';
import { RichMarketProductsModule } from './richmarket/products/richmarket-products.module';
import { RichMarketOrdersModule } from './richmarket/orders/richmarket-orders.module';
import { RichMarketTasksModule } from './richmarket/tasks/richmarket-tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    EmployeesModule,
    EventsModule,
    
    // TechnoPrime modules - ВАЖНО: порядок может иметь значение
    ClientsModule,           // Проверьте что этот модуль работает
    ProductsModule,          // Проверьте что этот модуль работает  
    OrdersModule,            // Проверьте что этот модуль работает
    TasksModule,             // Проверьте что этот модуль работает
    SubscriptionsModule,     // Проверьте что этот модуль работает
    AnalyticsModule,
    AdSpendModule,
    NotificationsModule,
    InventoryModule,
    SharingSystemsModule,    // НОВЫЙ МОДУЛЬ - ДОЛЖЕН БЫТЬ ПОСЛЕДНИМ
    
    // RichMarket modules
    RichMarketClientsModule,
    RichMarketProductsModule,
    RichMarketOrdersModule,
    RichMarketTasksModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, Logger],
  exports: [PrismaService], // Экспортируем PrismaService для других модулей
})
export class AppModule {}