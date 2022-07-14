import { AuthModule } from '@/auth/auth.module';
import { UsersModule } from '@/users/users.module';
import { WebsocketModule } from '@/websocket/websocket.module';
import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
    providers: [ChatService],
    imports: [AuthModule, UsersModule, WebsocketModule],
    controllers: [ChatController],
    exports: [ChatService]
})
export class ChatModule {}
