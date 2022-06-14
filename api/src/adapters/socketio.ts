import { ChatService } from '@/chat/chat.service';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { WsException } from '@nestjs/websockets';
import { Server, ServerOptions } from 'socket.io';

const { instrument } = require("@socket.io/admin-ui");

export class CustomIoAdapter extends IoAdapter {
  constructor(private app: NestExpressApplication) { super(app) }
  createIOServer(port: number, options?: ServerOptions): any {
    const chatService = this.app.get<ChatService>(ChatService);
    const server = super.createIOServer(port, options) as Server;
    
    server.use(async (socket, next) => {
      chatService.getUserFromSocket(socket).then(user => {
        socket.user = { id: user.id }
        next();
      }).catch(e => {
        if(e instanceof UnauthorizedException || e instanceof NotFoundException) {
          next(new WsException(e.getResponse()));
        } else next(new WsException("Unknown error occured."))
      })
    });
/*
    instrument(server, { 
      auth: false 
    });*/

    return server;
  }
}