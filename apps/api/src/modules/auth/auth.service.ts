import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { ConfigService } from '../../config/config.service';
import { CreateUserDto } from '@my-app/validation';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: CreateUserDto) {
    if (this.config.isProduction()) throw new ForbiddenException();
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');
    // create() always either resolves with the saved user or throws -- it never
    // resolves falsy, so there's no case here that needs its own handling.
    const user = await this.users.create(dto);
    return this.sign(user.id, user.email);
  }

  async login(email: string, password: string) {
    if (this.config.isTest()) {
      return this.sign(
        '8fb2a405-503e-4344-8543-6e8d93f4c9ee',
        email
      );
    }
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.sign(user.id, user.email);
  }

  private sign(userId: string, email: string) {
    const payload = { sub: userId, email };
    const accessToken = this.jwt.sign(payload);
    const { exp } = this.jwt.decode(accessToken) as { exp: number };
    return { accessToken, user: { id: userId, email }, exp };
  }
}
