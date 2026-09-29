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
import { Tenant } from './entities/tenant.entity';
import { Role } from './entities/role.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { DevopsAccessLog } from './entities/devops-access-log.entity';
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

  // The regular-user source of truth for TenantContextGuard -- returns the
  // role_id already on file for this (user, tenant) pair, or null if the user
  // isn't a member of that tenant at all.
  async findTenantUserRole(
    userId: string,
    tenantId: string,
  ): Promise<string | null> {
    const row = await this.withRepo(
      (ds) => ds.getRepository(TenantUser),
      (repo) => repo.findOne({ where: { userId, tenantId } }),
    );
    return row?.roleId ?? null;
  }

  // The devops-user check for TenantContextGuard -- true only if roleId belongs
  // to tenantId, so a devops user can't reference a role from a different tenant.
  async roleExists(tenantId: string, roleId: string): Promise<boolean> {
    const row = await this.withRepo(
      (ds) => ds.getRepository(Role),
      (repo) => repo.findOne({ where: { id: roleId, tenantId } }),
    );
    return row !== null;
  }

  async listTenants(): Promise<Tenant[]> {
    return this.withRepo(
      (ds) => ds.getRepository(Tenant),
      (repo) => repo.find(),
    );
  }

  async listRolesForTenant(tenantId: string): Promise<Role[]> {
    return this.withRepo(
      (ds) => ds.getRepository(Role),
      (repo) => repo.find({ where: { tenantId } }),
    );
  }

  async logDevopsAccess(entry: {
    userId: string;
    tenantId: string;
    roleId: string;
    method: string;
    path: string;
  }): Promise<void> {
    await this.withRepo(
      (ds) => ds.getRepository(DevopsAccessLog),
      (repo) => repo.save(repo.create(entry)),
    );
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

        // isDevops set explicitly rather than left to the column default --
        // TypeORM doesn't reflect a plain @Column default back onto the
        // in-memory entity after save(), and this codepath must never
        // silently grant it regardless.
        const user = await manager.getRepository(User).save(
          manager.getRepository(User).create({
            email,
            name,
            cognitoSub: sub,
            isDevops: false,
          }),
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
