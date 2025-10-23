import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { EmployeesService } from './employees/employees.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  app.enableCors({
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
  });

  const employees = app.get(EmployeesService, { strict: false });
  if (employees?.createAdminIfEmpty) await employees.createAdminIfEmpty();

  const port = Number(process.env.PORT || 4000);
  await app.listen(port, '0.0.0.0'); // важно
  console.log(`Backend is running on http://127.0.0.1:${port}`);
}
bootstrap();