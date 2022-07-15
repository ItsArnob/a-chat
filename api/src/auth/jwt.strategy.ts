import { UserNoProfile } from "@/models/user.model";
import { UsersService } from "@/users/users.service";
import {
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
    UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { PinoLogger } from "nestjs-pino";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    private logger = new Logger(JwtStrategy.name);

    constructor(
        private readonly pinoLogger: PinoLogger,
        configService: ConfigService,
        private usersService: UsersService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: true, // it doesn't matter as we are handing sessions server side.
            secretOrKey: configService.get("jwt.secret"),
        });
    }

    async validate(payload: {
        sub: string;
        jti: string;
    }): Promise<UserNoProfile> {
        try {
            const user = await this.usersService.findOneNoProfileById(
                payload.sub
            );

            if (user.token !== payload.jti) throw new UnauthorizedException();
            this.pinoLogger.assign({ userId: user.id });
            return user;
        } catch (e) {
            if (e instanceof NotFoundException)
                this.logger.warn({
                    event: `session_user_not_found:${payload.sub}`,
                    msg: "Valid session token was provided but the user couldn't be found.",
                });
            else if (e instanceof UnauthorizedException)
                this.logger.warn({
                    event: `session_use_after_expire:${payload.sub}`,
                    msg: "User attempted to use a session token that doesn't match the currently active session. ",
                });

            if (
                e instanceof NotFoundException ||
                e instanceof UnauthorizedException
            ) {
                throw new UnauthorizedException(
                    "Invalid authentication token."
                );
            } else {
                this.logger.error({
                    event: `system_unknown_error,session_validation`,
                    msg: "An unknown error occurred during session validation.",
                    err: e,
                });
                throw new InternalServerErrorException();
            }
        }
    }
}
