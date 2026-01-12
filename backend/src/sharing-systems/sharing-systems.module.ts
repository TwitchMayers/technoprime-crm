import { Module } from '@nestjs/common';
import { SharingSystemsService } from './sharing-systems.service';
import { SharingSystemsController } from './sharing-systems.controller';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [SharingSystemsController], // ТОЛЬКО ОСНОВНОЙ КОНТРОЛЛЕР
  providers: [SharingSystemsService, PrismaService],
  exports: [SharingSystemsService],
})
export class SharingSystemsModule {}