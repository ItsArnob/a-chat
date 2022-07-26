import { AuthenticatedGuard } from "@/common/guards/authenticated.guard";
import { LoginGuard } from "@/common/guards/login.guard";
import {
    CreateUserDto,
    GetUserDto,
    LoginDto,
    LoginResponseDto,
} from "@/dto/auth.dto";
import { UsersService } from "@/users/users.service";
import { WebsocketService } from "@/websocket/websocket.service";
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    InternalServerErrorException,
    Post,
    Req,
    UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { promisify } from "util";
import { AuthGuard } from "@nestjs/passport";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
    constructor(
        private usersService: UsersService,
        private authService: AuthService,
        private websocketService: WebsocketService
    ) {}

    @Post("login")
    @HttpCode(200)
    @UseGuards(LoginGuard)
    async login(@Req() req: Request, @Body() body: LoginDto) {
        const session = await this.authService.createSession(
            req.user.id,
            req.user.sessionName
        );

        return { id: req.user.id, username: req.user.username, session };
    }

    @Post("signup")
    async createUser(@Body() body: CreateUserDto): Promise<void> {
        return this.usersService.createUser(body.username, body.password);
    }

    @Get("user")
    @UseGuards(AuthenticatedGuard)
    user(@Req() req: Request) {
        return {
            id: req.user.id,
            username: req.user.username,
        };
    }

    @Delete("logout")
    @UseGuards(AuthenticatedGuard)
    @HttpCode(HttpStatus.NO_CONTENT)
    async logout(@Req() req: Request): Promise<void> {
        await this.authService.deleteSession(req.user.sessionId);
        this.websocketService.logoutSession(req.user.sessionId);
    }
}
