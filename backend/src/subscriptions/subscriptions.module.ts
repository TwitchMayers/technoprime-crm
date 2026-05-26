import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PrismaService } from '../prisma.service';
import { EventsModule } from '../events/events.module';
import { CommunicationModule } from '../communication/communication.module';

@Module({
  imports: [EventsModule, CommunicationModule],
  providers: [SubscriptionsService, PrismaService],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
