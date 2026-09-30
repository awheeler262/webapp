import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CognitoService } from './cognito.service';
import { LoginAttemptsService } from './login-attempts.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantContextGuard } from './tenant-context.guard';
import { LoginThrottleGuard } from './login-throttle.guard';
import { UsersModule } from '../users/users.module';
import { DatabaseModule } from '../../database/database.module';
import { ConfigModule } from '../../config/config.module';
import { ConfigService } from '../../config/config.service';

@Module({
  imports: [
    UsersModule,
    DatabaseModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: await config.getJwtSecret(),
        signOptions: {
          // JWT_EXPIRY is a plain count of seconds (e.g. "3600"), not a duration
          // string like "1h" — parse it instead of casting so a malformed/missing
          // value falls back to the default rather than silently misconfiguring
          // token expiry.
          expiresIn:
            Number.parseInt(process.env.JWT_EXPIRY ?? '', 10) || 60 * 60,
        },
      }),
    }),
  ],
  providers: [
    AuthService,
    CognitoService,
    LoginAttemptsService,
    JwtStrategy,
    JwtAuthGuard,
    TenantContextGuard,
    LoginThrottleGuard,
  ],
  controllers: [AuthController],
  exports: [CognitoService, JwtAuthGuard, TenantContextGuard],
})
export class AuthModule {}
