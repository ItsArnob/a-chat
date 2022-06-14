import { PrismaService } from '@/prisma/prisma.service';
import { UsersService } from '@/users/users.service';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Account, Chat, ChatType, RelationStatus } from '@prisma/client';
import { ObjectId } from 'mongodb';
import { Socket } from 'socket.io';

@Injectable()
export class ChatService {
    private logger = new Logger(ChatService.name);
    constructor(
        private usersService: UsersService,
        private configService: ConfigService,
        private prisma: PrismaService
    ) {}

    async getUserFromSocket(socket: Socket): Promise<Account> {
        const token = socket.handshake.auth.token;
        return this.usersService.findOneByToken(token);
    }

    async getDirectMessageChat(
        initiatorUserId: string,
        userId: string
    ): Promise<Chat> {
        if (!ObjectId.isValid(userId))
            throw new BadRequestException('Invalid user ID.');
        if (initiatorUserId === userId)
            throw new BadRequestException("You can't chat with yourself.");
        // check if user1 and user2 are friends
        const account2 = await this.usersService.findProfileById(userId);
        const user2IsFriend = account2.user.relations.find(
            (relation) =>
                relation.userId === initiatorUserId &&
                relation.status === RelationStatus.Friend
        );
        if (!user2IsFriend)
            throw new ForbiddenException(
                'You have to be friends with this user before you can send messages.'
            );

        const existingChat = await this.prisma.chat.findFirst({
            where: {
                chatType: ChatType.Direct,
                recipients: {
                    every: {
                        userId: {
                            in: [initiatorUserId, account2.id],
                        },
                    },
                },
            },
        });
        if (!existingChat)
            throw new NotFoundException(
                'Chat not found for this user... which is weird, eh?'
            );
        return existingChat;
        /*if (existingChat) return existingChat;
        return this.prisma.chat.create({
            data: {
                chatType: ChatType.Direct,
                recipients: [
                    {
                        userId: initiatorUserId,
                    },
                    {
                        userId: account2.id,
                    },
                ],
            },
        });*/
    }

    async getChatsOfUser(userId: string): Promise<Chat[]> {
        return await this.prisma.chat.findMany({
            where: {
                AND: {
                    recipients: {
                        some: {
                            userId: userId,
                        },
                    },
                },
            },
        });
    }
}
