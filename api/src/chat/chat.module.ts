import { AuthModule } from "@/auth/auth.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { UsersModule } from "@/users/users.module";
import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";

@Module({
    providers: [ChatGateway, ChatService],
    imports: [AuthModule, UsersModule, PrismaModule],
    controllers: [ChatController],
})
export class ChatModule {}
