import { WebsocketGateway } from "@/websocket/websocket.gateway";
import { Module } from "@nestjs/common";
import { WebsocketService } from "./websocket.service";

@Module({
    providers: [WebsocketGateway, WebsocketService],
    exports: [WebsocketGateway, WebsocketService],
})
export class WebsocketModule {}
