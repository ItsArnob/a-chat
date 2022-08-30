import { OnlineSocketsList } from "@/dto/chat.dto";
import { ChatType } from "@/models/chat.model";
import { RelationStatus } from "@/models/user.model";
import { WebsocketService } from "@/websocket/websocket.service";
import {
    HttpException,
    Logger,
    NotFoundException,
    UnauthorizedException,
    UseFilters,
} from "@nestjs/common";
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";
import { InjectPinoLogger, PinoLogger } from "nestjs-pino";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class WebsocketGateway
    implements OnGatewayConnection, OnGatewayDisconnect
{
    constructor(
        private websocketService: WebsocketService,
        @InjectPinoLogger(WebsocketGateway.name)
        private logger: PinoLogger    
    ) {}
    @WebSocketServer()
    server: Server;

    public sockets: OnlineSocketsList = new Map();

    async handleConnection(client: Socket) {
        try {
            const connectedAt = Date.now();

            const { sessionId, ...data } =
                await this.websocketService.authenticateUserFromSocket(
                    client,
                    this.sockets
                );

            const friendIds = data.users
                .filter((user) => user.relationship === RelationStatus.Friend)
                .map((user) => user.id);

            const friendsChats = friendIds.length
                ? data.chats.filter((chat) => {
                      if (chat.chatType !== ChatType.Direct) return;
                      return !!chat.recipients.find((recipient) =>
                          friendIds.includes(recipient.id)
                      );
                  })
                : [];

            client.join([
                this.websocketService.userRoom(data.id),
                this.websocketService.userSessRoom(sessionId),
                ...friendsChats.map((chat) =>
                    this.websocketService.directChatRoom(chat.id)
                ),
            ]);
            client.user = { id: data.id };
            client.emit("Ready", data);

            if (friendIds.length) {
                this.websocketService.emitUserOnline(
                    client.user.id,
                    friendIds,
                    true
                );
            }
            if (this.sockets.has(client.user.id)) {
                let socket = this.sockets.get(client.user.id) as {
                    sIds: string[];
                    online: Date;
                };
                socket.sIds.push(client.id);
                this.sockets.set(client.user.id, {
                    ...socket,
                    online: true,
                });
            } else {
                this.sockets.set(client.user.id, {
                    sIds: [client.id],
                    online: true,
                });
            }

            this.logger.info({
                event: `ws_connect_success:${data.id}`,
                msg: `User ${data.id} connected.`,
                duration: Date.now() - connectedAt,
            });
        } catch (e: any) {
            if (e instanceof UnauthorizedException) {
                this.websocketService.emitException(
                    client,
                    "onGatewayConnection",
                    "Invalid session."
                );
                this.logger.warn({
                    event: `ws_connect_fail,invalid_session`,
                    msg: e.message,
                });
            } else {
                this.websocketService.emitException(
                    client,
                    "onGatewayConnection",
                    "An unknown error occurred."
                );
                this.logger.error({
                    event: `ws_connect_fail,unknown_error`,
                    msg: `An unknown error occurred.`,
                    err: e,
                });
            }
            client.disconnect();
        }
    }
    async handleDisconnect(client: Socket): Promise<void> {
        try {
            if (client.user?.id) {
                const disconnectedAt = Date.now();
                const socket = this.sockets.get(client.user.id);
                let online: Date | boolean = true;
                if (socket) {
                    const sidsWithoutThisOne = socket.sIds.filter(
                        (sid) => sid !== client.id
                    );
                    if (!sidsWithoutThisOne.length) {
                        online = new Date();
                        this.sockets.set(client.user.id, {
                            sIds: [],
                            online,
                        });
                    } else
                        this.sockets.set(client.user.id, {
                            sIds: sidsWithoutThisOne,
                            online,
                        });
                }
                const friendIds =
                    await this.websocketService.getFriendIdsFromSocket(client);
                if (typeof online === "object" && friendIds.length) {
                    this.websocketService.emitUserOnline(
                        client.user.id,
                        friendIds,
                        online
                    );
                }

                this.logger.info({
                    event: `ws_disconnect_success:${client.user.id}`,
                    msg: `User ${client.user.id} disconnected.`,
                    duration: Date.now() - disconnectedAt,
                });
            }
        } catch (e: any) {
            if (e instanceof HttpException) return;
            this.logger.error({
                event: `ws_disconnect_error,unknown_error`,
                msg: `An unknown error occurred.`,
                err: e,
            });
        }
    }
}
