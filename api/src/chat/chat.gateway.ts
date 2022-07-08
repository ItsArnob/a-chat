import { WsExceptionFilter } from '@/common/filters/ws-exception.filter';
import { RelationStatus } from '@/models/user.model';
import { UsersService } from '@/users/users.service';
import { HttpException, Logger, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
    WsException
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: true, credentials: true } })
@UseFilters(WsExceptionFilter)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    constructor(
        private chatService: ChatService,
        private usersService: UsersService,
        private configService: ConfigService
    ) {}
    @WebSocketServer()
    server: Server;

    private logger = new Logger(ChatGateway.name);
    public sockets = new Map<string, { sIds: string[], online: Date | boolean }>();

    async handleConnection(client: Socket) {
        console.log(this.sockets);
        try {

            console.time(`handleConnection:${client.id}`);

            const data = await this.chatService.authenticateUserFromSocket(client, this.sockets);
            client.join(data.id.toString());
            client.user = { id: data.id };
            client.emit('Ready', data);

            const friendIds = data.users
                .filter((user) => user.relationship === RelationStatus.Friend)
                .map((user) => user.id.toString());
            if (friendIds.length) {
                client.to(friendIds).emit('User:Update', {
                    user: {
                        id: client.user.id.toString(),
                        online: true
                    },
                });
            }
            if(this.sockets.has(client.user.id.toString())) {
                let socket = this.sockets.get(client.user.id.toString()) as { sIds: string[], online: Date };
                socket.sIds.push(client.id);
                this.sockets.set(client.user.id.toString(), {
                    ...socket,
                    online: true
                });

            } else {
                this.sockets.set(client.user.id.toString(), { sIds: [client.id], online: true });
            };

            console.timeEnd(`handleConnection:${client.id}`);
        } catch (e: any) {
            if (e instanceof WsException || e instanceof HttpException) {
                client.emit('exception', {
                    type: 'onGatewayConnection',
                    message: e.message,
                });
            } else {
                client.emit('exception', {
                    type: 'onGatewayConnection',
                    message: 'Internal Server Error',
                });
            }
            client.disconnect();
        }
    }
    async handleDisconnect(client: Socket): Promise<void> {
        try {
            if(client.user?.id) {
                const socket = this.sockets.get(client.user.id.toString());
                let online: Date | boolean = true;
                if(socket) {
                    const sidsWithoutThisOne = socket.sIds.filter((sid) => sid !== client.id);
                    if(!sidsWithoutThisOne.length) {
                        online = new Date()
                        this.sockets.set(client.user.id.toString(), {
                            sIds: [],
                            online
                        });
                    }
                    else this.sockets.set(client.user.id.toString(), {
                        sIds: sidsWithoutThisOne,
                        online,
                    });
                };
                const friendIds = await this.usersService.getFriendIds(client.user.id);
                const friendIdsRooms = friendIds.map(id => id.toString());
                if(typeof online === "object" && friendIdsRooms.length) client.to(friendIdsRooms).emit('User:Update', {
                    user: {
                        id: client.user.id,
                        online
                    },
                });
            };
        } catch (e: any) {
            if (e instanceof HttpException) return;
            this.logger.error(e);
        }
    }
}
