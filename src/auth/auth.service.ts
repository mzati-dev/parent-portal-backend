import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../users/user.entity';
import { PasswordResetToken } from '../users/password-reset-token.entity';
import { EmailService } from './email.service';
import * as bcrypt from 'bcryptjs';
import { School } from 'src/schools/entities/school.entity';
import { TeachersService } from '../teachers/teachers.service'; // ADD THIS IMPORT
import { Teacher } from 'src/teachers/entities/teacher.entity';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private usersRepository: Repository<User>,
        @InjectRepository(PasswordResetToken)
        private resetTokenRepository: Repository<PasswordResetToken>,
        @InjectRepository(School)
        private schoolRepository: Repository<School>,
        @InjectRepository(Teacher) // ADD THIS
        private teacherRepository: Repository<Teacher>, // ADD THIS
        private jwtService: JwtService,
        private emailService: EmailService,

    ) { }

    // ===== START: MODIFIED validateUser method =====
    async validateUser(email: string, password: string): Promise<any> {
        // First, check regular users
        let user = await this.usersRepository.findOne({ where: { email } });

        if (user) {
            // Validate password for regular user
            const isPasswordValid = await user.validatePassword(password);
            if (!isPasswordValid) {
                throw new UnauthorizedException('Invalid credentials');
            }

            if (!user.isEmailVerified) {
                throw new UnauthorizedException('Please verify your email address first');
            }

            const { password: _, ...result } = user;
            return result; // Returns regular user with role
        }

        // If not found in users, check school admins
        const school = await this.schoolRepository.findOne({
            where: {
                adminEmail: email,
                isActive: true
            }
        });

        if (school) {
            // Validate password for school admin
            const isPasswordValid = await bcrypt.compare(password, school.adminPassword);
            if (!isPasswordValid) {
                throw new UnauthorizedException('Invalid credentials');
            }

            // Return school as a user object
            return {
                id: school.id,
                email: school.adminEmail,
                fullName: school.adminName,
                role: school.role || 'school_admin',
                isEmailVerified: true,
                schoolId: school.id, // Add schoolId for reference
                schoolName: school.name, // Add school name
            };
        }

        // If neither found
        throw new UnauthorizedException('Invalid credentials');
    }
    // ===== END: MODIFIED validateUser method =====

    // ===== START: TEACHER VALIDATION METHOD =====
    // async validateTeacher(email: string, password: string): Promise<any> {
    //     // Find teacher by email
    //     const teacher = await this.teachersService.findTeacherByEmail(email);

    //     if (!teacher) {
    //         throw new UnauthorizedException('Invalid credentials');
    //     }

    //     // Compare passwords (teacher password is already hashed)
    //     const isPasswordValid = await bcrypt.compare(password, teacher.password);

    //     if (!isPasswordValid) {
    //         throw new UnauthorizedException('Invalid credentials');
    //     }

    //     // Check if teacher is active
    //     if (teacher.is_active === false) {
    //         throw new UnauthorizedException('Teacher account is inactive');
    //     }

    //     // Return teacher without password
    //     const { password: _, ...teacherWithoutPassword } = teacher;
    //     return teacherWithoutPassword;
    // }
    // ===== END: TEACHER VALIDATION METHOD =====
    // ===== START: FIXED validateTeacher method =====
    async validateTeacher(email: string, password: string): Promise<any> {
        // Find teacher by email in teachers table
        const teacher = await this.teacherRepository.findOne({
            where: { email }
        });

        if (!teacher) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, teacher.password);

        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        // Check if teacher is active
        if (!teacher.is_active) {
            throw new UnauthorizedException('Teacher account is inactive');
        }

        // Return teacher without password
        const { password: _, ...teacherWithoutPassword } = teacher;
        return teacherWithoutPassword;
    }
    // ===== END: FIXED validateTeacher method =====

    async login(user: any) {
        const payload = {
            email: user.email,
            sub: user.id,
            fullName: user.fullName,
            role: user.role || 'user',
            schoolId: user.schoolId || null,
        };

        // Build user response
        const userResponse: any = {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            role: user.role || 'user',
            isEmailVerified: user.isEmailVerified,
        };

        // Add school info if it exists in the user object
        if (user.schoolId) {
            userResponse.schoolId = user.schoolId;
            userResponse.schoolName = user.schoolName;
        }

        return {
            user: userResponse,
            access_token: this.jwtService.sign(payload),
        };
    }

    // ===== START: TEACHER LOGIN METHOD =====
    async teacherLogin(teacher: any) {
        const payload = {
            email: teacher.email,
            sub: teacher.id,
            name: teacher.name,
            role: 'teacher',
            schoolId: teacher.school_id,
        };

        return {
            user: {
                id: teacher.id,
                email: teacher.email,
                name: teacher.name,
                role: 'teacher',
                schoolId: teacher.school_id,
                created_at: teacher.created_at,
            },
            access_token: this.jwtService.sign(payload),
        };
    }
    // ===== END: TEACHER LOGIN METHOD =====

    async register(fullName: string, email: string, password: string) {
        // Check if user already exists
        const existingUser = await this.usersRepository.findOne({ where: { email } });
        if (existingUser) {
            throw new BadRequestException('User with this email already exists');
        }

        // Create user
        const user = this.usersRepository.create({
            fullName,
            email,
            password,
            isEmailVerified: false,
            emailVerificationToken: crypto.randomBytes(32).toString('hex'),
            emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        });

        const savedUser = await this.usersRepository.save(user);

        // Send verification email
        await this.emailService.sendVerificationEmail(
            savedUser.email,
            savedUser.fullName,
            savedUser.emailVerificationToken!,
        );

        const { password: _, ...result } = savedUser;
        return result;
    }

    async verifyEmail(token: string) {
        const user = await this.usersRepository.findOne({
            where: {
                emailVerificationToken: token,
                emailVerificationExpires: MoreThan(new Date()),
            },
        });

        if (!user) {
            throw new BadRequestException('Invalid or expired verification token');
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;

        await this.usersRepository.save(user);

        return { message: 'Email verified successfully' };
    }

    async forgotPassword(email: string) {
        const user = await this.usersRepository.findOne({ where: { email } });

        if (!user) {
            // Don't reveal that user doesn't exist for security
            return { message: 'If an account exists, you will receive a reset email' };
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

        // Save reset token
        const resetTokenEntity = this.resetTokenRepository.create({
            token: resetToken,
            expiresAt,
            user,
        });

        await this.resetTokenRepository.save(resetTokenEntity);

        // Send reset email
        await this.emailService.sendPasswordResetEmail(
            user.email,
            user.fullName,
            resetToken,
        );

        return { message: 'Password reset email sent' };
    }

    async resetPassword(token: string, newPassword: string) {
        // Find valid token
        const resetToken = await this.resetTokenRepository.findOne({
            where: {
                token,
                expiresAt: MoreThan(new Date()),
                isUsed: false,
            },
            relations: ['user'],
        });

        if (!resetToken) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        // Update user password - HASH IT
        const salt = await bcrypt.genSalt(10);
        resetToken.user.password = await bcrypt.hash(newPassword, salt);

        await this.usersRepository.save(resetToken.user);

        // Mark token as used
        resetToken.isUsed = true;
        await this.resetTokenRepository.save(resetToken);

        return { message: 'Password reset successful' };
    }

    async resendVerificationEmail(email: string) {
        const user = await this.usersRepository.findOne({ where: { email } });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.isEmailVerified) {
            throw new BadRequestException('Email already verified');
        }

        // Generate new verification token
        user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await this.usersRepository.save(user);

        // Send verification email
        await this.emailService.sendVerificationEmail(
            user.email,
            user.fullName,
            user.emailVerificationToken,
        );

        return { message: 'Verification email resent' };
    }
}


// import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
// import { JwtService } from '@nestjs/jwt';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository, MoreThan } from 'typeorm';
// import * as crypto from 'crypto';
// import { User } from '../users/user.entity';
// import { PasswordResetToken } from '../users/password-reset-token.entity';
// import { EmailService } from './email.service';
// import * as bcrypt from 'bcryptjs';
// import { School } from 'src/schools/entities/school.entity';

// @Injectable()
// export class AuthService {
//     constructor(
//         @InjectRepository(User)
//         private usersRepository: Repository<User>,
//         @InjectRepository(PasswordResetToken)
//         private resetTokenRepository: Repository<PasswordResetToken>,
//         @InjectRepository(School) // ADD THIS
//         private schoolRepository: Repository<School>, // ADD THIS
//         private jwtService: JwtService,
//         private emailService: EmailService,
//     ) { }

//     // async validateUser(email: string, password: string): Promise<any> {
//     //     const user = await this.usersRepository.findOne({ where: { email } });

//     //     if (!user) {
//     //         throw new UnauthorizedException('Invalid credentials');
//     //     }

//     //     const isPasswordValid = await user.validatePassword(password);

//     //     if (!isPasswordValid) {
//     //         throw new UnauthorizedException('Invalid credentials');
//     //     }

//     //     if (!user.isEmailVerified) {
//     //         throw new UnauthorizedException('Please verify your email address first');
//     //     }

//     //     const { password: _, ...result } = user;
//     //     return result;
//     // }

//     // async validateUser(email: string, password: string): Promise<any> {
//     //     const user = await this.usersRepository.findOne({ where: { email } });

//     //     if (!user) {
//     //         throw new UnauthorizedException('Invalid credentials');
//     //     }

//     //     const isPasswordValid = await user.validatePassword(password);

//     //     if (!isPasswordValid) {
//     //         throw new UnauthorizedException('Invalid credentials');
//     //     }

//     //     if (!user.isEmailVerified) {
//     //         throw new UnauthorizedException('Please verify your email address first');
//     //     }

//     //     // Return ALL user fields including role
//     //     const { password: _, ...result } = user;
//     //     return result; // This should include role now
//     // }

//     // ===== START: MODIFIED validateUser method =====
//     async validateUser(email: string, password: string): Promise<any> {
//         // First, check regular users
//         let user = await this.usersRepository.findOne({ where: { email } });

//         if (user) {
//             // Validate password for regular user
//             const isPasswordValid = await user.validatePassword(password);
//             if (!isPasswordValid) {
//                 throw new UnauthorizedException('Invalid credentials');
//             }

//             if (!user.isEmailVerified) {
//                 throw new UnauthorizedException('Please verify your email address first');
//             }

//             const { password: _, ...result } = user;
//             return result; // Returns regular user with role
//         }

//         // If not found in users, check school admins
//         const school = await this.schoolRepository.findOne({
//             where: {
//                 adminEmail: email,
//                 isActive: true
//             }
//         });

//         if (school) {
//             // Validate password for school admin
//             const isPasswordValid = await bcrypt.compare(password, school.adminPassword);
//             if (!isPasswordValid) {
//                 throw new UnauthorizedException('Invalid credentials');
//             }

//             // Return school as a user object
//             return {
//                 id: school.id,
//                 email: school.adminEmail,
//                 fullName: school.adminName,
//                 role: school.role || 'school_admin',
//                 isEmailVerified: true,
//                 schoolId: school.id, // Add schoolId for reference
//                 schoolName: school.name, // Add school name
//             };
//         }

//         // If neither found
//         throw new UnauthorizedException('Invalid credentials');
//     }
//     // ===== END: MODIFIED validateUser method =====

//     // async login(user: any) {
//     //     const payload = { email: user.email, sub: user.id, fullName: user.fullName };

//     //     return {
//     //         user: {
//     //             id: user.id,
//     //             email: user.email,
//     //             fullName: user.fullName,
//     //         },
//     //         access_token: this.jwtService.sign(payload),
//     //     };
//     // }

//     // async login(user: any) {
//     //     const payload = {
//     //         email: user.email,
//     //         sub: user.id,
//     //         fullName: user.fullName,
//     //         role: user.role || 'user'
//     //     }


//     //     return {
//     //         user: {
//     //             id: user.id,
//     //             email: user.email,
//     //             fullName: user.fullName,
//     //             role: user.role || 'user',
//     //             isEmailVerified: user.isEmailVerified,
//     //         },
//     //         access_token: this.jwtService.sign(payload),
//     //     };
//     // }

//     // async login(user: any) {
//     //     const payload = {
//     //         email: user.email,
//     //         sub: user.id,
//     //         fullName: user.fullName,
//     //         role: user.role || 'user',           // Keep this from your 2nd version
//     //         schoolId: user.schoolId || null,     // Add this line only
//     //     };

//     //     return {
//     //         user: {
//     //             id: user.id,
//     //             email: user.email,
//     //             fullName: user.fullName,
//     //             role: user.role || 'user',       // Keep this from your 2nd version
//     //             isEmailVerified: user.isEmailVerified,
//     //             // Add school info if available
//     //             ...(user.schoolId && {
//     //                 schoolId: user.schoolId,
//     //                 schoolName: user.schoolName,
//     //             }),
//     //         },
//     //         access_token: this.jwtService.sign(payload),
//     //     };
//     // }


//     async login(user: any) {
//         const payload = {
//             email: user.email,
//             sub: user.id,
//             fullName: user.fullName,
//             role: user.role || 'user',
//             schoolId: user.schoolId || null, // ← This works
//         };

//         // Build user response
//         const userResponse: any = {
//             id: user.id,
//             email: user.email,
//             fullName: user.fullName,
//             role: user.role || 'user',
//             isEmailVerified: user.isEmailVerified,
//         };

//         // Add school info if it exists in the user object
//         if (user.schoolId) {
//             userResponse.schoolId = user.schoolId;
//             userResponse.schoolName = user.schoolName;
//         }

//         return {
//             user: userResponse,
//             access_token: this.jwtService.sign(payload),
//         };
//     }

//     async register(fullName: string, email: string, password: string) {
//         // Check if user already exists
//         const existingUser = await this.usersRepository.findOne({ where: { email } });
//         if (existingUser) {
//             throw new BadRequestException('User with this email already exists');
//         }

//         // Create user
//         const user = this.usersRepository.create({
//             fullName,
//             email,
//             password,
//             isEmailVerified: false,
//             emailVerificationToken: crypto.randomBytes(32).toString('hex'),
//             emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
//         });

//         const savedUser = await this.usersRepository.save(user);

//         // Send verification email
//         await this.emailService.sendVerificationEmail(
//             savedUser.email,
//             savedUser.fullName,
//             savedUser.emailVerificationToken!,
//         );

//         const { password: _, ...result } = savedUser;
//         return result;
//     }

//     async verifyEmail(token: string) {
//         const user = await this.usersRepository.findOne({
//             where: {
//                 emailVerificationToken: token,
//                 emailVerificationExpires: MoreThan(new Date()),
//             },
//         });

//         if (!user) {
//             throw new BadRequestException('Invalid or expired verification token');
//         }

//         user.isEmailVerified = true;
//         // user.emailVerificationToken = null;
//         // user.emailVerificationExpires = null;

//         user.emailVerificationToken = undefined;
//         user.emailVerificationExpires = undefined;

//         await this.usersRepository.save(user);

//         return { message: 'Email verified successfully' };
//     }

//     async forgotPassword(email: string) {
//         const user = await this.usersRepository.findOne({ where: { email } });

//         if (!user) {
//             // Don't reveal that user doesn't exist for security
//             return { message: 'If an account exists, you will receive a reset email' };
//         }

//         // Generate reset token
//         const resetToken = crypto.randomBytes(32).toString('hex');
//         const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

//         // Save reset token
//         const resetTokenEntity = this.resetTokenRepository.create({
//             token: resetToken,
//             expiresAt,
//             user,
//         });

//         await this.resetTokenRepository.save(resetTokenEntity);

//         // Send reset email
//         await this.emailService.sendPasswordResetEmail(
//             user.email,
//             user.fullName,
//             resetToken,
//         );

//         return { message: 'Password reset email sent' };
//     }

//     // async resetPassword(token: string, newPassword: string) {
//     //     // Find valid token
//     //     const resetToken = await this.resetTokenRepository.findOne({
//     //         where: {
//     //             token,
//     //             expiresAt: MoreThan(new Date()),
//     //             isUsed: false,
//     //         },
//     //         relations: ['user'],
//     //     });

//     //     if (!resetToken) {
//     //         throw new BadRequestException('Invalid or expired reset token');
//     //     }

//     //     // Update user password
//     //     resetToken.user.password = newPassword;
//     //     await this.usersRepository.save(resetToken.user);

//     //     // Mark token as used
//     //     resetToken.isUsed = true;
//     //     await this.resetTokenRepository.save(resetToken);

//     //     return { message: 'Password reset successful' };
//     // }

//     async resetPassword(token: string, newPassword: string) {
//         // Find valid token
//         const resetToken = await this.resetTokenRepository.findOne({
//             where: {
//                 token,
//                 expiresAt: MoreThan(new Date()),
//                 isUsed: false,
//             },
//             relations: ['user'],
//         });

//         if (!resetToken) {
//             throw new BadRequestException('Invalid or expired reset token');
//         }

//         // Update user password - HASH IT
//         const salt = await bcrypt.genSalt(10);
//         resetToken.user.password = await bcrypt.hash(newPassword, salt);

//         await this.usersRepository.save(resetToken.user);

//         // Mark token as used
//         resetToken.isUsed = true;
//         await this.resetTokenRepository.save(resetToken);

//         return { message: 'Password reset successful' };
//     }

//     async resendVerificationEmail(email: string) {
//         const user = await this.usersRepository.findOne({ where: { email } });

//         if (!user) {
//             throw new NotFoundException('User not found');
//         }

//         if (user.isEmailVerified) {
//             throw new BadRequestException('Email already verified');
//         }

//         // Generate new verification token
//         user.emailVerificationToken = crypto.randomBytes(32).toString('hex');
//         user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

//         await this.usersRepository.save(user);

//         // Send verification email
//         await this.emailService.sendVerificationEmail(
//             user.email,
//             user.fullName,
//             user.emailVerificationToken,
//         );

//         return { message: 'Verification email resent' };
//     }
// }