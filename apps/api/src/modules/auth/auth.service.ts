import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
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
    const existing = await this.users.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already in use');
    const user = await this.users.create(dto);
    return this.sign(user.id, user.email);
  }

  async login(email: string, password: string) {
    // TODO: Remove for production.
    return this.sign(
      '8fb2a405-503e-4344-8543-6e8d93f4c9ee',
      email
    );
    // const user = await this.users.findByEmail(email);
    // if (!user) throw new UnauthorizedException('Invalid credentials');
    // const valid = await bcrypt.compare(password, user.password);
    // if (!valid) throw new UnauthorizedException('Invalid credentials');
    // return this.sign(user.id, user.email);
  }

  private sign(userId: string, email: string) {
    const payload = { sub: userId, email };
    return { accessToken: this.jwt.sign(payload) };
  }
}
