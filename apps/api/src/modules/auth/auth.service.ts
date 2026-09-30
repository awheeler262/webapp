import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CognitoService } from './cognito.service';
import { LoginAttemptsService } from './login-attempts.service';
import { ConfigService } from '../../config/config.service';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private cognito: CognitoService,
    private loginAttempts: LoginAttemptsService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // Keep for debugging
  // return this.sign({ id: '8fb2a405-503e-4344-8543-6e8d93f4c9ee', email, isDevops: false } as User);
  async login(email: string, password: string, ip: string | null) {
    if (this.config.isCognitoEnabled()) {
      throw new ServiceUnavailableException();
    }

    const cognito = await this.cognito.findByEmail(email);
    if (cognito) {
      const valid = await bcrypt.compare(password, cognito.password);
      if (!valid) {
        await this.loginAttempts.recordFailure(email, ip);
        throw new UnauthorizedException('Invalid credentials');
      }
      const user = await this.users.findByCognitoSub(cognito.sub);
      if (!user) {
        await this.loginAttempts.recordFailure(email, ip);
        throw new UnauthorizedException('Invalid credentials');
      }
      return this.signWithTenants(user);
    }

    // No cognito identity yet -- the submitted password doubles as proof of
    // possession of the invite (compared against the invitation's token_hash,
    // not just a matching email), and becomes the account's real password on
    // success. Mirrors how a real Cognito invite flow uses a temp password.
    const invitation = await this.cognito.findValidInvitation(email);
    if (!invitation) {
      await this.loginAttempts.recordFailure(email, ip);
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokenValid = await bcrypt.compare(password, invitation.tokenHash);
    if (!tokenValid) {
      await this.loginAttempts.recordFailure(email, ip);
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.cognito.createIdentity({
      email,
      name: '',
      passwordPlain: password,
      invitation,
    });
    return this.signWithTenants(user);
  }

  private async signWithTenants(user: User) {
    const tenants = await this.getAvailableTenants(user);
    return { ...this.sign(user), tenants };
  }

  // Also called directly by AuthController.me() -- the Portal page's
  // tenant/role dropdowns must survive a page refresh (session-restore goes
  // through /me, not /login), so both responses carry the same data.
  async getAvailableTenants(user: { id: string; isDevops: boolean }) {
    return this.cognito.findAvailableTenants(user);
  }

  // isDevops is included in the response's user object (so the frontend knows
  // whether to show the tenant/role picker right after login) but
  // deliberately never in the signed payload -- JwtStrategy.validate() always
  // re-fetches it fresh from the DB, so it's never trusted from a possibly
  // stale token.
  private sign(user: User) {
    const payload = { sub: user.id, email: user.email };
    const accessToken = this.jwt.sign(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);
    return {
      accessToken,
      user: { id: user.id, email: user.email, isDevops: user.isDevops },
      exp,
    };
  }
}
