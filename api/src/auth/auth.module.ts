import { UsersModule } from "@/users/users.module";
import { WebsocketModule } from "@/websocket/websocket.module";
import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { BearerStrategy } from "./bearer.strategy";
import { LocalStrategy } from "./local.strategy";

@Module({
    imports: [
        UsersModule,
        WebsocketModule,
    ],
    providers: [LocalStrategy, AuthService, BearerStrategy],
    controllers: [AuthController],
})
export class AuthModule {}
