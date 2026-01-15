import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
    @ApiProperty({ example: 'parent@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;
}