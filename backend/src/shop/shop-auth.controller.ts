import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShopAuthService } from './shop-auth.service';
import type { Request, Response } from 'express';
import { CustomThrottlerGuard } from '../common/guards/throttle.guard';

@ApiTags('shop-auth')
@Controller('shop/auth')
@UseGuards(CustomThrottlerGuard)
export class ShopAuthController {
  constructor(private readonly shopAuth: ShopAuthService) {}

  private getSessionId(req: Request) {
    const cookie = req.headers.cookie;
    if (!cookie) return undefined;
    const part = cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith('shop_session='));
    return part?.split('=')[1];
  }

  private setSessionCookie(res: Response, sessionId: string) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('shop_session', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 24 * Number(process.env.SHOP_SESSION_TTL_DAYS || 30),
      path: '/',
    });
  }

  @Post('phone/request')
  @ApiOperation({ summary: 'Запросить код по телефону' })
  @ApiResponse({ status: 200 })
  async requestCode(@Body() body: { phone: string }, @Req() req: Request) {
    return this.shopAuth.requestPhoneCode(body.phone || '', {
      ip: req?.headers?.['x-forwarded-for'] || req?.ip || req?.socket?.remoteAddress || null,
      userAgent: req?.headers?.['user-agent'] || null,
      source: req?.headers?.origin || req?.headers?.referer || null,
    });
  }

  @Post('phone/verify')
  @ApiOperation({ summary: 'Подтвердить код по телефону' })
  @ApiResponse({ status: 200 })
  async verifyCode(
    @Body() body: { phone: string; code: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const customer = await this.shopAuth.verifyPhoneCode(body.phone || '', body.code || '');
    if (!customer) {
      return { success: false, message: 'Неверный код' };
    }

    const session = await this.shopAuth.createSession(customer.id);
    this.setSessionCookie(res, session.id);

    return { success: true, customer };
  }

  @Get('phone/status')
  @ApiOperation({ summary: 'Проверить статус входа по телефону' })
  @ApiResponse({ status: 200 })
  async phoneStatus(
    @Query('phone') phone: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const status = await this.shopAuth.getPhoneAuthStatus(String(phone || ''));
    if (status?.verified && status?.customer?.id) {
      const session = await this.shopAuth.createSession(status.customer.id);
      this.setSessionCookie(res, session.id);
    }
    return status;
  }

  @Post('phone/callback')
  @ApiOperation({ summary: 'Callback провайдера подтверждения звонком' })
  @ApiResponse({ status: 200 })
  async phoneCallback(@Body() body: Record<string, string | number | null>) {
    return this.shopAuth.confirmWaitcall(body || {});
  }

  @Get('phone/callback')
  @ApiOperation({ summary: 'GET callback провайдера подтверждения звонком' })
  @ApiResponse({ status: 200 })
  async phoneCallbackGet(@Query() query: Record<string, string | number | null>) {
    return this.shopAuth.confirmWaitcall(query || {});
  }

  @Post('telegram')
  @ApiOperation({ summary: 'Вход через Telegram' })
  @ApiResponse({ status: 200 })
  async loginTelegram(
    @Body() payload: Record<string, string>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const customer = await this.shopAuth.loginWithTelegram(payload);
    if (!customer) {
      return { success: false, message: 'Telegram auth failed' };
    }

    const session = await this.shopAuth.createSession(customer.id);
    this.setSessionCookie(res, session.id);

    return { success: true, customer };
  }

  @Get('vk/start')
  @ApiOperation({ summary: 'Сформировать OAuth URL для входа/привязки VK' })
  @ApiResponse({ status: 200 })
  async vkStart(
    @Query('mode') modeParam: string | undefined,
    @Query('redirectUri') redirectUri: string | undefined,
  ) {
    const mode = modeParam === 'link' ? 'link' : 'login';
    return this.shopAuth.createVkAuthUrl(mode, String(redirectUri || ''));
  }

  @Post('vk/callback')
  @ApiOperation({ summary: 'Завершить OAuth VK (вход/привязка)' })
  @ApiResponse({ status: 200 })
  async vkCallback(
    @Body() body: { code?: string; state?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);

    const result = await this.shopAuth.completeVkAuth({
      code: String(body?.code || ''),
      state: String(body?.state || ''),
      currentCustomerId: session?.customerId || null,
    });

    if (result?.shouldCreateSession && result?.customer?.id) {
      const newSession = await this.shopAuth.createSession(result.customer.id);
      this.setSessionCookie(res, newSession.id);
    }

    return result;
  }

  @Post('vk/callback-token')
  @ApiOperation({ summary: 'Завершить OAuth VK по access_token (implicit flow)' })
  @ApiResponse({ status: 200 })
  async vkCallbackToken(
    @Body() body: { accessToken?: string; state?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);

    const result = await this.shopAuth.completeVkAuthByAccessToken({
      accessToken: String(body?.accessToken || ''),
      state: String(body?.state || ''),
      currentCustomerId: session?.customerId || null,
    });

    if (result?.shouldCreateSession && result?.customer?.id) {
      const newSession = await this.shopAuth.createSession(result.customer.id);
      this.setSessionCookie(res, newSession.id);
    }

    return result;
  }

  @Get('me')
  @ApiOperation({ summary: 'Текущий клиент магазина' })
  async me(@Req() req: Request) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);
    if (!session) {
      return { user: null };
    }

    return { user: session.customer };
  }

  @Post('logout')
  @ApiOperation({ summary: 'Выход из магазина' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = this.getSessionId(req);
    if (sessionId) {
      await this.shopAuth.revokeSession(sessionId);
    }

    res.cookie('shop_session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      path: '/',
    });

    return { success: true };
  }

  @Post('logout-all')
  @ApiOperation({ summary: 'Выход со всех устройств' })
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);
    if (session?.customerId) {
      await this.shopAuth.revokeAllSessions(session.customerId);
    }

    res.cookie('shop_session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0,
      path: '/',
    });

    return { success: true };
  }
}
