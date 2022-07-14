import { UserNoProfile } from '@/models/user.model';
import {
    Injectable,
    InternalServerErrorException, Logger,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from './auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super();

    }
    private logger = new Logger(LocalStrategy.name)
    async validate(username: string, password: string): Promise<UserNoProfile> {
        try {
            return await this.authService.validateUser(username, password);
        } catch (e) {
            if(e instanceof NotFoundException) this.logger.warn({ event: `authn_login_fail:${username}`, msg: `Non-existent user account login attempted.` });
            else if(e instanceof UnauthorizedException) this.logger.warn({ event: `authn_login_fail:${(e.getResponse() as any).id}`, msg: 'User attempted to log in using an incorrect password.' });

            if (
                e instanceof UnauthorizedException ||
                e instanceof NotFoundException
            ) {
                throw new UnauthorizedException(
                    'Invalid username or password.'
                );
            } else {
                throw new InternalServerErrorException();
            }
        }
    }
}
