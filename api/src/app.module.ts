import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { config, validate } from './config';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from './database/database.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            load: [config],
            isGlobal: true,
            validate,
        }),
        AuthModule,
        UsersModule,
        ChatModule,
        DatabaseModule,
    ],
})
export class AppModule {}
