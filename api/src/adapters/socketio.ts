import { ChatService } from "@/chat/chat.service";
import { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { Server, Socket, ServerOptions } from "socket.io";

const { instrument } = require("@socket.io/admin-ui");

export class CustomIoAdapter extends IoAdapter {
    constructor(private app: NestExpressApplication) {
        super(app);
    }
    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options) as Server;

        instrument(server, { 
        auth: false 
        });

        return server;
    }
}
