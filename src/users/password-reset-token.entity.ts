import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('password_reset_tokens')
export class PasswordResetToken {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    token: string;

    @Column()
    expiresAt: Date;

    @Column({ default: false })
    isUsed: boolean;

    @Column()
    userId: string;

    @ManyToOne(() => User, user => user.passwordResetTokens, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @CreateDateColumn()
    createdAt: Date;
}