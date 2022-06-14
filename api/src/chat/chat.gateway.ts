import { WsExceptionFilter } from "@/common/filters/ws-exception.filter";
import { AccountUserDto } from "@/dto/user.dto";
import { UsersService } from "@/users/users.service";
import { HttpException, Logger, UseFilters } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
    WsException,
} from "@nestjs/websockets";
import { RelationStatus } from "@prisma/client";
import { Server, Socket } from "socket.io";
import { ChatService } from "./chat.service";

@WebSocketGateway({ cors: { origin: true, credentials: true } })
@UseFilters(WsExceptionFilter)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    constructor(
        private chatService: ChatService,
        private usersService: UsersService,
        private configService: ConfigService,
    ) {}
    @WebSocketServer()
    server: Server;

    private logger = new Logger(ChatGateway.name);
    public sockets: { [k: string]: string[] } = {};

    async handleConnection(client: Socket) {
        client.join(client.user.id);
        try {
            console.time(`handleConnection:${client.id}`);
            const onlineUsers = Object.keys(this.sockets);
            const chats = await this.chatService.getChatsOfUser(client.user.id);
            const usersOfChats: string[] = [];
            chats.forEach((chat) =>
                chat.recipients.forEach((recipient) => {
                    if (recipient.userId === client.user.id) return;
                    usersOfChats.push(recipient.userId);
                }),
            );
            const userAccountAndRelations =
                await this.usersService.getRelatedUsers(
                    client.user.id,
                    true,
                    onlineUsers,
                    usersOfChats,
                );
            const { isOwner, username } =
                userAccountAndRelations.account as AccountUserDto;

            const data = {
                id: client.user.id,
                username,
                isOwner: !!isOwner,
                users: userAccountAndRelations.users,
                chats,
            };
            this.sockets[client.user.id]
                ? this.sockets[client.user.id].push(client.id)
                : (this.sockets[client.user.id] = [client.id]);

            client.emit("Ready", data);
            const friendIds = userAccountAndRelations.users
                .filter((user) => user.relationship === RelationStatus.Friend)
                .map((user) => user.id);
            if (friendIds.length) {
                client.to(friendIds).emit("User:Update", {
                    user: {
                        id: client.user.id,
                        online: true,
                    },
                });
            }
            console.timeEnd(`handleConnection:${client.id}`);
        } catch (e: any) {
            if (e instanceof WsException || e instanceof HttpException) {
                client.emit("exception", {
                    type: "onGatewayConnection",
                    message: e.message,
                });
            } else {
                client.emit("exception", {
                    type: "onGatewayConnection",
                    message: "Internal Server Error",
                });
            }
            client.disconnect();
        }
    }
    async handleDisconnect(client: Socket): Promise<void> {
        try {
            const relatedUsers = await this.usersService.getRelatedUsers(
                client.user.id,
            );
            const friendIds = relatedUsers.users
                .filter((user) => user.relationship === RelationStatus.Friend)
                .map((user) => user.id);

            if (friendIds.length) {
                client.to(friendIds).emit("User:Update", {
                    user: {
                        id: client.user.id,
                        online: false,
                    },
                });
            }
            if (this.sockets[client.user.id]) {
                const index = this.sockets[client.user.id].indexOf(client.id);
                if (index > -1) {
                    this.sockets[client.user.id].splice(index, 1);
                }
                if (!this.sockets[client.user.id].length)
                    delete this.sockets[client.user.id];
            }
        } catch (e: any) {
            if (e instanceof HttpException) return;
            this.logger.error(e);
        }
    }
}
