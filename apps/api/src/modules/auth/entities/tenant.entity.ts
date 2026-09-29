import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tenant')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;
}
