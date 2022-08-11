import { AuthenticatedGuard } from "@/common/guards/authenticated.guard";
import { UlidValidatorPipe } from "@/common/pipes/ulid-validator.pipe";
import {
    GetMessagesQueryDto,
    messageDto,
    SaveDirectMessageResponseDto,
} from "@/dto/chat.dto";
import { Message } from "@/models/chat.model";
import { WebsocketService } from "@/websocket/websocket.service";
import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
} from "@nestjs/common";
import { Request } from "express";

import { ChatService } from "./chat.service";

@UseGuards(AuthenticatedGuard)
@Controller("chat")
export class ChatController {
    constructor(
        private chatService: ChatService,
        private websocketService: WebsocketService
    ) {}

    @Post("/:chatId/messages")
    async saveDirectMessage(
        @Req() req: Request,
        @Param("chatId", new UlidValidatorPipe()) chatId: string,
        @Body() body: messageDto
    ): Promise<SaveDirectMessageResponseDto> {
        const data = await this.chatService.saveDirectMessage(
            req.user.id,
            chatId,
            body.content
        );
        this.websocketService.emitNewMessage(
            this.websocketService.directChatRoom(chatId),
            data,
            body.ackId
        );
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
