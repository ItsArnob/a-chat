import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { config, validate } from './config';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

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
        PrismaModule,
    ],
})
export class AppModule {}
