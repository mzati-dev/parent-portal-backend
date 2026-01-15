import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'John Doe' })
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: 'parent@example.com' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'SecurePass123' })
    @IsNotEmpty()
    @MinLength(8)
    password: string;
}