import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('event_log')
export class EventLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Explicit type on all three -- as with Invitation.acceptedAt, a nullable
  // union confuses reflect-metadata's design:type resolution, and these must
  // match the DDL's uuid columns rather than TypeORM's varchar default for a
  // bare `string`.
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId: string | null;

  @Column()
  method: string;

  @Column()
  path: string;

  @Column({ name: 'status_code' })
  statusCode: number;

  // Only set for 5xx -- internal detail that deliberately may not match the
  // response message. Explicit type for the same nullable-union reason as above.
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
