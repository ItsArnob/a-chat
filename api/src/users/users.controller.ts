import { JwtAuthGuard } from '@/common/jwt-auth.guard';
import {
    Controller,
    Delete,
    Get,
    OnModuleInit,
    Param,
    Put,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { RelationStatus } from '@prisma/client';
import { Request } from 'express';
import { ChatGateway } from '@/chat/chat.gateway';
import { RelationshipStatusWithNone } from '@/dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController implements OnModuleInit {
    private chatGateway: ChatGateway;
    constructor(
        private usersService: UsersService,
        private moduleRef: ModuleRef
    ) {}

    @Put('/:usernameOrId/friend')
    @UseGuards(JwtAuthGuard)
    async addFriend(
        @Param('usernameOrId') usernameOrId: string,
        @Query('type') type: string,
        @Req() req: Request
    ): Promise<{ message: string; user: { id: string; username: string } }> {
        const result = await this.usersService.addFriend(
            usernameOrId,
            req.user,
            type?.toLowerCase() === 'id'
        );
        if (result.message === 'Friend request accepted.') {
            this.chatGateway.server.to(req.user.id).emit('User:Update', {
                user: {
                    id: result.user.id,
                    online: this.isUserOnline(result.user.id),
                    relationship: RelationStatus.Friend,
                },
            });
            this.chatGateway.server.to(result.user.id).emit('User:Update', {
                user: {
                    id: req.user.id,
                    online: this.isUserOnline(req.user.id),
                    relationship: RelationStatus.Friend,
                },
            });
            this.chatGateway.server
                .to(req.user.id)
                .to(result.user.id) // TODO: IDEA: in the future if/when we have a chat that can be hidden, we need to notify the other user only if the chat is created
                .emit('Chat:Update', result.chat);
        } else {
            this.chatGateway.server.to(req.user.id).emit('User:Update', {
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    relationship: RelationStatus.Outgoing,
                },
            });
            this.chatGateway.server.to(result.user.id).emit('User:Update', {
                user: {
                    id: req.user.id,
                    username: req.user.username,
                    relationship: RelationStatus.Incoming,
                },
            });
        }
        return result;
    }

    @Delete('/:id/friend')
    @UseGuards(JwtAuthGuard)
    async removeFriend(
        @Param('id') userId: string,
        @Req() req: Request
    ): Promise<{ message: string; user: { id: string } }> {
        const result = await this.usersService.removeFriend(userId, req.user);
        this.chatGateway.server.to(req.user.id).emit('User:Update', {
            user: {
                id: result.user.id,
                relationship: RelationshipStatusWithNone.None,
                online: false,
            },
            message: result.message,
        });
        this.chatGateway.server.to(result.user.id).emit('User:Update', {
            user: {
                id: req.user.id,
                relationship: RelationshipStatusWithNone.None,
                online: false,
            },
            message: result.message,
        });
        return result;
    }

    @Get('/related')
    @UseGuards(JwtAuthGuard)
    async getRelatedUsers(@Req() req: Request) {
        const relatedUsers = await this.usersService.getRelatedUsers(
            req.user.id
        );
        return relatedUsers ? relatedUsers.users : [];
    }

    isUserOnline(userId: string): boolean {
        return this.chatGateway.sockets[userId]?.length > 0;
    }

    onModuleInit() {
        this.chatGateway = this.moduleRef.get(ChatGateway, { strict: false });
    }
}
