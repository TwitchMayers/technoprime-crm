import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { ClientsModule } from './clients/clients.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { TasksModule } from './tasks/tasks.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    EmployeesModule,
    ClientsModule,
    ProductsModule,
    OrdersModule,
    TasksModule,
    SubscriptionsModule,
    NotificationsModule,
    EventsModule,
  ],
})
export class AppModule {}