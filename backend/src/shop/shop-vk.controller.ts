import { Body, Controller, Get, Header, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShopVkService } from './shop-vk.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('shop-vk')
@Controller('shop/vk')
export class ShopVkController {
  constructor(private readonly vkService: ShopVkService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Диагностика конфигурации VK (без секретов)' })
  @ApiResponse({ status: 200 })
  async status() {
    return this.vkService.diagnostics();
  }

  @Post('webhook')
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Webhook для VK бота (сообщество)' })
  @ApiResponse({ status: 200 })
  async webhook(@Body() body: Record<string, unknown>) {
    return this.vkService.handleWebhook(body || {});
  }
}
