import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LoginAttemptsService } from './login-attempts.service';

const RETRY_AFTER_SECONDS = 15 * 60;

@Injectable()
export class LoginThrottleGuard implements CanActivate {
  constructor(private loginAttempts: LoginAttemptsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();

    // Runs before LoginDto's ValidationPipe -- body.email may not be a valid
    // email yet (or may be missing entirely). isBlocked() skips the
    // email-dimension check when null; the IP-dimension check still applies
    // either way, and real validation happens afterward regardless.
    const rawEmail = (request.body as { email?: unknown })?.email;
    const email =
      typeof rawEmail === 'string' && rawEmail.length > 0 ? rawEmail : null;
    const ip = request.ip ?? request.socket.remoteAddress ?? null;

    const blocked = await this.loginAttempts.isBlocked(email, ip);
    if (blocked) {
      const response = http.getResponse<Response>();
      response.setHeader('Retry-After', String(RETRY_AFTER_SECONDS));
      throw new HttpException(
        'Too many login attempts',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
