import passport from "passport";
import session from 'express-session';
import redisStore from "connect-redis";
import Redis from "ioredis";

import { Inject, Logger, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { ulid } from "ulid";

import { AuthModule } from "@/auth/auth.module";
import { ChatModule } from "@/chat/chat.module";
import { config, validate } from "./config";
import { DatabaseModule } from "@/database/database.module";
import { UsersModule } from "@/users/users.module";
import { WebsocketModule } from "@/websocket/websocket.module";
import { REDIS_PROVIDER } from "./constants";
import { generateSessionId } from "@/utils/session.utils";
import { HeaderSessionMiddleware } from "@/common/middlewares/headerSession.middleware";

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
                            responseTime: "response_time"
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
export class AppModule implements NestModule {
    private logger = new Logger(AppModule.name);
    constructor(
        @Inject(REDIS_PROVIDER)
        private redis: Redis,
        private config: ConfigService
    ) {}
    configure(consumer: MiddlewareConsumer) {

        const RedisStore = redisStore(session);
        const store = new RedisStore({ client: this.redis });

        consumer.apply(
            HeaderSessionMiddleware,
            session({
                genid: (req) => {
                    
                    if(req.user) return generateSessionId(req.user.id);

                    // this 'nouser' id wont make it to the sessionStore.
                    // because sessions are saved *after* authenticating and passport regenerates 
                    // the session after authenticating, which means req.user will be set and we will have a proper sid.
                    // this is just here so express-session doesn't throw a fit.
                    return generateSessionId('nouser');
                },
                secret: this.config.get("sessionSecret") as string,
                resave: false,
                saveUninitialized: false,
                rolling: false,
                store: store,
                cookie: {
                    maxAge: this.config.get("sessionMaxAge") as number,
                    signed: true
                }
            }),
            passport.initialize(),
            passport.session()
        ).forRoutes("*");
    }
}
