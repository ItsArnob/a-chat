import { DATABASE_PROVIDER } from '@/constants';
import { OnlineSocketsList, SaveDirectMessageDto } from '@/dto/chat.dto';
import { Chat, chatProjection, ChatType, Message, MessageDoc, messageProjection } from '@/models/chat.model';
import { RelationStatus, User } from '@/models/user.model';
import { MongoDB } from '@/database/database.interface';
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


    async getChatsOfUser(userId: string): Promise<Chat[]> {
        const results = await this.mongo.chats.find({
            'recipients.id': userId
        }, { projection: chatProjection }).toArray();
        return results.map(result => {
            const { _id: id, ...chat } = result;
            return { id, ...chat }
        });
    }
    async saveDirectMessage(authorId: string, chatId: string, content: string): Promise<SaveDirectMessageDto> {
        const oldTime = Date.now();
        const errorMessage = "You don't have permission to send messages in this chat.";
        const chat = await this.mongo.chats.findOne({
            _id: chatId
        });
        if(!chat) {
            this.logger.warn({ event: `message_direct_create_fail:${chatId},chat_not_exist`, msg: `User ${authorId} attempted to save message in a non-existent chat.`});
            throw new NotFoundException("Chat not found.");
        }
        if(chat.chatType !== ChatType.Direct) {
            this.logger.warn({ event: `message_direct_create_fail:${chatId},not_direct_chat`, msg: `User ${authorId} attempted to save direct message in chat ${chatId}, which is not a Direct chat.` })
            throw new ForbiddenException(errorMessage);
        }
        if(!chat.recipients.find(recipient => recipient.id === authorId)) {
            this.logger.warn({ event: `authz_fail:${authorId},message_direct_create:${chatId}`, msg: `User attempted to save direct message in a chat they dont belong to.` });
            throw new ForbiddenException(errorMessage);
        }

        const otherUserId = chat.recipients.find(recipient => recipient.id !== authorId)?.id;
        const userRelations = await this.usersService.findRelationsOfUser(authorId);
        const otherUserRelation = userRelations.find(user => user.id === otherUserId)?.status;
        if(!otherUserRelation || otherUserRelation !== RelationStatus.Friend) {
            this.logger.warn({ event: `message_direct_create_fail:${chatId},not_friends`, msg: `User attempted to save message in a chat they belong to but aren't friends with the recipient user.` })
            throw new ForbiddenException("You must be friends to exchange messages.");
        }

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
                await this.mongo.chats.updateOne({ _id: chatId }, { $set: { lastMessageId: message._id } }, { session });
                return;
            })
        }
        finally {
            await session.endSession()
        };
        this.logger.debug({ event: `message_direct_created:${chatId}`, msg: `Message saved ${message._id}`, duration: Date.now() - oldTime, message_content: message.content });
        const { _id: id, ...rest } = message;
        return { ...rest, id, recipients: [authorId, otherUserId as string], timestamp: decodeTime(message._id) };
    }

    async getMessages(userId: string, chatId: string, before?: string, after?: string, limit: number = 50): Promise<Message[]> {

        const oldTime = Date.now();

        const chat = await this.mongo.chats.findOne({
            _id: chatId
        });
        if(!chat) {
            this.logger.warn({ event: `message_get_many_fail:${chatId},chat_not_exist`, msg: `User ${userId} attempted to get messages from a non-existent chat.` })
            throw new NotFoundException("Chat not found.");
        }
        if(!chat.recipients.find(recipient => recipient.id === userId)) {
            this.logger.warn({ event: `authz_fail:${userId},message_get_many:${chatId}`, msg: `User attempted to get messages from a chat they dont belong to.` });
            throw new ForbiddenException("You don't have permission to read messages of this chat.");
        }

        const query: Filter<MessageDoc> = { chatId };
        if(before) query._id = { $lt: before };
        else if(after) query._id = { $gt: after };
        const messages = await this.mongo.messages.find(query, { projection: messageProjection }).sort({ _id: -1 }).limit(limit).toArray();

        this.logger.debug({ event: `message_get_many_success:${chatId},before:${before},after:${after},limit:${limit}`, msg: `${messages.length} messages loaded by user ${userId}.`, duration: Date.now() - oldTime })
        return messages.map((message) => {
            const { _id: id, ...data } = message;
            return { id, ...data, timestamp:  decodeTime(id) }
        })
    }

    async getMessagesById(ids: string[]): Promise<Message[]> {
        const messages = await this.mongo.messages.find({ _id: { $in: ids }}, { projection: messageProjection }).toArray();
        return messages.map((message) => {
            const { _id: id, ...data } = message;
            return { id, ...data, timestamp:  decodeTime(id) }
        })
    }

}
