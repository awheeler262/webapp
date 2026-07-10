import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import express from 'express';

export function configureCookies(app: INestApplication) {
  app.use(cookieParser());
}

// Only ever parse JSON bodies -- Nest's default bootstrap (which this replaces;
// see main.ts/lambda.ts's `bodyParser: false`) also registers a urlencoded parser,
// which lets a bare cross-site <form method="post"> (the one content-type a plain
// form submission can always send) populate req.body enough to pass DTO validation
// on endpoints like /auth/login. Neither CORS nor SameSite=Lax stops that: CORS
// only governs JS-initiated fetch/XHR, and SameSite only withholds the *victim's*
// cookie, it doesn't stop the request or the Set-Cookie response from landing.
// A browser has no way to send Content-Type: application/json from a form, so
// only parsing that content-type closes the gap without needing a CSRF token.
export function configureBodyParser(app: INestApplication) {
  app.use(express.json());
}

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
    // Needed so the browser sends/accepts the (httpOnly) auth_token cookie
    // cross-origin in local dev (web on :3000, api on :3001) -- in production
    // /api/* is same-origin behind CloudFront, so this is a no-op there.
    credentials: true,
  });
}

export function configureValidation(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,       // strip properties not in DTO
    forbidNonWhitelisted: true,
    transform: true,       // auto-transform payloads to DTO types
  }));
}
