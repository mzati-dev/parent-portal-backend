import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
    private transporter: nodemailer.Transporter;
    private readonly logger = new Logger(EmailService.name);
    private readonly baseUrl: string;

    constructor(private configService: ConfigService) {
        this.baseUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
        this.initializeTransporter();
    }

    private async initializeTransporter() {
        try {
            const user = this.configService.get<string>('GMAIL_USER');
            const password = this.configService.get<string>('GMAIL_PASSWORD');
            const appPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');

            if (!user) {
                throw new Error('GMAIL_USER is missing in .env file');
            }

            // Use app password if available, otherwise regular password
            const pass = appPassword || password;

            if (!pass) {
                throw new Error('GMAIL_APP_PASSWORD or GMAIL_PASSWORD is missing in .env file');
            }

            this.transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: user.trim(),
                    pass: pass.trim(),
                },
            });

            // Test the connection
            await this.transporter.verify();
            this.logger.log('✅ Gmail email service is READY');

        } catch (error) {
            this.logger.error('❌ Email service FAILED to start');
            this.logger.error('ERROR:', error.message);

            // Helpful error messages
            if (error.message.includes('Invalid login')) {
                this.logger.error('SOLUTION: Generate App Password:');
                this.logger.error('1. Go to: https://myaccount.google.com/apppasswords');
                this.logger.error('2. Generate app password for "Mail"');
                this.logger.error('3. Copy 16-character password (NO SPACES) to GMAIL_APP_PASSWORD');
            }

            throw new Error(`Email service failed: ${error.message}`);
        }
    }

    async sendVerificationEmail(email: string, name: string, token: string) {
        try {
            // const verificationUrl = `${this.baseUrl}/verify-email?token=${token}`;
            const verificationUrl = `http://localhost:3000/auth/verify-email?token=${token}`;
            const fromEmail = this.configService.get<string>('EMAIL_FROM', '"Parent Portal" <noreply@parentportal.com>');

            const mailOptions = {
                from: fromEmail,
                to: email,
                subject: 'Verify Your Email - Parent Portal',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome ${name}!</h2>
            <p>Click the button below to verify your email address:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                VERIFY EMAIL
              </a>
            </div>
            
            <p>Or copy this link:</p>
            <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
              ${verificationUrl}
            </p>
            
            <p><strong>This link expires in 24 hours.</strong></p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              If you didn't create this account, ignore this email.
            </p>
          </div>
        `,
            };

            this.logger.log(`📤 Sending verification email to: ${email}`);
            const result = await this.transporter.sendMail(mailOptions);

            this.logger.log(`✅ Email sent successfully to ${email}`);
            this.logger.log(`📧 Message ID: ${result.messageId}`);

            return {
                success: true,
                message: `Verification email sent to ${email}`,
                messageId: result.messageId,
            };

        } catch (error) {
            this.logger.error(`❌ FAILED to send email to ${email}:`, error.message);
            throw new Error(`Failed to send verification email: ${error.message}`);
        }
    }

    async sendPasswordResetEmail(email: string, name: string, token: string) {
        try {
            // const resetUrl = `${this.baseUrl}/reset-password?token=${token}`;
            const resetUrl = `http://localhost:3000/auth/reset-password?token=${token}`;
            const fromEmail = this.configService.get<string>('EMAIL_FROM', '"Parent Portal" <noreply@parentportal.com>');

            const mailOptions = {
                from: fromEmail,
                to: email,
                subject: 'Reset Your Password - Parent Portal',
                html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset</h2>
            <p>Hello ${name},</p>
            <p>Click below to reset your password:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                RESET PASSWORD
              </a>
            </div>
            
            <p>Or copy this link:</p>
            <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
              ${resetUrl}
            </p>
            
            <p><strong>⚠️ This link expires in 1 hour and can only be used once.</strong></p>
            
            <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p><strong>Security Alert:</strong> If you didn't request this, please ignore this email.</p>
            </div>
          </div>
        `,
            };

            this.logger.log(`📤 Sending password reset email to: ${email}`);
            const result = await this.transporter.sendMail(mailOptions);

            this.logger.log(`✅ Password reset email sent to ${email}`);

            return {
                success: true,
                message: `Password reset email sent to ${email}`,
                messageId: result.messageId,
            };

        } catch (error) {
            this.logger.error(`❌ FAILED to send password reset email:`, error.message);
            throw new Error(`Failed to send password reset email: ${error.message}`);
        }
    }

    // Test if email is working
    async testEmailConnection() {
        try {
            await this.transporter.verify();
            return {
                success: true,
                message: '✅ Email service is working correctly',
                provider: 'Gmail',
            };
        } catch (error) {
            return {
                success: false,
                message: `❌ Email service error: ${error.message}`,
                provider: 'Gmail',
            };
        }
    }

    // Send a test email
    async sendTestEmail(toEmail: string) {
        try {
            const fromEmail = this.configService.get<string>('EMAIL_FROM');
            const userEmail = this.configService.get<string>('GMAIL_USER');

            const testTo = toEmail || userEmail;

            if (!testTo) {
                throw new Error('No email address to send test to');
            }

            const mailOptions = {
                from: fromEmail,
                to: testTo,
                subject: '✅ Parent Portal - Email Test',
                html: `
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">
            <h1 style="color: #4F46E5;">✅ EMAIL SERVICE IS WORKING!</h1>
            <p>Parent Portal email system is configured correctly.</p>
            <p>Date: ${new Date().toLocaleString()}</p>
          </div>
        `,
            };

            const result = await this.transporter.sendMail(mailOptions);

            return {
                success: true,
                message: `Test email sent to ${testTo}`,
                messageId: result.messageId,
            };

        } catch (error) {
            return {
                success: false,
                message: `Failed to send test email: ${error.message}`,
            };
        }
    }
}

// import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as nodemailer from 'nodemailer';

// @Injectable()
// export class EmailService implements OnModuleInit {
//     private transporter: nodemailer.Transporter;
//     private readonly logger = new Logger(EmailService.name);
//     private readonly baseUrl: string;
//     private isEtherealTransporter = false; // Track transporter type

//     constructor(private configService: ConfigService) {
//         this.baseUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
//     }

//     async onModuleInit() {
//         await this.initializeTransporter();
//     }

//     private async initializeTransporter() {
//         // For development, use Ethereal Email (fake SMTP service)
//         if (this.configService.get<string>('NODE_ENV') === 'development') {
//             await this.setupEtherealTransporter();
//         } else {
//             // For production, configure with real email service
//             await this.setupProductionTransporter();
//         }
//     }

//     private async setupEtherealTransporter() {
//         try {
//             // Create a test account on ethereal.email
//             const testAccount = await nodemailer.createTestAccount();

//             this.transporter = nodemailer.createTransport({
//                 host: 'smtp.ethereal.email',
//                 port: 587,
//                 secure: false,
//                 auth: {
//                     user: testAccount.user,
//                     pass: testAccount.pass,
//                 },
//             });

//             this.isEtherealTransporter = true;
//             this.logger.log(`Ethereal Email configured: ${testAccount.user}`);
//             this.logger.log(`Ethereal Password: ${testAccount.pass}`);

//             // Test the connection
//             await this.transporter.verify();
//             this.logger.log('Ethereal transporter connection verified');

//         } catch (error) {
//             this.logger.error('Failed to setup Ethereal transporter:', error);

//             // Fallback to a dummy transporter that logs emails instead of sending
//             this.setupDummyTransporter();
//         }
//     }

//     private async setupProductionTransporter() {
//         const host = this.configService.get<string>('SMTP_HOST');
//         const port = this.configService.get<number>('SMTP_PORT', 587);

//         if (!host) {
//             this.logger.error('SMTP_HOST is not configured for production');
//             this.setupDummyTransporter();
//             return;
//         }

//         this.transporter = nodemailer.createTransport({
//             host: host,
//             port: port,
//             secure: this.configService.get<boolean>('SMTP_SECURE', false),
//             auth: {
//                 user: this.configService.get<string>('SMTP_USER'),
//                 pass: this.configService.get<string>('SMTP_PASSWORD'),
//             },
//         });

//         this.isEtherealTransporter = false;

//         try {
//             await this.transporter.verify();
//             this.logger.log('Production transporter connection verified');
//         } catch (error) {
//             this.logger.error('Failed to connect to production SMTP server:', error);
//             throw error;
//         }
//     }

//     private setupDummyTransporter() {
//         // Create a dummy transporter that logs emails instead of sending
//         const dummyTransport = {
//             name: 'dummy',
//             version: '1.0.0',
//             send: async (mail: any, callback: (err: Error | null, info: any) => void) => {
//                 // This is a dummy implementation
//                 if (callback) {
//                     callback(null, {});
//                 }
//             }
//         };

//         // Cast to any to bypass type checking for our custom transporter
//         this.transporter = nodemailer.createTransport(dummyTransport as any);

//         // Override the sendMail method to log instead of sending
//         const originalSendMail = this.transporter.sendMail.bind(this.transporter);
//         this.transporter.sendMail = async (mailOptions: any, callback?: any): Promise<any> => {
//             this.logger.log('📧 [DUMMY EMAIL] Would send email:');
//             this.logger.log(`   To: ${mailOptions.to}`);
//             this.logger.log(`   Subject: ${mailOptions.subject}`);
//             this.logger.log(`   Preview: ${(mailOptions.html as string)?.substring(0, 100)}...`);

//             // Create a fake response
//             const fakeResponse = {
//                 messageId: `<dummy-${Date.now()}@parentportal.com>`,
//                 envelope: {
//                     from: mailOptions.from,
//                     to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
//                 },
//                 accepted: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
//                 rejected: [],
//                 pending: [],
//                 response: '250 Dummy email logged',
//             };

//             if (callback) {
//                 callback(null, fakeResponse);
//                 return fakeResponse;
//             }

//             return Promise.resolve(fakeResponse);
//         };

//         this.isEtherealTransporter = false;
//         this.logger.warn('Using dummy email transporter. Emails will be logged but not sent.');
//     }

//     async sendVerificationEmail(email: string, name: string, token: string) {
//         // Check if transporter is initialized
//         if (!this.transporter) {
//             this.logger.error('Email transporter not initialized');
//             throw new Error('Email service not available');
//         }

//         const verificationUrl = `${this.baseUrl}/verify-email?token=${token}`;

//         const mailOptions = {
//             from: '"Parent Portal" <noreply@parentportal.com>',
//             to: email,
//             subject: 'Verify Your Email - Parent Portal',
//             html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2>Welcome to Parent Portal, ${name}!</h2>
//           <p>Thank you for creating an account. Please verify your email address by clicking the link below:</p>
//           <p style="text-align: center; margin: 30px 0;">
//             <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
//               Verify Email Address
//             </a>
//           </p>
//           <p>Or copy and paste this link in your browser:</p>
//           <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
//           <p>This link will expire in 24 hours.</p>
//           <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
//           <p style="color: #999; font-size: 12px;">
//             If you didn't create an account, you can safely ignore this email.
//           </p>
//         </div>
//       `,
//         };

//         try {
//             const info = await this.transporter.sendMail(mailOptions);

//             if (this.configService.get<string>('NODE_ENV') === 'development') {
//                 // For Ethereal, show the preview URL
//                 if (this.isEtherealTransporter) {
//                     const previewUrl = nodemailer.getTestMessageUrl(info);
//                     this.logger.log(`📧 Verification email sent. Preview: ${previewUrl}`);
//                 } else {
//                     this.logger.log(`📧 Verification email sent to ${email}`);
//                 }
//             }

//             return info;
//         } catch (error) {
//             this.logger.error(`Failed to send verification email to ${email}:`, error);
//             throw error;
//         }
//     }

//     async sendPasswordResetEmail(email: string, name: string, token: string) {
//         // Check if transporter is initialized
//         if (!this.transporter) {
//             this.logger.error('Email transporter not initialized');
//             throw new Error('Email service not available');
//         }

//         const resetUrl = `${this.baseUrl}/reset-password?token=${token}`;

//         const mailOptions = {
//             from: '"Parent Portal" <noreply@parentportal.com>',
//             to: email,
//             subject: 'Reset Your Password - Parent Portal',
//             html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2>Password Reset Request</h2>
//           <p>Hello ${name},</p>
//           <p>We received a request to reset your password. Click the link below to create a new password:</p>
//           <p style="text-align: center; margin: 30px 0;">
//             <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
//               Reset Password
//             </a>
//           </p>
//           <p>Or copy and paste this link in your browser:</p>
//           <p style="color: #666; word-break: break-all;">${resetUrl}</p>
//           <p>This link will expire in 1 hour.</p>
//           <p>If you didn't request a password reset, you can safely ignore this email.</p>
//           <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
//           <p style="color: #999; font-size: 12px;">
//             For security reasons, this link can only be used once.
//           </p>
//         </div>
//       `,
//         };

//         try {
//             const info = await this.transporter.sendMail(mailOptions);

//             if (this.configService.get<string>('NODE_ENV') === 'development') {
//                 // For Ethereal, show the preview URL
//                 if (this.isEtherealTransporter) {
//                     const previewUrl = nodemailer.getTestMessageUrl(info);
//                     this.logger.log(`📧 Password reset email sent. Preview: ${previewUrl}`);
//                 } else {
//                     this.logger.log(`📧 Password reset email sent to ${email}`);
//                 }
//             }

//             return info;
//         } catch (error) {
//             this.logger.error(`Failed to send password reset email to ${email}:`, error);
//             throw error;
//         }
//     }
// }

// import { Injectable, Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import * as nodemailer from 'nodemailer';

// @Injectable()
// export class EmailService {
//     private transporter: nodemailer.Transporter;
//     private readonly logger = new Logger(EmailService.name);
//     private readonly baseUrl: string;

//     constructor(private configService: ConfigService) {
//         this.baseUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

//         // For development, you can use Ethereal Email (fake SMTP service)
//         if (this.configService.get<string>('NODE_ENV') === 'development') {
//             this.setupEtherealTransporter();
//         } else {
//             // For production, configure with real email service
//             this.setupProductionTransporter();
//         }
//     }

//     private async setupEtherealTransporter() {
//         // Create a test account on ethereal.email
//         const testAccount = await nodemailer.createTestAccount();

//         this.transporter = nodemailer.createTransport({
//             host: 'smtp.ethereal.email',
//             port: 587,
//             secure: false,
//             auth: {
//                 user: testAccount.user,
//                 pass: testAccount.pass,
//             },
//         });

//         this.logger.log(`Ethereal Email configured: ${testAccount.user}`);
//         this.logger.log(`Ethereal Password: ${testAccount.pass}`);
//     }

//     private setupProductionTransporter() {
//         this.transporter = nodemailer.createTransport({
//             host: this.configService.get<string>('SMTP_HOST'),
//             port: this.configService.get<number>('SMTP_PORT'),
//             secure: this.configService.get<boolean>('SMTP_SECURE', false),
//             auth: {
//                 user: this.configService.get<string>('SMTP_USER'),
//                 pass: this.configService.get<string>('SMTP_PASSWORD'),
//             },
//         });
//     }

//     async sendVerificationEmail(email: string, name: string, token: string) {
//         const verificationUrl = `${this.baseUrl}/verify-email?token=${token}`;

//         const mailOptions = {
//             from: '"Parent Portal" <noreply@parentportal.com>',
//             to: email,
//             subject: 'Verify Your Email - Parent Portal',
//             html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2>Welcome to Parent Portal, ${name}!</h2>
//           <p>Thank you for creating an account. Please verify your email address by clicking the link below:</p>
//           <p style="text-align: center; margin: 30px 0;">
//             <a href="${verificationUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
//               Verify Email Address
//             </a>
//           </p>
//           <p>Or copy and paste this link in your browser:</p>
//           <p style="color: #666; word-break: break-all;">${verificationUrl}</p>
//           <p>This link will expire in 24 hours.</p>
//           <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
//           <p style="color: #999; font-size: 12px;">
//             If you didn't create an account, you can safely ignore this email.
//           </p>
//         </div>
//       `,
//         };

//         const info = await this.transporter.sendMail(mailOptions);

//         if (this.configService.get<string>('NODE_ENV') === 'development') {
//             this.logger.log(`Verification email sent: ${nodemailer.getTestMessageUrl(info)}`);
//         }
//     }

//     async sendPasswordResetEmail(email: string, name: string, token: string) {
//         const resetUrl = `${this.baseUrl}/reset-password?token=${token}`;

//         const mailOptions = {
//             from: '"Parent Portal" <noreply@parentportal.com>',
//             to: email,
//             subject: 'Reset Your Password - Parent Portal',
//             html: `
//         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
//           <h2>Password Reset Request</h2>
//           <p>Hello ${name},</p>
//           <p>We received a request to reset your password. Click the link below to create a new password:</p>
//           <p style="text-align: center; margin: 30px 0;">
//             <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
//               Reset Password
//             </a>
//           </p>
//           <p>Or copy and paste this link in your browser:</p>
//           <p style="color: #666; word-break: break-all;">${resetUrl}</p>
//           <p>This link will expire in 1 hour.</p>
//           <p>If you didn't request a password reset, you can safely ignore this email.</p>
//           <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
//           <p style="color: #999; font-size: 12px;">
//             For security reasons, this link can only be used once.
//           </p>
//         </div>
//       `,
//         };

//         const info = await this.transporter.sendMail(mailOptions);

//         if (this.configService.get<string>('NODE_ENV') === 'development') {
//             this.logger.log(`Reset email sent: ${nodemailer.getTestMessageUrl(info)}`);
//         }
//     }
// }