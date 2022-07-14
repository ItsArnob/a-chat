import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { ulid } from 'ulid';

import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { config, validate } from './config';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';
import { WebsocketModule } from './websocket/websocket.module';

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
            useFactory: async(config: ConfigService) => {
                return {
                pinoHttp: {
                    level: config.get('logLevel') as string,
                    genReqId() {
                        return ulid();
                    },
                    customProps(req: any, res) {
                        if(req.user) return { userId: req.user.id }
                        return {}
                    },
                    customErrorObject(req, res, err, loggableObject) {
                        return { err: "see error logs related to this request id."}
                    },
                    serializers: {
                        req(req) {
                            return {
                                id: req.id,
                                method: req.method,
                                url: req.url
                            }
                        },
                        res(res) {

                            return {
                                status_code: res.statusCode,
                                content_length: res.headers['content-length']
                            }
                        }
                    },
                }
            }
            }
        }),
        AuthModule,
        UsersModule,
        ChatModule,
        DatabaseModule,
        WebsocketModule,
    ],
})
export class AppModule {}
