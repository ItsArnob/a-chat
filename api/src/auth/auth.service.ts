import { LoginResponseDto } from '@/dto/auth.dto';
import { UserNoProfile } from '@/models/user.model';
import { UsersService } from '@/users/users.service';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Account } from '@prisma/client';
import bcrypt from 'bcrypt';
import { ObjectId } from 'mongodb';
import { nanoid } from 'nanoid/async';

@Injectable()
export class AuthService {
    constructor(
        private userService: UsersService,
        private jwtService: JwtService
    ) {}

    async validateUser(username: string, password: string): Promise<UserNoProfile> {
        const user = await this.userService.findOneNoProfileByName(username);
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid)
            throw new UnauthorizedException('Invalid username or password.');
        return user;
    }

    async login(user: UserNoProfile): Promise<LoginResponseDto> {
        const payload = { sub: user.id.toString(), jti: await nanoid(32) };
        const jwt = await this.jwtService.signAsync(payload);
        await this.userService.setToken(user.id, payload.jti)
        return {
            token: jwt,
            username: user.username,
            id: user.id,
        };
    }

    async logout(id: ObjectId): Promise<void> {
        await this.userService.setToken(id, null);
    }
}
