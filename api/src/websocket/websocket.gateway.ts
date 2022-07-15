import { WsExceptionFilter } from "@/common/filters/ws-exception.filter";
import { OnlineSocketsList } from "@/dto/chat.dto";
import { RelationStatus } from "@/models/user.model";
import { WebsocketService } from "@/websocket/websocket.service";
import { HttpException, Logger, NotFoundException, UnauthorizedException, UseFilters } from "@nestjs/common";
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({ cors: { origin: true, credentials: true } })
@UseFilters(WsExceptionFilter)
export class WebsocketGateway
    implements OnGatewayConnection, OnGatewayDisconnect
{
    constructor(private websocketService: WebsocketService) {}
    @WebSocketServer()
    server: Server;

    private logger = new Logger(WebsocketGateway.name);
    public sockets: OnlineSocketsList = new Map();

    async handleConnection(client: Socket) {
        try {
            const connectedAt = Date.now();

            const data = await this.websocketService.authenticateUserFromSocket(
                client,
                this.sockets
            );
            client.join(data.id);
            client.user = { id: data.id };
            client.emit("Ready", data);

            const friendIds = data.users
                .filter((user) => user.relationship === RelationStatus.Friend)
                .map((user) => user.id);

            if (friendIds.length) {
                this.websocketService.emitUpdateUser(friendIds, {
                    id: client.user.id,
                    online: true,
                });
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

            this.logger.log({
                event: `ws_connect_success:${data.id}`,
                msg: `User ${data.id} connected.`,
                duration: Date.now() - connectedAt,
            });
        } catch (e: any) {
            if (e instanceof HttpException) {
                // unauthorized - invalid jwt token
                // notfound - token not related to a user - invalid token
                if (e instanceof UnauthorizedException) {
                    this.logger.warn({
                        event: `ws_connect_fail,malformed_jwt`,
                        msg: `Malformed jwt provided or invalid signature.`,
                    });
                } else if (e instanceof NotFoundException) {
                    this.logger.warn({
                        event: `ws_connect_fail,session_use_after_expire`,
                        msg: "User attempted to use a session token that doesn't exist.",
                    });
                }
                this.websocketService.emitException(
                    client,
                    "onGatewayConnection",
                    e.message
                );
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
                const friendIdsRooms = friendIds.map((id) => id);
                if (typeof online === "object" && friendIdsRooms.length)
                    this.websocketService.emitUpdateUser(friendIdsRooms, {
                        id: client.user.id,
                        online,
                    });

                this.logger.log({
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
