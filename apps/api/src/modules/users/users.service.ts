import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from '@my-app/validation';
import * as bcrypt from 'bcrypt';
import { ensureInitialized, isConnectivityError } from '../../database/database.providers';
import { DATA_SOURCE } from '../../database/database.module';

@Injectable()
export class UsersService {
  constructor(
    @Inject(DATA_SOURCE) private dataSource: DataSource
  ) {}

  private async getRepo(): Promise<Repository<User>> {
    const dataSource = await ensureInitialized(this.dataSource);
    return dataSource.getRepository(User);
  }

  // getRepo() only handles a connection that was never established -- once
  // isInitialized is true it never resets itself, so a connection that dies
  // later fails inside the query call itself, not ensureInitialized. Catch
  // that here too so it gets the same clean 503 instead of a raw 500.
  private async withRepo<T>(fn: (repo: Repository<User>) => Promise<T>): Promise<T> {
    const repo = await this.getRepo();
    try {
      return await fn(repo);
    } catch (err) {
      if (isConnectivityError(err)) {
        throw new ServiceUnavailableException('Database unavailable', { cause: err });
      }
      throw err;
    }
  }

  async create(dto: CreateUserDto) {
    const hashed = await bcrypt.hash(dto.password, 10);
    const saved = await this.withRepo((repo) => repo.save(
      repo.create({
        email: dto.email,
        name: dto.name,
        password: hashed,
      }),
    ));
    const { id, email, name, createdAt } = saved;
    return { id, email, name, createdAt };
  }

  async findByEmail(email: string) {
    return this.withRepo((repo) => repo.findOne({ where: { email } }));
  }

  async findById(id: string) {
    return this.withRepo((repo) => repo.findOne({
      where: { id },
      select: { id: true, email: true, name: true, createdAt: true },
    }));
  }
}
