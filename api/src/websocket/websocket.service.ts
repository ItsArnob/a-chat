import { ChatService } from "@/chat/chat.service";
import { OnlineSocketsList } from "@/dto/chat.dto";
import { Chat, Message } from "@/models/chat.model";
import { RelationStatus, User } from "@/models/user.model";
import { UsersService } from "@/users/users.service";
import { WebsocketGateway } from "@/websocket/websocket.gateway";
import {
    Inject,
    Injectable,
    InternalServerErrorException,
    Logger,
    OnModuleInit,
    UnauthorizedException,
} from "@nestjs/common";
import { ModuleRef } from "@nestjs/core";
import { Socket } from "socket.io";
import { AuthService } from "@/auth/auth.service";
import { Rooms } from "./websocket.interface";

@Injectable()
export class WebsocketService implements OnModuleInit {
    private chatService: ChatService;
    private authService: AuthService;
    private usersService: UsersService;
    private websocketGateway: WebsocketGateway;
    private logger = new Logger(WebsocketService.name);

    constructor(private moduleRef: ModuleRef) {}

    async getUserFromSocket(
        socket: Socket
    ): Promise<{ user: User; sessionId: string }> {
        let token;
        if (typeof socket.handshake.auth?.token === "string") {
            this.logger.debug("token found in auth object");
            token = socket.handshake.auth.token;
        } else {
            const authHeader = socket.handshake.headers.authorization;
            const parts = authHeader?.split(" ");
            if (parts?.length == 2) {
                let scheme = parts[0];
                let credentials = parts[1];

                if (/^Bearer$/i.test(scheme)) {
                    token = credentials;
                    this.logger.debug("token found in authorization header.");
                } else {
                    throw new UnauthorizedException(
                        "Invalid authorization header scheme"
                    );
                }
            } else {
                this.logger.debug(
                    "token not found in auth object/authorization header."
                );
                throw new UnauthorizedException(
                    "Invalid authorization header scheme"
                );
            }
        }
        const { sessionId, sessionName, ...user } =
            await this.authService.validateToken(token, true);

        return { user, sessionId };
    }

    async authenticateUserFromSocket(
        socket: Socket,
        sockets: OnlineSocketsList
    ) {
        const { user, sessionId } = await this.getUserFromSocket(socket);
        const chats = await this.chatService.getChatsOfUser(user.id);

        const relatedUserIds =
            user.profile?.relations?.map((user) => user.id) || [];
        const lastMessageIds: string[] = [];
        // get userIds that are related by chats but aren't friends/outgoings/incomings/etc.
        chats.forEach((chat) => {
            if (chat.lastMessageId) lastMessageIds.push(chat.lastMessageId);
            chat.recipients.forEach((recipient) => {
                if (recipient.id === user.id) return;
                if (relatedUserIds.includes(recipient.id)) return;

                relatedUserIds.push(recipient.id);
            });
        });

        const relatedUsers = relatedUserIds.length
            ? await this.usersService.findRelatedUsersWithStatus(
                  relatedUserIds,
                  sockets,
                  user.profile?.relations || []
              )
            : [];

        const lastMessages = lastMessageIds.length 
            ? await this.chatService.getMessagesById(lastMessageIds)
            : []
        return {
            id: user.id,
            username: user.username,
            users: relatedUsers,
            chats,
            lastMessages,
            sessionId,
        };
    }
    async getFriendIdsFromSocket(client: Socket) {
        return await this.usersService.getFriendIds(client.user.id);
    }

    emitFriendAdded(userId: string, receiverUserId: string, chat: Chat) {
        this.emitUpdateUser(this.userRoom(userId), {
            id: receiverUserId,
            online: this.userOnline(receiverUserId),
            relationship: RelationStatus.Friend,
        });

        this.emitUpdateUser(this.userRoom(receiverUserId), {
            id: userId,
            online: this.userOnline(userId),
            relationship: RelationStatus.Friend,
        });

        this.emitNewDirectChatJoin([userId, receiverUserId], chat);
    }

    emitNewFriendRequest(
        user: { id: string; username: string },
        receiverUser: { id: string; username: string }
    ) {
        this.emitUpdateUser(this.userRoom(user.id), {
            id: receiverUser.id,
            username: receiverUser.username,
            relationship: RelationStatus.Outgoing,
        });

        this.emitUpdateUser(this.userRoom(receiverUser.id), {
            id: user.id,
            username: user.username,
            relationship: RelationStatus.Incoming,
        });
    }

    emitFriendRemoved(
        userId: string,
        receiverUserId: string,
        message: string,
        chatId?: string
    ) {
        this.emitUpdateUser(
            this.userRoom(userId),
            {
                id: receiverUserId,
                relationship: RelationStatus.None,
                online: false,
            },
            message
        );

        this.emitUpdateUser(
            this.userRoom(receiverUserId),
            {
                id: userId,
                relationship: RelationStatus.None,
                online: false,
            },
            message
        );

        if (message === "Friend removed." && chatId)
            this.leaveDirectChatRoom([userId, receiverUserId], chatId);
    }

    emitUserOnline(
        userId: string,
        recipients: string[],
        online: Date | boolean
    ) {
        this.emitUpdateUser(
            recipients.map((id) => this.userRoom(id)),
            {
                id: userId,
                online,
            }
        );
    }

    emitUpdateUser(
        emitTo: string | string[],
        data: { [key: string]: any },
        message?: string
    ) {
        if(!emitTo || emitTo.length == 0) {
            this.logger.error({ event: 'ws_invalid_room,empty', msg: `emitUpdateUser received empty room string/array. This is likely unintentional as it will send the event to every socket.` })
            throw new InternalServerErrorException()
            
        }
        this.websocketGateway.server.to(emitTo).emit("User:Update", {
            user: data,
            message: message,
        });
    }

    emitUpdateChat(emitTo: string | string[], chat: Chat) {
        if (!emitTo || emitTo.length == 0) {
            this.logger.error({ event: 'ws_invalid_room,empty', msg: `emitUpdateChat received empty room string/array. This is likely unintentional as it will send the event to every socket.` })
            throw new InternalServerErrorException()

        }
        this.websocketGateway.server.to(emitTo).emit("Chat:Update", { chat });
    }

    emitNewMessage(
        emitTo: string | string[],
        message: Message,
        ackId?: string
    ) {
        if (!emitTo || emitTo.length == 0) {
            this.logger.error({ event: 'ws_invalid_room,empty', msg: `emitNewMessage received empty room string/array. This is likely unintentional as it will send the event to every socket.` })
            throw new InternalServerErrorException()

        }

        this.websocketGateway.server
            .to(emitTo)
            .emit("Message:New", { ...message, ackId: ackId });
    }

    emitException(socket: Socket, type: string, message: any) {
        socket.emit("exception", {
            type,
            message,
        });
    }

    emitNewDirectChatJoin(userIds: string[], chat: Chat) {
        this.joinDirectChatRoom(userIds, chat.id);
        this.emitUpdateChat(this.directChatRoom(chat.id), chat);
    }

    joinDirectChatRoom(userIds: string[], chatId: string) {
        this.websocketGateway.server
            .in(userIds.map((id) => this.userRoom(id)))
            .socketsJoin(this.directChatRoom(chatId));
    }
    leaveDirectChatRoom(userIds: string[], chatId: string) {
        this.websocketGateway.server
            .in(userIds.map((id) => this.userRoom(id)))
            .socketsLeave(this.directChatRoom(chatId));
    }
    userOnline(userId: string): Date | boolean {
        return this.websocketGateway.sockets.get(userId)?.online || false;
    }

    logoutSession(sid: string) {
        if (!sid || !sid.trim().length) {
            this.logger.error({ event: 'ws_invalid_room,empty', msg: `logoutSession received empty room string. This is absolutely unintentional.` })
            throw new InternalServerErrorException()
        }
        this.websocketGateway.server
            .to(this.userSessRoom(sid))
            .disconnectSockets();
    }

    userRoom(userId: string) {
        return `${Rooms.User}:${userId}`;
    }

    directChatRoom(chatId: string) {
        return `${Rooms.DirectChat}:${chatId}`;
    }

    userSessRoom(sessionId: string) {
        return `${Rooms.UserSessionId}:${sessionId}`;
    }

    onModuleInit(): any {
        this.usersService = this.moduleRef.get(UsersService, { strict: false });
        this.chatService = this.moduleRef.get(ChatService, { strict: false });
        this.authService = this.moduleRef.get(AuthService, { strict: false });
        this.websocketGateway = this.moduleRef.get(WebsocketGateway);
    }
}
