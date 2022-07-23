import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { ulid } from "ulid";

import { AuthModule } from "@/auth/auth.module";
import { ChatModule } from "@/chat/chat.module";
import { config, validate } from "./config";
import { DatabaseModule } from "@/database/database.module";
import { UsersModule } from "@/users/users.module";
import { WebsocketModule } from "@/websocket/websocket.module";

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [config],
            isGlobal: true,
            validate,
        }),
        LoggerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => {
                return {
                    pinoHttp: {
                        autoLogging: !config.get("disableRequestLogging"),
                        level: config.get("logLevel") as string,
                        genReqId() {
                            return ulid();
                        },
                        customProps(req: any, res: any) {
                            return {
                                user_id: req.user?.id,
                                request_id: ulid(),
                                method: req.method,
                                url: req.url,
                                status_code: res.statusCode,
                            };
                        },
                        customAttributeKeys: {
                            responseTime: "response_time",
                        },
                        customErrorObject() {
                            return {
                                err: "see error logs related to this request id.",
                            };
                        },
                        serializers: {
                            req(req) {
                                return;
                            },
                            res(res) {
                                return;
                            },
                        },
                    },
                };
            },
        }),
        AuthModule,
        UsersModule,
        ChatModule,
        DatabaseModule,
        WebsocketModule,
    ],
})
export class AppModule {}
