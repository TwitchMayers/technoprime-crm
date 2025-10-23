import { Controller, Get, Req, Query } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Request } from 'express';

@Controller('employees')
export class EmployeesController {
  constructor(private svc: EmployeesService) {}

  @Get('me')
  me(@Req() req: Request & { user?: any }) {
    return this.svc.me(req.user?.id);
  }

  @Get('me/metrics')
  metrics(@Req() req: Request & { user?: any }, @Query('period') period?: 'today' | 'month') {
    return this.svc.metrics(req.user?.id, period || 'today');
  }
}