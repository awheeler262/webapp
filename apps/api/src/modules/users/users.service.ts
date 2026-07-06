import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from '@my-app/validation';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private usersRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);
    const saved = await this.usersRepository.save(
      this.usersRepository.create({
        email: dto.email,
        name: dto.name,
        password: hashed,
      }),
    );
    const { id, email, name, createdAt } = saved;
    return { id, email, name, createdAt };
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string) {
    return this.usersRepository.findOne({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true },
    });
  }
}
