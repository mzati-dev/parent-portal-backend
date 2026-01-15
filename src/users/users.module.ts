import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { PasswordResetToken } from './password-reset-token.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, PasswordResetToken])],
  exports: [TypeOrmModule],
})
export class UsersModule { }