import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { EmployeesService } from './employees/employees.service';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const corsEnv = (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'https://crm.technoprimestore.ru',
    'https://technoprimestore.ru',
    'https://www.technoprimestore.ru',
  ];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: {
      origin: corsEnv.length ? corsEnv : defaultOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'x-shop-key'],
    },
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const logger = new Logger('Bootstrap');
  app.set('trust proxy', 'loopback');
  app.use((req: any, res: any, next: () => void) => {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Local media files for storefront images.
  app.useStaticAssets(join(process.cwd(), '..', 'assets'), {
    prefix: '/assets/',
  });

  // ВКЛЮЧАЕМ ГЛОБАЛЬНЫЙ ПРЕФИКС
  app.setGlobalPrefix('api');

  // НЕ ВЫЗЫВАЕМ app.enableCors() - уже настроили выше

  const employees = app.get(EmployeesService, { strict: false });
  const port = Number(process.env.PORT || 4000);
  const host = process.env.BIND_HOST || '0.0.0.0';
  await app.listen(port, host);

  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  logger.log(`🚀 Backend running on http://${displayHost}:${port}/api`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  if (employees?.createAdminIfEmpty) {
    void employees.createAdminIfEmpty().catch(error => {
      logger.warn(`Admin bootstrap skipped: ${String(error)}`);
    });
  }
}

bootstrap();
