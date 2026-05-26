import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return 'Hello World!';
  }

  // ДОБАВЛЯЕМ ТЕСТОВЫЕ ЭНДПОИНТЫ ДЛЯ ДИАГНОСТИКИ
  @Get('test')
  @UseGuards(JwtAuthGuard)
  getTest() {
    this.logger.log('GET /test called');
    return {
      message: 'Test endpoint works!',
      timestamp: new Date().toISOString(),
      status: 'OK',
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'UP',
      service: 'TechnoPrime CRM Backend',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('modules')
  @UseGuards(JwtAuthGuard)
  getModules() {
    return {
      message: 'Available modules check',
      modules: [
        'ClientsModule',
        'ProductsModule',
        'OrdersModule',
        'TasksModule',
        'SubscriptionsModule',
        'SharingSystemsModule',
      ],
      timestamp: new Date().toISOString(),
    };
  }
}
