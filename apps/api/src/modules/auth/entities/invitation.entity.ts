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

  @Column({ name: 'accepted_at', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'invited_by' })
  invitedBy: string;
}
