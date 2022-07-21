import { UsersModule } from "@/users/users.module";
import { WebsocketModule } from "@/websocket/websocket.module";
import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { LocalStrategy } from "./local.strategy";
import { AuthSerializer } from "./serialization.provider";

@Module({
    imports: [
        UsersModule,
        WebsocketModule
    ],
    providers: [LocalStrategy, AuthService, AuthSerializer],
    controllers: [AuthController],
})
export class AuthModule {}
