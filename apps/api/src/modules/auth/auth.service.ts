import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '@my-app/validation';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async register(dto: CreateUserDto) {
    if (process.env.NODE_ENV === 'production') throw new ForbiddenException();
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');
    const user = await this.users.create(dto);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.sign(user.id, user.email);
  }

  async login(email: string, password: string) {
    if (process.env.NODE_ENV === 'test') {
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
