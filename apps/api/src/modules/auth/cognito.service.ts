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

  // If the same email has more than one pending invitation (e.g. to two
  // different tenants) this must pick deterministically rather than whatever
  // Postgres happens to return first -- soonest-expiring first, since there's
  // no created_at column on invitations to order by "most recent" instead.
  async findValidInvitation(email: string): Promise<Invitation | null> {
    return this.withRepo(
      (ds) => ds.getRepository(Invitation),
      (repo) =>
        repo
          .createQueryBuilder('invitation')
          .where('invitation.email = :email', { email })
          .andWhere('invitation.accepted_at IS NULL')
          .andWhere('invitation.expires_at > :now', { now: new Date() })
          .orderBy('invitation.expires_at', 'ASC')
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

  // The regular-user source of truth for TenantContextGuard -- true only if
  // this exact (user, tenant, role) tuple is on file. Checking the tuple
  // directly (rather than fetching *a* row for (user, tenant) and comparing
  // roleId separately) matters because tenant_users has no unique constraint
  // on (user_id, tenant_id) -- a user with two rows for the same tenant but
  // different roles would otherwise get an arbitrary one back from findOne(),
  // spuriously rejecting a role they actually hold.
  async hasTenantUserRole(
    userId: string,
    tenantId: string,
    roleId: string,
  ): Promise<boolean> {
    const row = await this.withRepo(
      (ds) => ds.getRepository(TenantUser),
      (repo) => repo.findOne({ where: { userId, tenantId, roleId } }),
    );
    return row !== null;
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
    const sub = randomUUID();
    // Hashed before opening the transaction -- bcrypt's cost factor makes
    // this tens of ms of pure CPU work with no need for an open connection,
    // so doing it inside the transaction just holds a pooled connection idle.
    const hashed = await bcrypt.hash(passwordPlain, 10);
    try {
      return await dataSource.transaction(async (manager: EntityManager) => {
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
