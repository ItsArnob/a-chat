import { LoginResponseDto } from "@/dto/auth.dto";
import { UserNoProfile } from "@/models/user.model";
import { UsersService } from "@/users/users.service";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid/async";

@Injectable()
export class AuthService {
    private logger = new Logger(AuthService.name);

    constructor(
        private userService: UsersService,
        private jwtService: JwtService
    ) {}

    async validateUser(
        username: string,
        password: string
    ): Promise<UserNoProfile> {
        const user = await this.userService.findOneNoProfileByName(username);
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid)
            throw new UnauthorizedException({
                msg: `Invalid username or password.`,
                id: user.id,
            });
        return user;
    }

    async login(user: UserNoProfile): Promise<LoginResponseDto> {
        const payload = { sub: user.id, jti: await nanoid(32) };
        const jwt = await this.jwtService.signAsync(payload);
        await this.userService.setToken(user.id, payload.jti);

        this.logger.log({
            event: `authn_login_success:${user.id}`,
            msg: "User login succeeded.",
        });
        return {
            token: jwt,
        };
    }

    async logout(id: string): Promise<void> {
        await this.userService.setToken(id, null);
        this.logger.log({
            event: `authn_logout_success:${id}`,
            msg: "User logout succeeded.",
        });
    }
}
