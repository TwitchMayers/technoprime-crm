import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { EventsService } from './events.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [AuthModule],
  providers: [EventsGateway, EventsService, PrismaService],
  exports: [EventsService],
})
export class EventsModule {}
