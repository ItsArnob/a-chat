import { ChatService } from '@/chat/chat.service';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class WsGuard implements CanActivate {
    constructor(private chatService: ChatService) {}
    async canActivate(context: ExecutionContext) {
        const socket = context.switchToWs().getClient();
        const user = await this.chatService.getUserFromSocket(socket);
        if (!user) return false;
        return true;
    }
}
