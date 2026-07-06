import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        // JWT_EXPIRY is a plain count of seconds (e.g. "3600"), not a duration
        // string like "1h" — parse it instead of casting so a malformed/missing
        // value falls back to the default rather than silently misconfiguring
        // token expiry.
        expiresIn: Number.parseInt(process.env.JWT_EXPIRY ?? '', 10) || 60 * 60
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, JwtAuthGuard],
  controllers: [AuthController],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
