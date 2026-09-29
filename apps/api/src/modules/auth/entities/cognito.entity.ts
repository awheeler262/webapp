import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('cognito')
export class Cognito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ unique: true })
  sub: string;
}
