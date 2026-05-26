import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { PrismaService } from '../prisma.service';
import { RolesGuard } from '../auth/roles.guard';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, PrismaService, RolesGuard],
  exports: [EmployeesService],
})
export class EmployeesModule {}
