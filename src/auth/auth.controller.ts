import { Controller, Post, Body, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
    return this.authService.login(user);
  }

  // ===== START: TEACHER LOGIN ENDPOINT =====
  @Post('teachers/login')
  @ApiOperation({ summary: 'Teacher login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Teacher login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async teacherLogin(@Body() loginDto: LoginDto) {
    const teacher = await this.authService.validateTeacher(
      loginDto.email,
      loginDto.password
    );
    return this.authService.teacherLogin(teacher);
  }
  // ===== END: TEACHER LOGIN ENDPOINT =====

  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 400, description: 'User already exists or validation failed' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(
      registerDto.fullName,
      registerDto.email,
      registerDto.password,
    );
  }

  @Get('verify-email')
  @ApiOperation({ summary: 'Verify email address' })
  @ApiQuery({ name: 'token', required: true, description: 'Verification token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({ status: 200, description: 'Verification email resent' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async resendVerification(@Body() resendVerificationDto: ResendVerificationDto) {
    return this.authService.resendVerificationEmail(resendVerificationDto.email);
  }

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getProfile(@Req() req) {
    return req.user;
  }
}
// import { Controller, Post, Body, Get, Query, UseGuards, Req } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
// import {
//   ApiTags,
//   ApiOperation,
//   ApiResponse,
//   ApiBody,
//   ApiBearerAuth,
//   ApiQuery
// } from '@nestjs/swagger';
// import { AuthService } from './auth.service';
// import { LoginDto } from './dto/login.dto';
// import { RegisterDto } from './dto/register.dto';
// import { ForgotPasswordDto } from './dto/forgot-password.dto';
// import { ResetPasswordDto } from './dto/reset-password.dto';
// import { ResendVerificationDto } from './dto/resend-verification.dto';
// // import { ResetPasswordDto } from './dto/reset-password.dto';
// // import { ResendVerificationDto } from './dto/resend-verification.dto';

// @ApiTags('auth')
// @Controller('auth')
// export class AuthController {
//   constructor(private authService: AuthService) { }

//   @Post('login')
//   @ApiOperation({ summary: 'User login' })
//   @ApiBody({ type: LoginDto })
//   @ApiResponse({ status: 200, description: 'Login successful' })
//   @ApiResponse({ status: 401, description: 'Invalid credentials' })
//   async login(@Body() loginDto: LoginDto) {
//     const user = await this.authService.validateUser(loginDto.email, loginDto.password);
//     return this.authService.login(user);
//   }

//   @Post('register')
//   @ApiOperation({ summary: 'User registration' })
//   @ApiBody({ type: RegisterDto })
//   @ApiResponse({ status: 201, description: 'Registration successful' })
//   @ApiResponse({ status: 400, description: 'User already exists or validation failed' })
//   async register(@Body() registerDto: RegisterDto) {
//     return this.authService.register(
//       registerDto.fullName,
//       registerDto.email,
//       registerDto.password,
//     );
//   }

//   @Get('verify-email')
//   @ApiOperation({ summary: 'Verify email address' })
//   @ApiQuery({ name: 'token', required: true, description: 'Verification token' })
//   @ApiResponse({ status: 200, description: 'Email verified successfully' })
//   @ApiResponse({ status: 400, description: 'Invalid or expired token' })
//   async verifyEmail(@Query('token') token: string) {
//     return this.authService.verifyEmail(token);
//   }

//   @Post('forgot-password')
//   @ApiOperation({ summary: 'Request password reset' })
//   @ApiBody({ type: ForgotPasswordDto })
//   @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
//   async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
//     return this.authService.forgotPassword(forgotPasswordDto.email);
//   }

//   @Post('reset-password')
//   @ApiOperation({ summary: 'Reset password with token' })
//   @ApiBody({ type: ResetPasswordDto })
//   @ApiResponse({ status: 200, description: 'Password reset successful' })
//   @ApiResponse({ status: 400, description: 'Invalid or expired token' })
//   async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
//     return this.authService.resetPassword(
//       resetPasswordDto.token,
//       resetPasswordDto.newPassword,
//     );
//   }

//   @Post('resend-verification')
//   @ApiOperation({ summary: 'Resend verification email' })
//   @ApiBody({ type: ResendVerificationDto })
//   @ApiResponse({ status: 200, description: 'Verification email resent' })
//   @ApiResponse({ status: 400, description: 'Invalid request' })
//   async resendVerification(@Body() resendVerificationDto: ResendVerificationDto) {
//     return this.authService.resendVerificationEmail(resendVerificationDto.email);
//   }

//   @Get('profile')
//   @UseGuards(AuthGuard('jwt'))
//   @ApiBearerAuth()
//   @ApiOperation({ summary: 'Get user profile' })
//   @ApiResponse({ status: 200, description: 'User profile retrieved' })
//   @ApiResponse({ status: 401, description: 'Unauthorized' })
//   getProfile(@Req() req) {
//     return req.user;
//   }
// }