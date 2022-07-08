import { JwtAuthGuard } from '@/common/jwt-auth.guard';
import { ObjectIdValidationPipe } from '@/common/pipes/objectId-validate.pipe';
import { UlidValidatorPipe } from '@/common/pipes/ulid-validator.pipe';
import { GetMessagesQueryDto, messageDto } from '@/dto/chat.dto';
import { Body, Controller, Get, NotImplementedException, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Chat } from '@prisma/client';
import { Request } from 'express';
import { ObjectId } from 'mongodb';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
    constructor(
        private chatService: ChatService,
        private chatGateway: ChatGateway
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

    /*@Get()
    async getChats(@Req() req: Request): Promise<Chat[]> {
        return await this.chatService.getChatsOfUser(req.user._id.toString()); // TODO: should be objectid.
    }
*/
    @Post("/:chatId/messages")
    async saveMessage(
        @Req() req: Request,
        @Param('chatId', new ObjectIdValidationPipe()) chatId: ObjectId,
        @Body() body: messageDto,
    ) {
        const { recipients, ...data } = await this.chatService.saveDirectMessage(req.user.id, chatId, body.content);
        this.chatGateway.server.to(recipients).emit("Message:New", { ...data, ackId: body.ackId });
        return { ...data, ackId: body.ackId };
    }

    @Get("/:chatId/messages")
    async getMessages(
        @Req() req: Request,
        @Param('chatId', new ObjectIdValidationPipe()) chatId: ObjectId,
        @Query() query: GetMessagesQueryDto
    ) {

        return this.chatService.getMessages(req.user.id, chatId, query.before, query.after, query.limit);
    }
    // TODO: one for setting nickname
}
