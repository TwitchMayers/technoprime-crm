import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { EmployeesService } from './employees/employees.service';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { 
    cors: {
      origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    },
    logger: ['error', 'warn', 'log', 'debug', 'verbose']
  });
  
  const logger = new Logger('Bootstrap');

  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  app.useGlobalFilters(new AllExceptionsFilter());

  // ВКЛЮЧАЕМ ГЛОБАЛЬНЫЙ ПРЕФИКС
  app.setGlobalPrefix('api');
  
  // НЕ ВЫЗЫВАЕМ app.enableCors() - уже настроили выше

  const employees = app.get(EmployeesService, { strict: false });
  if (employees?.createAdminIfEmpty) {
    await employees.createAdminIfEmpty();
  }

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0');
  
  logger.log(`🚀 Backend running on http://127.0.0.1:${port}/api`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();