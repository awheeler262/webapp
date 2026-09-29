import {
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CognitoService } from './cognito.service';
import { ConfigService } from '../../config/config.service';
import { CreateUserDto } from '@my-app/validation';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private cognito: CognitoService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: CreateUserDto) {
    if (!this.config.isRegistrationAllowed()) throw new ForbiddenException();
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');
    const user = await this.cognito.createIdentity({
      email: dto.email,
      name: dto.name,
      passwordPlain: dto.password,
    });
    return this.signWithTenants(user);
  }

  // Keep for debugging
  // return this.sign('8fb2a405-503e-4344-8543-6e8d93f4c9ee', email);
  async login(email: string, password: string) {
    if (this.config.isCognitoEnabled()) {
      throw new ServiceUnavailableException();
    }

    const cognito = await this.cognito.findByEmail(email);
    if (cognito) {
      const valid = await bcrypt.compare(password, cognito.password);
      if (!valid) throw new UnauthorizedException('Invalid credentials');
      const user = await this.users.findByCognitoSub(cognito.sub);
      if (!user) throw new UnauthorizedException('Invalid credentials');
      return this.signWithTenants(user);
    }

    // No cognito identity yet -- the submitted password doubles as proof of
    // possession of the invite (compared against the invitation's token_hash,
    // not just a matching email), and becomes the account's real password on
    // success. Mirrors how a real Cognito invite flow uses a temp password.
    const invitation = await this.cognito.findValidInvitation(email);
    if (!invitation) throw new UnauthorizedException('Invalid credentials');
    const tokenValid = await bcrypt.compare(password, invitation.tokenHash);
    if (!tokenValid) throw new UnauthorizedException('Invalid credentials');

    const user = await this.cognito.createIdentity({
      email,
      name: '',
      passwordPlain: password,
      invitation,
    });
    return this.signWithTenants(user);
  }

  private async signWithTenants(user: User) {
    const tenants = await this.cognito.findTenantIdsForUser(user.id);
    return { ...this.sign(user.id, user.email), tenants };
  }

  private sign(userId: string, email: string) {
    const payload = { sub: userId, email };
    const accessToken = this.jwt.sign(payload);
    const { exp } = this.jwt.decode<{ exp: number }>(accessToken);
    return { accessToken, user: { id: userId, email }, exp };
  }
}
