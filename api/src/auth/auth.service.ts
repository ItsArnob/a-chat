import { LoginResponseDto } from "@/dto/auth.dto";
import { UsersService } from "@/users/users.service";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Account } from "@prisma/client";
import bcrypt from "bcrypt";
import { nanoid } from "nanoid/async";

@Injectable()
export class AuthService {
    constructor(
        private userService: UsersService,
        private jwtService: JwtService
    ) {}

    async validateUser(
        username: string,
        password: string
    ): Promise<Account> {
        const user = await this.userService.findOneByName(username);
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) throw new UnauthorizedException("Invalid username or password."); 
        return user;
    };

    async login(user: Account): Promise<LoginResponseDto> {
        const payload = { sub: user.id, jti: await nanoid(32) };
        const jwt = await this.jwtService.signAsync(payload);

        return { ...await this.userService.setToken(user.id, payload.jti), token: jwt };

    };

    async logout(userId: string): Promise<void> {
        await this.userService.setToken(userId, null);
    }
    
}