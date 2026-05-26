import { Body, Controller, ForbiddenException, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ShopAuthService } from './shop-auth.service';
import { ShopAccountService } from './shop-account.service';
import { ShopVkService } from './shop-vk.service';

@ApiTags('shop-account')
@Controller('shop/account')
export class ShopAccountController {
  constructor(
    private readonly shopAuth: ShopAuthService,
    private readonly shopAccount: ShopAccountService,
    private readonly shopVk: ShopVkService,
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

  private async getCustomerId(req: Request) {
    const sessionId = this.getSessionId(req);
    const session = await this.shopAuth.getSession(sessionId);
    return session?.customerId;
  }

  @Get('overview')
  @ApiOperation({ summary: 'Профиль, привязки и подписки текущего клиента' })
  @ApiResponse({ status: 200 })
  async overview(@Req() req: Request) {
    const customerId = await this.getCustomerId(req);
    if (!customerId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.shopAccount.getOverview(customerId);
  }

  @Get('instructions')
  @ApiOperation({ summary: 'Инструкции по купленным платформам текущего клиента' })
  @ApiResponse({ status: 200 })
  async instructions(@Req() req: Request) {
    const customerId = await this.getCustomerId(req);
    if (!customerId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.shopAccount.getAccessibleInstructions(customerId);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Обновить профиль клиента магазина' })
  @ApiResponse({ status: 200 })
  async updateProfile(
    @Req() req: Request,
    @Body()
    body: {
      firstName?: string | null;
      lastName?: string | null;
      birthDate?: string | null;
      deliveryCity?: string | null;
      deliveryAddress?: string | null;
      notifyOrderStatus?: boolean;
      notifySubscription?: boolean;
      notifyService?: boolean;
      notifyMarketing?: boolean;
      marketingConsent?: boolean;
    },
  ) {
    const customerId = await this.getCustomerId(req);
    if (!customerId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.shopAccount.updateProfile(customerId, body || {});
  }

  @Post('linked/telegram/unlink')
  @ApiOperation({ summary: 'Отвязать Telegram от аккаунта магазина' })
  @ApiResponse({ status: 200 })
  async unlinkTelegram(@Req() req: Request) {
    const customerId = await this.getCustomerId(req);
    if (!customerId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.shopAccount.unlinkTelegram(customerId);
  }

  @Post('linked/vk/unlink')
  @ApiOperation({ summary: 'Отвязать VK от аккаунта магазина' })
  @ApiResponse({ status: 200 })
  async unlinkVk(@Req() req: Request) {
    const customerId = await this.getCustomerId(req);
    if (!customerId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.shopAccount.unlinkVk(customerId);
  }

  @Post('linked/vk/code')
  @ApiOperation({ summary: 'Создать одноразовый код привязки VK для текущего клиента' })
  @ApiResponse({ status: 200 })
  async createVkLinkCode(@Req() req: Request) {
    const customerId = await this.getCustomerId(req);
    if (!customerId) {
      throw new ForbiddenException('Not authorized');
    }

    return this.shopVk.createVkLinkCode(customerId);
  }

  @Post('cookie-consent')
  @ApiOperation({ summary: 'Сохранить выбор cookies-consent' })
  @ApiResponse({ status: 200 })
  async saveCookieConsent(
    @Req() req: Request,
    @Body() body: { analytics?: boolean; version?: string },
  ) {
    const customerId = await this.getCustomerId(req);
    return this.shopAccount.saveCookieConsent(customerId, body || {});
  }

  @Get('consultation/history')
  @ApiOperation({ summary: 'История диалога консультации для текущего клиента' })
  @ApiResponse({ status: 200 })
  async consultationHistory(@Req() req: Request) {
    const customerId = await this.getCustomerId(req);
    if (!customerId) {
      throw new ForbiddenException('Not authorized');
    }
    return this.shopAccount.getConsultationHistory(customerId);
  }

  @Post('consultation/messages')
  @ApiOperation({ summary: 'Отправить сообщение менеджеру из диалога консультации' })
  @ApiResponse({ status: 200 })
  async consultationMessage(@Req() req: Request, @Body() body: { text?: string | null }) {
    const customerId = await this.getCustomerId(req);
    if (!customerId) {
      throw new ForbiddenException('Not authorized');
    }
    return this.shopAccount.sendConsultationMessage(customerId, body || {});
  }
}
