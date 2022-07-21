import cookieSignature from "cookie-signature";

import { LoggedInGuard } from "@/common/guards/logged-in.guard";
import { LoginGuard } from "@/common/guards/login.guard";
import { CreateUserDto, GetUserDto, LoginDto, LoginResponseDto } from "@/dto/auth.dto";
import { UsersService } from "@/users/users.service";
import { WebsocketService } from "@/websocket/websocket.service";
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, InternalServerErrorException, Post, Req, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";


@Controller("auth")
export class AuthController {
    constructor(
        private usersService: UsersService,
        private websocketService: WebsocketService,
        private config: ConfigService
    ) {}

    @Post("login")
    @HttpCode(200)
    @UseGuards(LoginGuard)
    login(@Req() req: Request, @Body() body: LoginDto) {
        
        const token = cookieSignature.sign(req.sessionID, this.config.get("sessionSecret") as string);
        return { id: req.user.id, username: req.user.username, token: `s:${token}` };
    }

    @Post("signup")
    async createUser(@Body() body: CreateUserDto): Promise<void> {
        return this.usersService.createUser(body.username, body.password);
    }

    @Get("user")
    @UseGuards(LoggedInGuard)
    user(@Req() req: Request) {
        return {
            id: req.user.id,
            username: req.user.username,
            friendlyName: req.session.friendlyName,
        };
    }

    @Delete("logout")
    @UseGuards(LoggedInGuard)
    @HttpCode(200)
    async logout(@Req() req: Request): Promise<void> {
        const sessionID = req.sessionID;
        req.logout((err: Error) => {
            this.websocketService.logoutSession(sessionID);
            if(!err) return { msg: "logged out." }
            throw new InternalServerErrorException(err);
        });
    }
}
