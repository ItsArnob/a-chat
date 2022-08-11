import { MONGODB_PROVIDER } from "@/constants";
import { MongoDB } from "@/database/database.interface";
import { SaveDirectMessageDto } from "@/dto/chat.dto";
import {
    Chat,
    ChatDoc,
    chatProjection,
    ChatType,
    Message,
    MessageDoc,
    messageProjection,
} from "@/models/chat.model";
import { RelationStatus, User } from "@/models/user.model";
import { UsersService } from "@/users/users.service";
import {
    ForbiddenException,
    InternalServerErrorException,
    NotFoundException,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ModuleMocker, MockFunctionMetadata } from "jest-mock";
import { Filter } from "mongodb";
import ulid from "ulid";
import { ChatService } from "./chat.service";

const moduleMocker = new ModuleMocker(global);
const mockMonotonicUlid = jest.fn();
jest.mock("ulid", () => ({
    decodeTime: jest.fn(),
    monotonicFactory: () => mockMonotonicUlid,
}));

describe("ChatService", () => {
    jest.spyOn(ulid, "decodeTime").mockReturnValue(123);

    let mockWithTransaction: jest.Mock;
    let mockEndSession: jest.Mock;

    let chatService: ChatService;
    let usersService: UsersService;
    let mongo: Pick<MongoDB, "chats" | "messages" | "client">;

    beforeEach(async () => {
        mockWithTransaction = jest.fn().mockImplementation(async (cb) => {
            await cb();
        });
        mockEndSession = jest.fn();

        const moduleRef = await Test.createTestingModule({
            providers: [ChatService],
        })
            .useMocker((token) => {
                if (token === MONGODB_PROVIDER) {
                    return {
                        chats: {
                            find: jest.fn(),
                            findOne: jest.fn(),
                            insertOne: jest.fn(),
                            updateOne: jest.fn(),
                            deleteOne: jest.fn(),
                        },
                        messages: {
                            find: jest.fn(),
                            findOne: jest.fn(),
                            insertOne: jest.fn(),
                            updateOne: jest.fn(),
                            deleteOne: jest.fn(),
                        },
                        client: {
                            startSession: jest.fn().mockReturnValue({
                                withTransaction: mockWithTransaction,
                                endSession: mockEndSession,
                            }),
                        },
                    };
                }
                if (token === UsersService) {
                    return {
                        findRelationsOfUser: jest.fn(),
                    };
                }
                if (typeof token === "function") {
                    const mockMetadata = moduleMocker.getMetadata(
                        token
                    ) as MockFunctionMetadata<any, any>;
                    const Mock =
                        moduleMocker.generateFromMetadata(mockMetadata);
                    return new Mock();
                }
            })
            .compile();
        chatService = moduleRef.get<ChatService>(ChatService);
        usersService = moduleRef.get<UsersService>(UsersService);
        mongo =
            moduleRef.get<Pick<MongoDB, "chats" | "messages" | "client">>(
                MONGODB_PROVIDER
            );
    });

    describe("GetChatsOfUser", () => {
        it("Should return chats of userId", async () => {
            const userId = "1";
            const results: ChatDoc[] = [
                {
                    chatType: ChatType.Direct,
                    _id: "1",
                    recipients: [{ id: "1" }, { id: "2" }],
                    lastMessageId: "3123123",
                },
            ];
            const resultsButId: Chat[] = results.map(({ _id, ...chat }) => ({
                id: _id,
                ...chat,
            }));
            const mockToArray = jest.fn().mockResolvedValue(results);
            jest.spyOn(mongo.chats, "find").mockReturnValue({
                toArray: mockToArray,
            } as any);

            await expect(
                chatService.getChatsOfUser(userId)
            ).resolves.toStrictEqual(resultsButId);
            expect(mongo.chats.find).toBeCalledWith(
                { "recipients.id": userId },
                { projection: chatProjection }
            );
            expect(mockToArray).toBeCalledTimes(1);
        });
    });

    describe("GetMessagesById", () => {
        it("should return messages by ids", async () => {
            const resultDocs: MessageDoc[] = [
                {
                    _id: "2",
                    authorId: "1",
                    chatId: "3",
                    content: "YEES",
                },
                {
                    _id: "3",
                    authorId: "1",
                    chatId: "3",
                    content: "YEES",
                },
            ];
            const resultsButId: Message[] = resultDocs.map(
                ({ _id, ...message }) => ({
                    id: _id,
                    ...message,
                    timestamp: 123,
                })
            );
            const mockToArray = jest.fn().mockResolvedValue(resultDocs);
            const ids = ["2", "3"];
            jest.spyOn(mongo.messages, "find").mockReturnValue({
                toArray: mockToArray,
            } as any);

            await expect(
                chatService.getMessagesById(ids)
            ).resolves.toStrictEqual(resultsButId);
            expect(mongo.messages.find).toBeCalledWith(
                { _id: { $in: ids } },
                { projection: messageProjection }
            );
            expect(mockToArray).toBeCalledTimes(1);
        });
    });

    describe("getMessages", () => {
        const messagesDocs: MessageDoc[] = [
            {
                _id: "2",
                authorId: "1",
                chatId: "3",
                content: "YEES",
            },
            {
                _id: "3",
                authorId: "1",
                chatId: "3",
                content: "YEES",
            },
            {
                _id: "4",
                authorId: "2",
                chatId: "3",
                content: "Nooooo",
            },
        ];
        const chat = {
            chatType: ChatType.Direct,
            _id: "3",
            recipients: [{ id: "1" }, { id: "2" }],
            lastMessageId: "4",
        };
        const mockSort = jest.fn().mockReturnThis();
        const mockLimit = jest.fn().mockReturnThis();

        const runCommonTests = (
            query: Filter<MessageDoc>,
            mockToArray: jest.Mock,
            limit: number
        ) => {
            expect(mongo.chats.findOne).toBeCalledWith(
                { _id: query.chatId },
                { projection: { _id: 0, recipients: 1 } }
            );
            expect(mongo.messages.find).toBeCalledWith(query, {
                projection: messageProjection,
            });
            expect(mockSort).toBeCalledWith({ _id: -1 });
            expect(mockLimit).toBeCalledWith(limit);

            expect(mongo.messages.find).toBeCalledTimes(1);
            expect(mockToArray).toBeCalledTimes(1);
        };

        it("should return messages of a chat", async () => {
            const mockToArray = jest.fn().mockResolvedValue(messagesDocs);
            const result: Message[] = messagesDocs.map(
                ({ _id, ...message }) => ({
                    id: _id,
                    ...message,
                    timestamp: 123,
                })
            );

            // @ts-ignore dont know why typescript is saying that mockResolvedValue expects `never`.
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(chat);
            jest.spyOn(mongo.messages, "find").mockReturnValue({
                sort: mockSort,
                limit: mockLimit,
                toArray: mockToArray,
            } as any);

            await expect(
                chatService.getMessages(chat.recipients[0].id, chat._id)
            ).resolves.toStrictEqual(result);
            runCommonTests({ chatId: chat._id }, mockToArray, 50);
        });

        it("should return 2 message of a chat (limit) (before)", async () => {
            const docs = [messagesDocs[0], messagesDocs[1]];
            const mockToArray = jest.fn().mockResolvedValue(docs);
            const result: Message[] = docs.map(({ _id, ...message }) => ({
                id: _id,
                ...message,
                timestamp: 123,
            }));

            // @ts-ignore dont know why typescript is saying that mockResolvedValue expects `never.
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(chat);
            jest.spyOn(mongo.messages, "find").mockReturnValue({
                sort: mockSort,
                limit: mockLimit,
                toArray: mockToArray,
            } as any);
            await expect(
                chatService.getMessages(
                    chat.recipients[0].id,
                    chat._id,
                    "4",
                    undefined,
                    2
                )
            ).resolves.toStrictEqual(result);
            runCommonTests(
                { chatId: chat._id, _id: { $lt: "4" } },
                mockToArray,
                2
            );
        });

        it("should return 2 message of a chat (limit) (after)", async () => {
            const docs = [messagesDocs[0], messagesDocs[1]];
            const mockToArray = jest.fn().mockResolvedValue(docs);
            const result: Message[] = docs.map(({ _id, ...message }) => ({
                id: _id,
                ...message,
                timestamp: 123,
            }));

            // @ts-ignore dont know why typescript is saying that mockResolvedValue expects `never.
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(chat);
            jest.spyOn(mongo.messages, "find").mockReturnValue({
                sort: mockSort,
                limit: mockLimit,
                toArray: mockToArray,
            } as any);
            await expect(
                chatService.getMessages(
                    chat.recipients[0].id,
                    chat._id,
                    undefined,
                    "2",
                    2
                )
            ).resolves.toStrictEqual(result);
            runCommonTests(
                { chatId: chat._id, _id: { $gt: "2" } },
                mockToArray,
                2
            );
        });

        it("should return 2 message of a chat and `before` should take precedence when both `before` and `after` is defined (limit) (before) (after)", async () => {
            const docs = [messagesDocs[0], messagesDocs[1]];
            const mockToArray = jest.fn().mockResolvedValue(docs);
            const result: Message[] = docs.map(({ _id, ...message }) => ({
                id: _id,
                ...message,
                timestamp: 123,
            }));

            // @ts-ignore dont know why typescript is saying that mockResolvedValue expects `never.
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(chat);
            jest.spyOn(mongo.messages, "find").mockReturnValue({
                sort: mockSort,
                limit: mockLimit,
                toArray: mockToArray,
            } as any);
            await expect(
                chatService.getMessages(
                    chat.recipients[0].id,
                    chat._id,
                    "4",
                    "2",
                    2
                )
            ).resolves.toStrictEqual(result);
            runCommonTests(
                { chatId: chat._id, _id: { $lt: "4" } },
                mockToArray,
                2
            );
        });

        it("should throw NotFoundException if chat doesn't exist", async () => {
            // @ts-ignore dont know why typescript is saying that mockResolvedValue expects `never.
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(null);
            await expect(
                chatService.getMessages(chat.recipients[0].id, chat._id)
            ).rejects.toThrow(NotFoundException);
            expect(mongo.messages.find).not.toBeCalled();
        });

        it("should throw ForbiddenExpection if user is not part of a chat", async () => {
            // @ts-ignore dont know why typescript is saying that mockResolvedValue expects `never.
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(chat);

            await expect(
                chatService.getMessages("Non-existent user id!", chat._id)
            ).rejects.toThrow(ForbiddenException);
            expect(mongo.messages.find).not.toBeCalled();
        });
    });

    describe("saveDirectMessage", () => {
        const chat = {
            chatType: ChatType.Direct,
            _id: "3",
            recipients: [{ id: "1" }, { id: "2" }],
            lastMessageId: "4",
        };

        it("should save message", async () => {
            const userId = chat.recipients[0].id;
            const messageId = "284";

            // @ts-ignore
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(chat);
            jest.spyOn(usersService, "findRelationsOfUser").mockResolvedValue([
                { id: chat.recipients[1].id, status: RelationStatus.Friend },
            ]);
            mockMonotonicUlid.mockReturnValue(messageId);

            const messageDoc = {
                _id: messageId,
                chatId: chat._id,
                authorId: userId,
                content: "Hello!",
            };
            const result = {
                id: messageDoc._id,
                timestamp: 123,
                chatId: messageDoc.chatId,
                authorId: messageDoc.authorId,
                content: messageDoc.content,
            };
            await expect(
                chatService.saveDirectMessage(userId, chat._id, result.content)
            ).resolves.toStrictEqual(result);

            expect(usersService.findRelationsOfUser).toBeCalledWith(userId);
            expect(mongo.chats.findOne).toBeCalledWith(
                { _id: chat._id },
                {
                    projection: {
                        recipients: 1,
                        chatType: 1,
                        _id: 0,
                    },
                }
            );
            expect(mongo.messages.insertOne).toBeCalledWith(messageDoc, {
                session: expect.any(Object),
            });
            expect(mongo.chats.updateOne).toBeCalledWith(
                { _id: messageDoc.chatId },
                { $set: { lastMessageId: messageDoc._id } },
                { session: expect.any(Object) }
            );

            expect(mockWithTransaction).toBeCalledTimes(1);
            expect(mockEndSession).toBeCalledTimes(1);
            expect(mongo.client.startSession).toBeCalledTimes(1);
        });

        const runCommonTests = () => {
            expect(mongo.messages.insertOne).not.toBeCalled();
            expect(mongo.chats.updateOne).not.toBeCalled();
            expect(mongo.client.startSession).not.toBeCalled();
            expect(mockWithTransaction).not.toBeCalled();
            expect(mockEndSession).not.toBeCalled();
        };

        it("should throw NotFoundException if chat doesn't exist", async () => {
            // @ts-ignore
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(null);
            await expect(
                chatService.saveDirectMessage(
                    chat.recipients[0].id,
                    chat._id,
                    "Hello!"
                )
            ).rejects.toThrow(NotFoundException);
            expect(usersService.findRelationsOfUser).not.toBeCalled();
            runCommonTests();
        });

        it("should throw ForbiddenException if chat isn't a DirectChat", async () => {
            const groupChat = { ...chat, chatType: ChatType.Group };
            // @ts-ignore
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(groupChat);
            await expect(
                chatService.saveDirectMessage(
                    chat.recipients[0].id,
                    chat._id,
                    "Hello!"
                )
            ).rejects.toThrow(ForbiddenException);
            expect(usersService.findRelationsOfUser).not.toBeCalled();
            runCommonTests();
        });

        it("should throw ForbiddenException if user isn't part of a chat", async () => {
            // @ts-ignore
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(chat);
            await expect(
                chatService.saveDirectMessage(
                    "userIdNotPart of this CHat!",
                    chat._id,
                    "Hello!"
                )
            ).rejects.toThrow(ForbiddenException);
            expect(usersService.findRelationsOfUser).not.toBeCalled();
            runCommonTests();
        });

        it("should throw ForbiddenException if user isn't friends with the recipient", async () => {
            // @ts-ignore
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue(chat);
            jest.spyOn(usersService, "findRelationsOfUser").mockResolvedValue(
                []
            );
            const saveDirectMessage = () =>
                chatService.saveDirectMessage(
                    chat.recipients[0].id,
                    chat._id,
                    "Hello!"
                );
            await expect(saveDirectMessage).rejects.toThrow(ForbiddenException);
            await expect(saveDirectMessage).rejects.toThrow(
                "You must be friends to exchange messages."
            );
            runCommonTests();
        });

        it("should throw InternalServerError if no other user exists in the recipients array", async () => {
            // @ts-ignore
            jest.spyOn(mongo.chats, "findOne").mockResolvedValue({
                ...chat,
                recipients: [chat.recipients[0]],
            });
            await expect(
                chatService.saveDirectMessage(
                    chat.recipients[0].id,
                    chat._id,
                    "Hello!"
                )
            ).rejects.toThrow(InternalServerErrorException);
            expect(usersService.findRelationsOfUser).not.toBeCalled();
            runCommonTests();
        });
    });
});
