import { Body, Controller, Get, Header, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ShopMaxService } from './shop-max.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('shop-max')
@Controller('shop/max')
export class ShopMaxController {
  constructor(private readonly maxService: ShopMaxService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Диагностика конфигурации MAX (без секретов)' })
  @ApiResponse({ status: 200 })
  async status() {
    return this.maxService.diagnostics();
  }

  @Post('webhook')
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Webhook для MAX бота' })
  @ApiResponse({ status: 200 })
  async webhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-max-webhook-secret') secret?: string,
  ) {
    return this.maxService.handleWebhook(body || {}, secret);
  }
}
