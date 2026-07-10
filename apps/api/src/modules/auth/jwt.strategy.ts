import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { UsersService } from '../users/users.service';
import { ConfigService } from '../../config/config.service';

// The token now lives only in an httpOnly auth_token cookie -- the frontend can't
// read it to build an Authorization header anymore, so extract it from the cookie
// jar (populated by cookie-parser, see app.config.ts's configureCookies) instead.
export function fromAuthCookie(req: Request): string | null {
  return req?.cookies?.auth_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private users: UsersService, config: ConfigService) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');

    super({
      jwtFromRequest: fromAuthCookie,
      secretOrKeyProvider: (_request, _rawJwtToken, done) => {
        config.getJwtSecret().then((secret) => done(null, secret)).catch(done);
      },
    });
  }

  async validate(payload: { sub: string; email: string; exp: number }) {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return { ...user, tokenExp: payload.exp };
  }
}
