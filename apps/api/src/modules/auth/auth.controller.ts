import { Controller, Post, Get, Body, HttpCode, HttpStatus, Res, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CreateUserDto } from '@my-app/validation';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

const COOKIE_NAME = 'auth_token';
// Lax is safe (and the stricter, more CSRF-resistant choice) because /api/* is
// always same-origin from the browser's perspective -- CloudFront routes it
// under the same domain in production, and apps/web's dev-only Vite proxy
// (nuxt.config.ts) does the same locally, specifically so this never has to be
// a cross-site cookie at all.
const COOKIE_OPTIONS = { httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/' };

function setAuthCookie(res: Response, accessToken: string, exp: number) {
  res.cookie(COOKIE_NAME, accessToken, { ...COOKIE_OPTIONS, expires: new Date(exp * 1000) });
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, user, exp } = await this.auth.register(dto);
    setAuthCookie(res, accessToken, exp);
    return { user, expiresAt: exp * 1000 };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, user, exp } = await this.auth.login(dto.email, dto.password);
    setAuthCookie(res, accessToken, exp);
    return { user, expiresAt: exp * 1000 };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    const { tokenExp, ...user } = req.user as { tokenExp: number; [key: string]: unknown };
    return { user, expiresAt: tokenExp * 1000 };
  }
}
