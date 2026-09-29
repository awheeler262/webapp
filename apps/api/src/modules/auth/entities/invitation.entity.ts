import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column()
  email: string;

  @Column({ name: 'role_id' })
  roleId: string;

  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  // Explicit type is required here -- reflect-metadata's design:type for a
  // union (Date | null) resolves to the bare Object constructor, which TypeORM
  // can't map to a Postgres column type on its own.
  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'invited_by' })
  invitedBy: string;
}
