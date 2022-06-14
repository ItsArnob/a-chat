import { JwtAuthGuard } from "@/common/jwt-auth.guard";
import { Controller, Get, Param, Post, Req, UseGuards, } from "@nestjs/common";
import { Chat } from "@prisma/client";
import { Request } from "express";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";

@Controller("chat")
export class ChatController {
    constructor(
        private chatService: ChatService,
        private chatGateway: ChatGateway,
    ) {}

    @Post("/:userId")
    @UseGuards(JwtAuthGuard)
    async createChat(
        @Req() req: Request,
        @Param("userId") userId: string,
    ): Promise<Chat> {
        const result = await this.chatService.getDirectMessageChat(
            req.user.id,
            userId,
        ); // this will un-hide the chat if it's hidden in the future, that's why it emits a ws event.
        this.chatGateway.server
            .to(req.user.id)
            .to(userId) // TODO: IDEA: in the future if/when we have a chat that can be hidden, we need to notify the other user only if the chat is created
            .emit("Chat:Update", result);
        return result;
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    async getChats(@Req() req: Request): Promise<Chat[]> {
        return await this.chatService.getChatsOfUser(req.user.id);
    }

    // TODO: one for setting nickname
}
