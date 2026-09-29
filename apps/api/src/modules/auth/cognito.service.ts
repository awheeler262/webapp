import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Cognito } from './entities/cognito.entity';
import { Invitation } from './entities/invitation.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { User } from '../users/entities/user.entity';
import {
  ensureInitialized,
  isConnectivityError,
} from '../../database/database.providers';
import { DATA_SOURCE } from '../../database/database.module';

type CreateIdentityInput = {
  email: string;
  name: string;
  passwordPlain: string;
  invitation?: Invitation;
};

@Injectable()
export class CognitoService {
  constructor(@Inject(DATA_SOURCE) private dataSource: DataSource) {}

  private async getDataSource(): Promise<DataSource> {
    return ensureInitialized(this.dataSource);
  }

  // Mirrors UsersService.withRepo -- getRepo()/ensureInitialized() only handles
  // a connection that was never established; a connection that dies later fails
  // inside the query call itself, so this catches that too for the same clean
  // 503 instead of a raw 500.
  private async withRepo<T, E extends object>(
    repoFor: (dataSource: DataSource) => Repository<E>,
    fn: (repo: Repository<E>) => Promise<T>,
  ): Promise<T> {
    const dataSource = await this.getDataSource();
    try {
      return await fn(repoFor(dataSource));
    } catch (err) {
      if (isConnectivityError(err)) {
        throw new ServiceUnavailableException('Database unavailable', {
          cause: err,
        });
      }
      throw err;
    }
  }

  async findByEmail(email: string): Promise<Cognito | null> {
    return this.withRepo(
      (ds) => ds.getRepository(Cognito),
      (repo) => repo.findOne({ where: { email } }),
    );
  }

  async findValidInvitation(email: string): Promise<Invitation | null> {
    return this.withRepo(
      (ds) => ds.getRepository(Invitation),
      (repo) =>
        repo
          .createQueryBuilder('invitation')
          .where('invitation.email = :email', { email })
          .andWhere('invitation.accepted_at IS NULL')
          .andWhere('invitation.expires_at > :now', { now: new Date() })
          .getOne(),
    );
  }

  async findTenantIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.withRepo(
      (ds) => ds.getRepository(TenantUser),
      (repo) => repo.find({ where: { userId } }),
    );
    return rows.map((row) => row.tenantId);
  }

  // Provisions a cognito identity + user profile in a single transaction --
  // when created from an invitation, also grants tenant membership and marks
  // the invitation accepted, atomically. A partial failure here must not leave
  // an orphaned cognito row with no matching user row.
  async createIdentity({
    email,
    name,
    passwordPlain,
    invitation,
  }: CreateIdentityInput): Promise<User> {
    const dataSource = await this.getDataSource();
    try {
      return await dataSource.transaction(async (manager: EntityManager) => {
        const sub = randomUUID();
        const hashed = await bcrypt.hash(passwordPlain, 10);

        await manager
          .getRepository(Cognito)
          .save(
            manager
              .getRepository(Cognito)
              .create({ email, password: hashed, sub }),
          );

        const user = await manager
          .getRepository(User)
          .save(
            manager
              .getRepository(User)
              .create({ email, name, cognitoSub: sub }),
          );

        if (invitation) {
          await manager.getRepository(TenantUser).save(
            manager.getRepository(TenantUser).create({
              userId: user.id,
              tenantId: invitation.tenantId,
              roleId: invitation.roleId,
            }),
          );
          await manager
            .getRepository(Invitation)
            .update(invitation.id, { acceptedAt: new Date() });
        }

        return user;
      });
    } catch (err) {
      if (isConnectivityError(err)) {
        throw new ServiceUnavailableException('Database unavailable', {
          cause: err,
        });
      }
      throw err;
    }
  }
}
