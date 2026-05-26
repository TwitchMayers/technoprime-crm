import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { InstructionsController } from './instructions.controller';
import { InstructionsService } from './instructions.service';

@Module({
  controllers: [InstructionsController],
  providers: [InstructionsService, PrismaService],
  exports: [InstructionsService],
})
export class InstructionsModule {}
