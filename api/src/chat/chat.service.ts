import { DATABASE_PROVIDER } from '@/constants';
import { Chat, chatProjection, ChatType, MessageDoc, messageProjection } from '@/models/chat.model';
import { RelationStatus, User } from '@/models/user.model';
import { MongoDB } from '@/types/database.types';
import { UsersService } from '@/users/users.service';
import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Filter, ObjectId } from 'mongodb';
import { Socket } from 'socket.io';
import { monotonicFactory, decodeTime } from "ulid";

@Injectable()
export class ChatService {
    private logger = new Logger(ChatService.name);
    private ulid = monotonicFactory();

    constructor(
        private usersService: UsersService,
        private configService: ConfigService,
        @Inject(DATABASE_PROVIDER)
        private mongo: MongoDB
    ) {}

    async getUserFromSocket(socket: Socket): Promise<User> {
        const token = socket.handshake.auth.token;
        return this.usersService.findOneByToken(token);
    }

    /* async getDirectMessageChat(
        user1Id: ObjectId,
        user2Id: ObjectId
    ): Promise<Chat> {
        if (user1Id.toString() === user2Id.toString())
            throw new BadRequestException("You can't chat with yourself.");

        // check if user1 and user2 are friends
        const account2 = await this.usersService.findOneById(user2Id);
        const user2IsFriend = account2.profile?.relations?.find(
            (relation) =>
                relation.id.toString() === user1Id.toString() &&
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
                            in: [user1Id.toString(), account2._id.toString()],
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
        });
    };*/

    async authenticateUserFromSocket(socket: Socket, sockets: Map<string, { sIds: string[], online: Date | boolean }>) { // TODO: fix dupe types.
        const user = await this.getUserFromSocket(socket);
        const chats = await this.getChatsOfUser(user.id);

        const relatedUserIds = user.profile?.relations?.map(user => user.id) || [];
        const lastMessageIds: string[] = [];
        // get userIds that are related by chats but aren't friends/outgoings/incomings/etc.
        chats.forEach(chat => {
            if(chat.lastMessageId) lastMessageIds.push(chat.lastMessageId);
            chat.recipients.forEach(recipient => {
                if(recipient.id.toString() === user.id.toString()) return;

                const isRecipientInRelatedUsers = relatedUserIds.find(relatedUser => relatedUser.toString() === recipient.id.toString());
                if(isRecipientInRelatedUsers) return;

                relatedUserIds.push(recipient.id);

            });
        });

        const relatedUsers = relatedUserIds.length
            ? await this.usersService.findRelatedUsersWithStatus(relatedUserIds, sockets, user.profile?.relations || [])
            : [];

        const lastMessages = await this.getMessagesById(lastMessageIds);
        return {
            id: user.id,
            username: user.username,
            users: relatedUsers,
            chats,
            lastMessages,
        }

    }

    async getChatsOfUser(userId: ObjectId): Promise<Chat[]> {
        const results = await this.mongo.chats.find({
            'recipients.id': userId
        }, { projection: chatProjection }).toArray();
        return results.map(result => {
            const { _id: id, ...chat } = result;
            return { id, ...chat }
        });
    }
    async saveDirectMessage(authorId: ObjectId, chatId: ObjectId, content: string) {
        const errorMessage = "You don't have permission to send messages in this chat.";
        const chat = await this.mongo.chats.findOne({
            _id: chatId
        });
        if(!chat) throw new NotFoundException("Chat not found.");
        if(chat.chatType !== ChatType.Direct) throw new ForbiddenException(errorMessage);
        if(!chat.recipients.find(recipient => recipient.id.toString() === authorId.toString())) throw new ForbiddenException(errorMessage);

        const otherUserId = chat.recipients.find(recipient => recipient.id.toString() !== authorId.toString())?.id;
        const userRelations = await this.usersService.findRelationsOfUser(authorId);
        const otherUserRelation = userRelations.find(user => user.id.toString() === otherUserId?.toString())?.status;
        if(!otherUserRelation || otherUserRelation !== RelationStatus.Friend) throw new ForbiddenException("You must be friends to exchange messages.");

        const message = {
            _id: this.ulid(),
            chatId,
            authorId,
            content
        }

        const session = this.mongo.client.startSession();
        try {
            await session.withTransaction(async () => {
                await this.mongo.messages.insertOne(message, { session });
                return this.mongo.chats.updateOne({ _id: chatId }, { $set: { lastMessageId: message._id } }, { session });
            })
        }
        finally {
            await session.endSession()
        };

        const { _id: id, ...rest } = message;
        return { ...rest, id, recipients: [authorId.toString(), (otherUserId as ObjectId).toString()], timestamp: decodeTime(message._id) };
    }

    async getMessages(userId: ObjectId,chatId: ObjectId, before?: string, after?: string, limit: number = 50) {
        const chat = await this.mongo.chats.findOne({
            _id: chatId
        });
        if(!chat) throw new NotFoundException("Chat not found.");
        if(!chat.recipients.find(recipient => recipient.id.toString() === userId.toString())) throw new ForbiddenException("You don't have permission to read messages of this chat.");

        const query: Filter<MessageDoc> = { chatId };
        if(before) query._id = { $lt: before };
        else if(after) query._id = { $gt: after };
        const messages = await this.mongo.messages.find(query, { projection: messageProjection }).sort({ _id: -1 }).limit(limit).toArray();

        return messages.map((message) => {
            const { _id: id, ...data } = message;
            return { id, ...data, timestamp:  decodeTime(id) }
        })
    }

    async getMessagesById(ids: string[]) {
        const messages = await this.mongo.messages.find({ _id: { $in: ids }}, { projection: messageProjection }).toArray();
        return messages.map((message) => {
            const { _id: id, ...data } = message;
            return { id, ...data, timestamp:  decodeTime(id) }
        })
    }

}
