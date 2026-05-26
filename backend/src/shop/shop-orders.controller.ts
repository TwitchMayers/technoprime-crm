import { Body, Controller, Get, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ShopAuthService } from './shop-auth.service';
import { ShopOrdersService } from './shop-orders.service';
import { LogisticsService } from '../logistics/logistics.service';

@ApiTags('shop-orders')
@Controller('shop/orders')
export class ShopOrdersController {
  constructor(
    private readonly shopOrders: ShopOrdersService,
    private readonly shopAuth: ShopAuthService,
    private readonly logistics: LogisticsService,
  ) {}

  private getSessionId(req: Request) {
    const cookie = req.headers.cookie;
    if (!cookie) return undefined;
    const part = cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('shop_session='));
    return part?.split('=')[1];
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Оформление заказа из витрины' })
  @ApiResponse({ status: 200 })
  async checkout(@Body() body: any, @Req() req: Request) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);
    return this.shopOrders.checkout(body, session?.customerId);
  }

  @Post('lead')
  @ApiOperation({ summary: 'Оставить заявку на товар (под заказ)' })
  @ApiResponse({ status: 200 })
  async leaveLead(@Body() body: any, @Req() req: Request) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);
    return this.shopOrders.createLeaveLead(body, session?.customerId);
  }

  @Get('my')
  @ApiOperation({ summary: 'История заказов текущего клиента' })
  @ApiResponse({ status: 200 })
  async myOrders(@Req() req: Request) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);
    return this.shopOrders.myOrders(session?.customerId);
  }

  @Get('my/:id')
  @ApiOperation({ summary: 'Один заказ текущего клиента' })
  @ApiResponse({ status: 200 })
  async myOrder(@Req() req: Request, @Param('id') id: string) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);
    return this.shopOrders.myOrder(Number(id), session?.customerId);
  }

  @Post('link')
  @ApiOperation({ summary: 'Привязать заказ к текущему личному кабинету по одноразовой ссылке' })
  @ApiResponse({ status: 200 })
  async linkOrder(@Body() body: any, @Req() req: Request) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);
    if (!session?.customerId) {
      throw new UnauthorizedException('Войдите в личный кабинет, чтобы привязать заказ');
    }
    return this.logistics.claimOrderByToken(String(body?.token || ''), session.customerId);
  }
}
