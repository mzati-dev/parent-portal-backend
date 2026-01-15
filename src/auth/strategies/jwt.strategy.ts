import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private configService: ConfigService,
        @InjectRepository(User)
        private usersRepository: Repository<User>,
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET', 'your-secret-key-change-this'),
        });
    }

    async validate(payload: any) {
        const user = await this.usersRepository.findOne({
            where: { id: payload.sub },
            select: ['id', 'email', 'fullName', 'isEmailVerified']
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        if (!user.isEmailVerified) {
            throw new UnauthorizedException('Please verify your email address');
        }

        return user;
    }
}