import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { UlidValidatorPipe } from "@/common/pipes/ulid-validator.pipe";
import { GetMessagesQueryDto, messageDto, SaveDirectMessageResponseDto } from "@/dto/chat.dto";
import { Message } from "@/models/chat.model";
import { WebsocketService } from "@/websocket/websocket.service";
import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";

import { ChatService } from "./chat.service";

@UseGuards(JwtAuthGuard)
@Controller("chat")
export class ChatController {
    constructor(
        private chatService: ChatService,
        private websocketService: WebsocketService
    ) {}

    /* @Post('/:id') // TODO: change this in the client
    async createChat(
        @Req() req: Request,
        @Query("type") type: string,
        @Param('id', new ObjectIdValidationPipe()) userId: ObjectId
    ): Promise<Chat> {
        if(type?.toLowerCase() !== "user") throw new NotImplementedException("Only user ids are supported.");
        const result = await this.chatService.getDirectMessageChat(
            req.user._id,
            userId
        ); // this will un-hide the chat if it's hidden in the future, that's why it emits a ws event.
        this.chatGateway.server
            .to(req.user._id.toString())
            .to(userId.toString()) // TODO: IDEA: in the future if/when we have a chat that can be hidden, we need to notify the other user only if the chat is created
            .emit('Chat:Update', result);
        return result;
    }

*/

    @Post("/:chatId/messages")
    async saveDirectMessage(
        @Req() req: Request,
        @Param("chatId", new UlidValidatorPipe()) chatId: string,
        @Body() body: messageDto
    ): Promise<SaveDirectMessageResponseDto> {
        const { recipients, ...data } =
            await this.chatService.saveDirectMessage(
                req.user.id,
                chatId,
                body.content
            );
        this.websocketService.emitNewMessage(recipients, data, body.ackId);
        return { ...data, ackId: body.ackId };
    }

    @Get("/:chatId/messages")
    async getMessages(
        @Req() req: Request,
        @Param("chatId", new UlidValidatorPipe()) chatId: string,
        @Query() query: GetMessagesQueryDto
    ): Promise<Message[]> {
        return this.chatService.getMessages(
            req.user.id,
            chatId,
            query.before,
            query.after,
            query.limit
        );
    }
    // TODO: one for setting nickname
}
