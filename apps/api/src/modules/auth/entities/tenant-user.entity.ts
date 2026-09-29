import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tenant_users')
export class TenantUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'role_id' })
  roleId: string;
}
