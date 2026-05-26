import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { PrismaService } from '../prisma.service';
import { CommunicationModule } from '../communication/communication.module';
import { EventsModule } from '../events/events.module';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  imports: [CommunicationModule, EventsModule],
  controllers: [ClientsController],
  providers: [ClientsService, PrismaService, RolesGuard],
  exports: [ClientsService],
})
export class ClientsModule {}
