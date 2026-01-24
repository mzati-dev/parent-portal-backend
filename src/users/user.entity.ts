import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, BeforeInsert, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { Exclude } from 'class-transformer';
import { PasswordResetToken } from './password-reset-token.entity';
import { School } from '../schools/entities/school.entity';
// import { PasswordResetToken } from './password-reset-token.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    @IsNotEmpty()
    fullName: string;

    @Column({ unique: true })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @Column()
    @Exclude()
    @MinLength(8)
    password: string;

    @Column({ default: false })
    isEmailVerified: boolean;

    // ========== ADD THIS LINE ==========
    @Column({ default: 'user' })
    role: string; // 'user', 'admin', 'super_admin'
    // ========== END OF ADD ==========

    // ========== ADD SCHOOL RELATION HERE ==========
    @ManyToOne(() => School, school => school.users, { nullable: true })
    @JoinColumn({ name: 'schoolId' })
    school?: School;

    @Column({ nullable: true })
    schoolId?: string;
    // ========== END ADD ==========

    //   @Column({ nullable: true })
    //   emailVerificationToken: string;

    //   @Column({ nullable: true })
    //   emailVerificationExpires: Date;

    //   @Column({ nullable: true })
    //   @Exclude()
    //   resetPasswordToken: string;

    //   @Column({ nullable: true })
    //   @Exclude()
    //   resetPasswordExpires: Date;

    @Column({ nullable: true })
    emailVerificationToken?: string;

    @Column({ nullable: true })
    emailVerificationExpires?: Date;

    @Column({ nullable: true })
    @Exclude()
    resetPasswordToken?: string;

    @Column({ nullable: true })
    @Exclude()
    resetPasswordExpires?: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => PasswordResetToken, token => token.user)
    passwordResetTokens: PasswordResetToken[];

    @BeforeInsert()
    async hashPassword() {
        if (this.password) {
            this.password = await bcrypt.hash(this.password, 10);
        }
    }

    async validatePassword(password: string): Promise<boolean> {
        return bcrypt.compare(password, this.password);
    }
}