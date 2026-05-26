import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShopTelegramCrmService } from './shop-telegram-crm.service';

@ApiTags('shop-telegram')
@Controller('shop/telegram')
export class ShopTelegramController {
  constructor(private readonly telegramCrm: ShopTelegramCrmService) {}

  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook для Telegram CRM-бота' })
  @ApiResponse({ status: 200 })
  async webhook(@Body() body: any, @Headers('x-telegram-bot-api-secret-token') secret?: string) {
    this.telegramCrm.validateWebhookSecret(secret);

    // Telegram expects a fast 200 response from webhook endpoint.
    // Process update asynchronously to avoid timeouts on heavy updates.
    void this.telegramCrm.processWebhookAsync(body).catch(error => {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[shop-telegram] webhook update failed: ${reason}`);
    });

    return { ok: true };
  }
}
