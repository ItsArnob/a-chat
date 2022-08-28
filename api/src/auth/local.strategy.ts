import { UserNoProfile } from "@/models/user.model";
import {
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { Strategy } from "passport-local";
import { AuthService } from "./auth.service";

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(
        private authService: AuthService,
        @InjectPinoLogger(LocalStrategy.name)
        private logger: PinoLogger    
    ) {
        super();
    }
    
    async validate(username: string, password: string): Promise<UserNoProfile> {
        try {
            return await this.authService.validateUser(username, password);
        } catch (e) {
            if (e instanceof UnauthorizedException) {
                throw new UnauthorizedException(
                    "Invalid username or password."
                );
            } else {
                this.logger.error({
                    event: `system_unknown_error,authn`,
                    msg: "An unknown error occurred during authentication.",
                    err: e,
                });
                throw new InternalServerErrorException();
            }
        }
    }
}
