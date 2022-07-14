import { ChatService } from '@/chat/chat.service';
import { OnlineSocketsList } from '@/dto/chat.dto';
import { Chat, Message } from '@/models/chat.model';
import { RelationStatus, User } from '@/models/user.model';
import { UsersService } from '@/users/users.service';
import { WebsocketGateway } from '@/websocket/websocket.gateway';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Socket } from 'socket.io';

@Injectable()
export class WebsocketService implements OnModuleInit {

    private chatService: ChatService;
    private usersService: UsersService;
    private websocketGateway: WebsocketGateway;

    constructor(private moduleRef: ModuleRef) {}

    async getUserFromSocket(socket: Socket): Promise<User> {
        const token = socket.handshake.auth.token;
        return this.usersService.findOneByToken(token);
    }

    async authenticateUserFromSocket(socket: Socket, sockets: OnlineSocketsList) {
        const user = await this.getUserFromSocket(socket);
        const chats = await this.chatService.getChatsOfUser(user.id);

        const relatedUserIds = user.profile?.relations?.map(user => user.id) || [];
        const lastMessageIds: string[] = [];
        // get userIds that are related by chats but aren't friends/outgoings/incomings/etc.
        chats.forEach(chat => {
            if(chat.lastMessageId) lastMessageIds.push(chat.lastMessageId);
            chat.recipients.forEach(recipient => {
                if(recipient.id === user.id) return;

                const isRecipientInRelatedUsers = relatedUserIds.find(relatedUser => relatedUser === recipient.id);
                if(isRecipientInRelatedUsers) return;

                relatedUserIds.push(recipient.id);

            });
        });

        const relatedUsers = relatedUserIds.length
            ? await this.usersService.findRelatedUsersWithStatus(relatedUserIds, sockets, user.profile?.relations || [])
            : [];

        const lastMessages = await this.chatService.getMessagesById(lastMessageIds);
        return {
            id: user.id,
            username: user.username,
            users: relatedUsers,
            chats,
            lastMessages,
        }

    }
    async getFriendIdsFromSocket(client: Socket) {
        return this.usersService.getFriendIds(client.user.id);
    }

    emitFriendAdded(userId: string, receiverUserId: string, chat: Chat) {
        this.emitUpdateUser(userId, {
            id: receiverUserId,
            online: this.userOnline(receiverUserId),
            relationship: RelationStatus.Friend,
        })
        this.emitUpdateUser(receiverUserId, {
            id: userId,
            online: this.userOnline(userId),
            relationship: RelationStatus.Friend,
        })
        this.emitUpdateChat([userId, receiverUserId], chat)
    }

    emitNewFriendRequest(user: { id: string, username: string }, receiverUser: { id: string, username: string }) {

        this.emitUpdateUser(user.id, {
            id: receiverUser.id,
            username: receiverUser.username,
            relationship: RelationStatus.Outgoing,
        });

        this.emitUpdateUser(receiverUser.id, {
           id: user.id,
           username: user.username,
           relationship: RelationStatus.Incoming,
       });

    }

    emitFriendRemoved(userId: string, receiverUserId: string, message: string) {

        this.emitUpdateUser(userId, {
            id: receiverUserId,
            relationship: RelationStatus.None,
            online: false,
        }, message)

        this.emitUpdateUser(receiverUserId, {
            id: userId,
            relationship: RelationStatus.None,
            online: false,
        }, message)
    }

    emitUpdateUser(emitTo: string | string[] , data: { [key: string]: any }, message?: string) {
        this.websocketGateway.server.to(emitTo).emit("User:Update", {
            user: data,
            message: message
        })
    }
    emitUpdateChat(emitTo: string[], chat: Chat) {

        this.websocketGateway.server
        .to(emitTo)
        .emit('Chat:Update', { chat });
    }
    emitNewMessage(recipients: string[], message: Message, ackId?: string) {
        this.websocketGateway.server.to(recipients).emit("Message:New", { ...message, ackId: ackId });
    }

    emitException(socket: Socket, type: string, message: any) {
        socket.emit('exception', {
            type,
            message
        })
    }


    userOnline(userId: string): Date | boolean {
        return this.websocketGateway.sockets.get(userId)?.online || false;
    }

    onModuleInit(): any {
        this.usersService = this.moduleRef.get(UsersService, { strict: false });
        this.chatService = this.moduleRef.get(ChatService, { strict: false });
        this.websocketGateway = this.moduleRef.get(WebsocketGateway);
    }

}
