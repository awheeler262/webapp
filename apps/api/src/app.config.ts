import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

export function configureHelmet(app: INestApplication) {
  app.use(helmet({
    strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true, preload: true },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"] },
    },
    frameguard: { action: 'deny' },
  }));
}

// Content-Type is intentionally not set here — Nest already sets it correctly
// per response (e.g. `application/json; charset=utf-8` via res.json()), so forcing
// a blanket value here would just get overwritten on every real response anyway.
export function configureSecurityHeaders(app: INestApplication) {
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Permissions-Policy', 'interest-cohort=()');
    next();
  });
}

export function configureCors(app: INestApplication) {
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
}

export function configureValidation(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // strip properties not in DTO
    forbidNonWhitelisted: true,
    transform: true,       // auto-transform payloads to DTO types
  }));
}
