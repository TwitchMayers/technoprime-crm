import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Position, Role } from '@prisma/client';

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private svc: EmployeesService) {}

  @Get('me')
  me(@Req() req: Request & { user?: any }) {
    return this.svc.me(req.user?.id);
  }

  @Get('me/metrics')
  metrics(
    @Req() req: Request & { user?: any },
    @Query('period') period?: 'today' | 'week' | 'month' | 'year',
  ) {
    return this.svc.metrics(req.user?.id, period || 'today');
  }

  @Get('me/shift')
  meShift(@Req() req: Request & { user?: any }) {
    return this.svc.meShift(req.user?.id);
  }

  @Post('me/shift/start')
  startShift(@Req() req: Request & { user?: any }) {
    return this.svc.startShift(req.user?.id);
  }

  @Post('me/shift/end')
  endShift(@Req() req: Request & { user?: any }) {
    return this.svc.endShift(req.user?.id);
  }

  @Get('me/earnings')
  meEarnings(
    @Req() req: Request & { user?: any },
    @Query('period') period?: 'today' | 'week' | 'month' | 'year',
  ) {
    return this.svc.meEarnings(req.user?.id, period || 'today');
  }

  @Get('admin/overview')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  adminOverview(
    @Req() req: Request & { user?: any },
    @Query('period') period?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.svc.adminOverview(
      period,
      includeInactive === '1' || includeInactive === 'true',
      req.user,
    );
  }

  @Get('admin/activity')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  adminActivity(
    @Req() req: Request & { user?: any },
    @Query('period') period?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.svc.adminActivity(period, employeeId ? Number(employeeId) : undefined, req.user);
  }

  @Get('admin/completed-orders')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  completedOrders(
    @Req() req: Request & { user?: any },
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.svc.adminCompletedOrders(Number(limit || 60), q, req.user);
  }

  @Post('admin/sales-credit')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  addSalesCredit(
    @Req() req: Request & { user?: any },
    @Body()
    body: {
      employeeId: number;
      orderId?: number | null;
      quantity?: number;
      note?: string;
      amount?: number;
    },
  ) {
    return this.svc.addSalesCredit(
      {
        employeeId: Number(body?.employeeId || 0),
        orderId: body?.orderId == null ? null : Number(body.orderId),
        quantity: Number(body?.quantity || 1),
        note: body?.note,
        amount: body?.amount == null ? undefined : Number(body.amount),
      },
      req.user,
    );
  }

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  createEmployee(
    @Req() req: Request & { user?: any },
    @Body()
    body: {
      login: string;
      password: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      phone?: string;
      role?: Role;
      position?: Position;
    },
  ) {
    return this.svc.createEmployee(body, req.user);
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  deactivateEmployee(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.deactivateEmployee(Number(id), req.user);
  }

  @Patch('admin/:id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  restoreEmployee(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.restoreEmployee(Number(id), req.user);
  }
}
