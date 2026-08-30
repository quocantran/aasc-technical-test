import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * TypeORM entity storing Bitrix24 OAuth tokens and expiration metadata in SQLite.
 */
@Entity('bitrix_tokens')
export class BitrixTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, default: 'default' })
  domain: string; // Bitrix24 portal domain (e.g. b24-abc.bitrix24.vn)

  @Column({ type: 'text' })
  accessToken: string; // Active access token for REST API calls (valid for 1 hour)

  @Column({ type: 'text' })
  refreshToken: string; // Refresh token used to renew expired access tokens (valid for 180 days)

  @Column({ type: 'integer', default: 3600 })
  expiresIn: number; // Token lifetime in seconds (default 3600)

  @Column({ type: 'bigint', nullable: true })
  expiresAt: number; // Absolute expiration timestamp in milliseconds

  @Column({ nullable: true })
  memberId: string; // Unique identifier of the Bitrix24 portal

  @Column({ nullable: true })
  scope: string; // Comma-separated list of authorized scopes (e.g. crm)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
