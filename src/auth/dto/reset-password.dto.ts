import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, MinLength } from 'class-validator';

export class ResetPasswordDto {
    @ApiProperty({ description: 'Reset token received via email' })
    @IsNotEmpty()
    token: string;

    @ApiProperty({ example: 'NewSecurePass123' })
    @IsNotEmpty()
    @MinLength(8)
    newPassword: string;
}