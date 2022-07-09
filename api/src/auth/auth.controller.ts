import { LoginGuard } from '@/common/guards/login.guard';
import { JwtAuthGuard } from '@/common/jwt-auth.guard';
import { GetUserDto, LoginResponseDto } from '@/dto/auth.dto';
import { UsersService } from '@/users/users.service';
import {
    Controller,
    Delete,
    Get,
    HttpCode,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(
        private authService: AuthService,
        private usersService: UsersService
    ) {}

    @Post('login')
    @HttpCode(200)
    @UseGuards(LoginGuard)
    login(@Req() req: Request): Promise<LoginResponseDto> {
        return this.authService.login(req.user);
    }

    @Get('user')
    @UseGuards(JwtAuthGuard)
    user(@Req() req: Request): GetUserDto {
        return {
            id: req.user.id,
            username: req.user.username,
        };
    }

    @Delete('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(200)
    async logout(@Req() req: Request): Promise<void> {
        return this.authService.logout(req.user.id);

    }
}
