import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LogisticsService } from './logistics.service';

@Controller('logistics/oauth')
export class LogisticsOAuthController {
  constructor(private readonly logistics: LogisticsService) {}

  @Post('avito/start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  startAvito(@Body() body: any, @Req() req: any) {
    return this.logistics.startAvitoOAuth(body, req.user);
  }

  @Get('avito/callback')
  async avitoCallback(@Query() query: any, @Res() res: Response) {
    const result = await this.logistics.completeAvitoOAuth(query);
    res
      .status(result.ok ? 200 : 400)
      .type('html')
      .send(
        this.logistics.renderOAuthCallbackPage({
          ok: result.ok,
          title: result.title,
          message: result.message,
          redirectUrl: result.redirectUrl,
        }),
      );
  }
}
