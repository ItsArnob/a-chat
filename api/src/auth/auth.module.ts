import { UsersModule } from "@/users/users.module";
import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";
import { LocalStrategy } from "./local.strategy";

@Module({
    imports: [
        UsersModule,
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get("jwt.secret") as string,
                signOptions: { expiresIn: "9999999h" },
            }),
        }),
    ],
    providers: [LocalStrategy, JwtStrategy, AuthService],
    controllers: [AuthController],
})
export class AuthModule {}
