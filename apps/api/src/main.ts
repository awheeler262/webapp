import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"] },
    },
    frameguard: { action: 'deny' },
  }));
  app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'interest-cohort=()');
    next();
  });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // strip properties not in DTO
    forbidNonWhitelisted: true,
    transform: true,       // auto-transform payloads to DTO types
  }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}

bootstrap();
