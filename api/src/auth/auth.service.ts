import { LoginResponseDto } from "@/dto/auth.dto";
import { UserNoProfile } from "@/models/user.model";
import { UsersService } from "@/users/users.service";
import { Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import bcrypt from "bcrypt";

@Injectable()
export class AuthService {
    private logger = new Logger(AuthService.name);

    constructor(
        private userService: UsersService,
    ) {}

    async validateUser(
        username: string,
        password: string
    ): Promise<UserNoProfile> {
        const user = await this.userService.findOneNoProfileByName(username);
        if(!user) {
            this.logger.warn({
                event: `authn_login_fail:${username}`,
                msg: `Non-existent user account login attempted.`,
            });
            throw new UnauthorizedException("User not found.");
        };

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            this.logger.warn({
                event: `authn_login_fail:${user.id}`,
                msg: "User attempted to log in using an incorrect password.",
            });
            throw new UnauthorizedException("Incorrect password.");
        };
        
        return user;
    }
}
