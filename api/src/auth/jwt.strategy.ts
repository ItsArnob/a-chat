import { UserNoProfile } from '@/models/user.model';
import { UsersService } from '@/users/users.service';
import {
    Injectable,
    InternalServerErrorException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        configService: ConfigService,
        private usersService: UsersService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get('jwt.secret'),
        });
    }

    async validate(payload: { sub: string; jti: string }): Promise<UserNoProfile> {
        try {
            const user = await this.usersService.findOneNoProfileById(payload.sub);

            if (user.token !== payload.jti) throw new UnauthorizedException();
            return user;
        } catch (e) {
            if (
                e instanceof NotFoundException ||
                e instanceof UnauthorizedException
            ) {
                throw new UnauthorizedException(
                    'Invalid authentication token.'
                );
            } else throw new InternalServerErrorException();
        }
    }
}
