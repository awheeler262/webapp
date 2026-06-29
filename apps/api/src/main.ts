import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // strip properties not in DTO
    forbidNonWhitelisted: true,
    transform: true,       // auto-transform payloads to DTO types
  }));

  await app.listen(process.env.PORT || 3001);
  console.log(`API running on http://localhost:3001`);
}

bootstrap();
