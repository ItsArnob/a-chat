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
            if(e instanceof UnauthorizedException) console.log("incorrect password" + " " + username);
            if(e instanceof NotFoundException) console.log("user not found" + " " + username);
            if (
                e instanceof UnauthorizedException ||
                e instanceof NotFoundException
            ) {
                throw new UnauthorizedException(
                    'Invalid username or password.'
                );
            } else {
                this.logger.error(e);
                throw new InternalServerErrorException();
            }
        }
    }
}
