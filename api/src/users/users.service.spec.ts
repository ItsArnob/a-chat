import { MONGODB_PROVIDER } from "@/constants";
import { Test } from "@nestjs/testing";
import { UsersService } from "./users.service";
import { ModuleMocker, MockFunctionMetadata } from "jest-mock";
import {
    Relation,
    RelationStatus,
    User,
    UserDoc,
    UserNoProfile,
    userNoProfileProjection,
    userProjection,
    UserRelation,
    userRelationsProjection,
} from "@/models/user.model";
import { MongoDB } from "@/database/database.interface";
import { OnlineSocketsList } from "@/dto/chat.dto";
import { Chat, ChatDoc, chatProjection, ChatType } from "@/models/chat.model";
import {
    ConflictException,
    ImATeapotException,
    InternalServerErrorException,
    NotFoundException,
} from "@nestjs/common";
import { ClientSession } from "mongodb";
import { AddFriendDto } from "@/dto/user.dto";
import * as ulid from "ulid";
import bcrypt from "bcrypt"
import { ConfigService } from "@nestjs/config";
import { getLoggerToken } from "nestjs-pino";
import pinoLoggerMock from "@/mocks/pino-logger.mock";

const moduleMocker = new ModuleMocker(global);
jest.mock("ulid")
jest.mock("bcrypt")

describe("UsersService", () => {
    let usersService: UsersService;
    let configService: ConfigService;
    let mongo: Pick<MongoDB, "users" | "chats" | "client">;
    let mockWithTransaction: jest.Mock;
    let mockEndSession: jest.Mock;
    beforeEach(async () => {
        
        (bcrypt.hash as any).mockRestore()
        
        mockWithTransaction = jest.fn().mockImplementation(async (cb) => {
            await cb();
        });
        mockEndSession = jest.fn();

        const moduleRef = await Test.createTestingModule({
            providers: [UsersService, {
                provide: getLoggerToken(UsersService.name),
                useValue: pinoLoggerMock
            }],
        })
            .useMocker((token) => {
                if (token === MONGODB_PROVIDER) {
                    return {
                        users: {
                            findOne: jest.fn(),
                            find: jest.fn(),
                            updateOne: jest.fn(),
                            insertOne: jest.fn()
                        },
                        chats: {
                            findOne: jest.fn(),
                            insertOne: jest.fn()
                        },
                        client: {
                            startSession: jest.fn().mockReturnValue({
                                withTransaction: mockWithTransaction,
                                endSession: mockEndSession,
                            }),
                        },
                    };
                }
                if (token === ConfigService) {
                    return {
                        get: jest.fn()
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

        usersService = moduleRef.get<UsersService>(UsersService);
        configService = moduleRef.get<ConfigService>(ConfigService);
        mongo =
            moduleRef.get<Pick<MongoDB, "users" | "chats" | "client">>(
                MONGODB_PROVIDER
            );
    });

    afterEach(() => {
        mockWithTransaction.mockReset()
        mockEndSession.mockReset()
    })

    describe("findOneByName", () => {
        it("should find a user by username", async () => {
            const user: UserDoc = {
                _id: "1",
                passwordHash: "awe",
                username: "Hi",
                profile: {
                    relations: [],
                },
            };
            const result = {
                passwordHash: user.passwordHash,
                username: user.username,
                id: user._id,
                profile: user.profile,
            };
            // @ts-ignore
            jest.spyOn(mongo.users, "findOne").mockResolvedValue(user);

            await expect(
                usersService.findOneByName(user.username)
            ).resolves.toStrictEqual(result);
            expect(mongo.users.findOne).toBeCalledWith(
                { username: user.username },
                {
                    projection: userProjection,
                    collation: { locale: "en", strength: 2 },
                }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });

        it("should return null if no user is found", async () => {
            // @ts-ignore
            jest.spyOn(mongo.users, "findOne").mockResolvedValue(null);

            await expect(usersService.findOneByName("Hi")).resolves.toBeNull();
            expect(mongo.users.findOne).toBeCalledWith(
                { username: "Hi" },
                {
                    projection: userProjection,
                    collation: { locale: "en", strength: 2 },
                }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });
    });

    describe("findOneNoProfileByName", () => {
        it("should find a user by username and return everything but the profile object", async () => {
            const user: UserDoc = {
                _id: "1",
                passwordHash: "awe",
                username: "Hi",
            };
            const result = {
                passwordHash: user.passwordHash,
                username: user.username,
                id: user._id,
            };
            // @ts-ignore
            jest.spyOn(mongo.users, "findOne").mockResolvedValue(user);

            await expect(
                usersService.findOneNoProfileByName(user.username)
            ).resolves.toStrictEqual(result);
            expect(mongo.users.findOne).toBeCalledWith(
                { username: user.username },
                {
                    projection: userNoProfileProjection,
                    collation: { locale: "en", strength: 2 },
                }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });

        it("should return null if no user is found", async () => {
            const username = "hi";
            // @ts-ignore
            jest.spyOn(mongo.users, "findOne").mockResolvedValue(null);

            await expect(
                usersService.findOneNoProfileByName(username)
            ).resolves.toBeNull();
            expect(mongo.users.findOne).toBeCalledWith(
                { username },
                {
                    projection: userNoProfileProjection,
                    collation: { locale: "en", strength: 2 },
                }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });
    });

    describe("findOneById", () => {
        it("should find a user by id", async () => {
            const user: UserDoc = {
                _id: "1",
                passwordHash: "awe",
                username: "Hi",
                profile: {
                    relations: [],
                },
            };
            const result = {
                passwordHash: user.passwordHash,
                username: user.username,
                id: user._id,
                profile: user.profile,
            };
            // @ts-ignore
            jest.spyOn(mongo.users, "findOne").mockResolvedValue(user);

            await expect(
                usersService.findOneById(user._id)
            ).resolves.toStrictEqual(result);
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: user._id },
                {
                    projection: userProjection,
                }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });

        it("should return null if no user is found", async () => {
            const id = "1";
            // @ts-ignore
            jest.spyOn(mongo.users, "findOne").mockResolvedValue(null);

            await expect(usersService.findOneById(id)).resolves.toBeNull();
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: id },
                {
                    projection: userProjection,
                }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });
    });

    describe("findOneNoProfileById", () => {
        it("should find a user by id and return everything but the profile object", async () => {
            const user: UserDoc = {
                _id: "1",
                passwordHash: "awe",
                username: "Hi",
            };
            const result = {
                passwordHash: user.passwordHash,
                username: user.username,
                id: user._id,
            };
            // @ts-ignore
            jest.spyOn(mongo.users, "findOne").mockResolvedValue(user);

            await expect(
                usersService.findOneNoProfileById(user._id)
            ).resolves.toStrictEqual(result);
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: user._id },
                {
                    projection: userNoProfileProjection,
                }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        }),
            it("should return null if no user is found", async () => {
                const id = "1";
                // @ts-ignore
                jest.spyOn(mongo.users, "findOne").mockResolvedValue(null);

                await expect(
                    usersService.findOneNoProfileById(id)
                ).resolves.toBeNull();
                expect(mongo.users.findOne).toBeCalledWith(
                    { _id: id },
                    {
                        projection: userNoProfileProjection,
                    }
                );
                expect(mongo.users.findOne).toBeCalledTimes(1);
            });
    });

    describe("findRelationsOfUser", () => {
        it("should return the relations array of the profile object of a user id", async () => {
            const id = "1";

            const profile: { relations: UserRelation[] } = {
                relations: [
                    {
                        id: "2",
                        status: RelationStatus.Friend,
                    },
                ],
            };

            // @ts-ignore
            jest.spyOn(mongo.users, "findOne").mockResolvedValue({ profile });
            await expect(
                usersService.findRelationsOfUser(id)
            ).resolves.toStrictEqual(profile.relations);
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: id },
                {
                    projection: userRelationsProjection,
                }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });

        it("should return empty relations array if no profile is found", async () => {
            const id = "1";
            // @ts-ignore
            jest.spyOn(mongo.users, "findOne").mockResolvedValue(null);

            await expect(
                usersService.findRelationsOfUser(id)
            ).resolves.toStrictEqual([]);
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: id },
                {
                    projection: userRelationsProjection,
                }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });
    });

    describe("findRelatedUsersWithStatus", () => {
        const users = [
            {
                _id: "1",
                username: "hello",
            },
            {
                _id: "2",
                username: "hi",
            },
            {
                _id: "3",
                username: "NotAFriend",
            },
            {
                _id: "4",
                username: "ha",
            },
        ];
        const relations: Relation[] = [
            {
                id: "1",
                status: RelationStatus.Friend,
            },
            {
                id: "2",
                status: RelationStatus.Friend,
            },
            {
                id: "3",
                status: RelationStatus.Outgoing,
            },
            {
                id: "4",
                status: RelationStatus.Friend,
            },
        ];
        const sockets = new Map([
            [
                "1",
                {
                    online: true,
                    sIds: ["2eaowdsa"],
                },
            ],
            [
                "2",
                {
                    online: new Date(),
                    sids: [],
                },
            ],
            [
                "3",
                {
                    online: new Date(),
                    sids: [],
                },
            ],
        ]) as OnlineSocketsList;

        it("should return users and with online status if they're friends", async () => {
            const result = [
                {
                    id: "1",
                    username: "hello",
                    online: true,
                    relationship: RelationStatus.Friend,
                },
                {
                    id: "2",
                    username: "hi",
                    online: sockets.get("2")?.online,
                    relationship: RelationStatus.Friend,
                },
                {
                    id: "3",
                    username: "NotAFriend",
                    online: false,
                    relationship: RelationStatus.Outgoing,
                },
                {
                    id: "4",
                    username: "ha",
                    online: undefined,
                    relationship: RelationStatus.Friend,
                },
            ];
            const mockToArray = jest.fn().mockResolvedValue(users);
            jest.spyOn(mongo.users, "find").mockReturnValue({
                toArray: mockToArray,
            } as any);
            await expect(
                usersService.findRelatedUsersWithStatus(
                    users.map((user) => user._id),
                    sockets,
                    relations
                )
            ).resolves.toStrictEqual(result);
            expect(mongo.users.find).toBeCalledWith(
                { _id: { $in: users.map((user) => user._id) } },
                { projection: { _id: 1, username: 1 } }
            );
            expect(mongo.users.find).toBeCalledTimes(1);
            expect(mockToArray).toBeCalledTimes(1);
        });
    });
    describe("getFriendsIds", () => {
        const userId = "userId";
        it("should return the ids of friends of a user id", async () => {
            const result = ["friendId1", "friendId2"];
            
            jest.spyOn(mongo.users, "findOne").mockResolvedValue({
                profile: {
                    relations: [
                        { id: "friendId1", status: RelationStatus.Friend },
                        { id: "friendId2", status: RelationStatus.Friend },
                        {
                            id: "unwantedUser2.0",
                            status: RelationStatus.Blocked,
                        },
                    ],
                },
            } as never); // FIXME: this is bad idk how to deal with this
            await expect(
                usersService.getFriendIds(userId)
            ).resolves.toStrictEqual(result);
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: userId },
                { projection: { profile: { relations: 1 } } }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });
        it("should return empty ids array if no profile is found", async () => {
            
            jest.spyOn(mongo.users, "findOne").mockResolvedValue({
                username: "just a user object nothing to see here",
            } as never);
            await expect(
                usersService.getFriendIds("userId")
            ).resolves.toStrictEqual([]);
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: userId },
                { projection: { profile: { relations: 1 } } }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });

        it("should return empty ids array if no relations are found", async () => {

            jest.spyOn(mongo.users, "findOne").mockResolvedValue({
                profile: { relations: [] },
            } as never);
            await expect(
                usersService.getFriendIds("userId")
            ).resolves.toStrictEqual([]);
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: userId },
                { projection: { profile: { relations: 1 } } }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        });

        // these two are useless but hey i want that 100% code coverage :)
        it("should return empty array if user is not found", async () => {
            jest.spyOn(mongo.users, "findOne").mockResolvedValue(null as never);
            await expect(
                usersService.getFriendIds("userId")
            ).resolves.toStrictEqual([]);
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: userId },
                { projection: { profile: { relations: 1 } } }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        })

        it("should return empty array if relations array is undefined", async ()=> {
            jest.spyOn(mongo.users, "findOne").mockResolvedValue({
                profile: { },
            } as never);
            await expect(
                usersService.getFriendIds("userId")
            ).resolves.toStrictEqual([]);
            expect(mongo.users.findOne).toBeCalledWith(
                { _id: userId },
                { projection: { profile: { relations: 1 } } }
            );
            expect(mongo.users.findOne).toBeCalledTimes(1);
        })
    });

    describe("removeFriend", () => {
        const otherUserId = "otherUserId";
        const userNoProfile: UserNoProfile = {
            id: "userId",
            passwordHash: "passwordHash",
            username: "username",
        };
        const chatId = "chatId";

        describe("happy path", () => {
          afterEach(() => {
                expect(usersService.findOneById).toBeCalledWith(userNoProfile.id);
                expect(mongo.client.startSession).toBeCalledTimes(1);
                expect(mockWithTransaction).toBeCalledTimes(1);

                expect(mongo.users.updateOne).toBeCalledWith(
                    { _id: userNoProfile.id },
                    { $pull: { "profile.relations": { id: otherUserId } } },
                    { session: expect.any(Object) }
                );
                expect(mongo.users.updateOne).toBeCalledWith(
                    { _id: otherUserId },
                    { $pull: { "profile.relations": { id: userNoProfile.id } } },
                    { session: expect.any(Object) }
                );
                expect(mongo.users.updateOne).toBeCalledTimes(2);
                expect(mockEndSession).toBeCalledTimes(1);
            })

            const friendRequestCanceledOrDeclied = async (canceled?: boolean) => {
                let message = canceled
                    ? "Friend request canceled."
                    : "Friend request declined.";
                const user: User = {
                    ...userNoProfile,
                    profile: {
                        relations: [
                            {
                                id: otherUserId,
                                status: canceled
                                    ? RelationStatus.Outgoing
                                    : RelationStatus.Incoming,
                            },
                        ],
                    },
                };
                jest.spyOn(usersService, "findOneById").mockResolvedValue(user);
                await expect(
                    usersService.removeFriend(otherUserId, userNoProfile)
                ).resolves.toStrictEqual({
                    user: {
                        id: otherUserId,
                    },
                    chatId: undefined,
                    message,
                });
                expect(mongo.chats.findOne).not.toBeCalled();
            };
            it("should remove the friend from the user's profile", async () => {
                const user: User = {
                    ...userNoProfile,
                    profile: {
                        relations: [
                            { id: otherUserId, status: RelationStatus.Friend },
                        ],
                    },
                };
                jest.spyOn(usersService, "findOneById").mockResolvedValue(user);
                jest.spyOn(mongo.chats, "findOne").mockResolvedValue({
                    _id: chatId,
                } as never);
                await expect(
                    usersService.removeFriend(otherUserId, userNoProfile)
                ).resolves.toStrictEqual({
                    user: {
                        id: otherUserId,
                    },
                    chatId,
                    message: "Friend removed.",
                });
                expect(mongo.chats.findOne).toBeCalledWith(
                    {
                        chatType: ChatType.Direct,
                        "recipients.id": { $all: [otherUserId, user.id] },
                    },
                    { projection: { _id: 1 } }
                );
                expect(mongo.chats.findOne).toBeCalledTimes(1);
            });

            it("should decline friend request", async () => {
                await friendRequestCanceledOrDeclied();
            });
            it("should cancel friend request", async () => {
                await friendRequestCanceledOrDeclied(true);
            });  
        })
        describe("unhappy path", () => {

            it("should throw NotFoundException if user profile is not found", async () => {
                jest.spyOn(usersService, "findOneById").mockResolvedValue(null);

                const removeFriend = () =>
                    usersService.removeFriend(otherUserId, userNoProfile);
                await expect(removeFriend).rejects.toThrow(NotFoundException);
                await expect(removeFriend).rejects.toThrow("User not found.");
            });
            it("should throw NotFoundException if otherUser doesn't exist in the relations array", async () => {
                const user: User = {
                    ...userNoProfile,
                };
                jest.spyOn(usersService, "findOneById").mockResolvedValue(user);
                const removeFriend = () =>
                    usersService.removeFriend(otherUserId, userNoProfile);
                await expect(removeFriend).rejects.toThrow(NotFoundException);
                await expect(removeFriend).rejects.toThrow("User not found.");
            });

            it("should throw ConflictException if blocked by otherUser", async () => {
                const user: User = {
                    ...userNoProfile,
                    profile: {
                        relations: [
                            {
                                id: otherUserId,
                                status: RelationStatus.BlockedByOther,
                            },
                        ],
                    },
                };
                jest.spyOn(usersService, "findOneById").mockResolvedValue(user);
                const removeFriend = () =>
                    usersService.removeFriend(otherUserId, userNoProfile);
                await expect(removeFriend).rejects.toThrow(ConflictException);
                await expect(removeFriend).rejects.toThrow(
                    "This user blocked you."
                );
            });

            it("should throw ConflictException if blocked by user", async () => {
                const user: User = {
                    ...userNoProfile,
                    profile: {
                        relations: [
                            { id: otherUserId, status: RelationStatus.Blocked },
                        ],
                    },
                };
                jest.spyOn(usersService, "findOneById").mockResolvedValue(user);
                const removeFriend = () =>
                    usersService.removeFriend(otherUserId, userNoProfile);
                await expect(removeFriend).rejects.toThrow(ConflictException);
                await expect(removeFriend).rejects.toThrow(
                    "You blocked this user."
                );
            });
            it("should throw InternalServerError if unknown relationship status is found", async () => {
                const user: User = {
                    ...userNoProfile,
                    profile: {
                        relations: [
                            { id: otherUserId, status: "haaUnknownStatus" } as any,
                        ],
                    },
                };
                jest.spyOn(usersService, "findOneById").mockResolvedValue(user);
                await expect(
                    usersService.removeFriend(otherUserId, userNoProfile)
                ).rejects.toThrow(InternalServerErrorException);
            });
        })
    });

    describe("addFriend", () => {
        const sender: UserNoProfile = {
            id: "1",
            passwordHash: "aweawe",
            username: "sender"
        }
        const receiver: UserNoProfile = {
            id: "2",
            passwordHash: "aweawe",
            username: "receiver"
        }
        describe("happy path", () => {

            
            describe("send a friend request", () => {
                const result: AddFriendDto = {
                    user: {
                        id: receiver.id,
                        username: receiver.username
                    },
                    message: "Friend request sent."
                }
                
                afterEach(() => {

                    expect(mongo.users.updateOne).toBeCalledWith(
                        {
                            _id: receiver.id
                        },
                        {
                            $push: {
                                "profile.relations": {
                                    id: sender.id,
                                    status: RelationStatus.Incoming
                                }
                            }
                        },
                        {
                            session: expect.any(Object)
                        }
                    );
                    expect(mongo.users.updateOne).toBeCalledWith(
                        {
                            _id: sender.id
                        },
                        {
                            $push: {
                                "profile.relations": {
                                    id: receiver.id,
                                    status: RelationStatus.Outgoing
                                }
                            }
                        },
                        {
                            session: expect.any(Object)
                        }
                    );


                    expect(mongo.client.startSession).toBeCalledTimes(1);
                    expect(mockWithTransaction).toBeCalledTimes(1)
                    expect(mongo.users.updateOne).toBeCalledTimes(2)
                    expect(mockEndSession).toBeCalled()
                })

                it("should send by username", async () => {

                    jest.spyOn(usersService, "findOneByName").mockResolvedValue(receiver);
                    jest.spyOn(usersService, "findOneById").mockResolvedValue(null);
                    await expect(usersService.addFriend(receiver.username, sender, false)).resolves.toStrictEqual(result);

                    expect(usersService.findOneByName).toBeCalledWith(receiver.username)
                    expect(usersService.findOneById).not.toBeCalled()
                });

                it("should send by id", async() => {
                    jest.spyOn(usersService, "findOneByName").mockResolvedValue(null);
                    jest.spyOn(usersService, "findOneById").mockResolvedValue(receiver);
                    await expect(usersService.addFriend(receiver.id, sender, true)).resolves.toStrictEqual(result);

                    expect(usersService.findOneByName).not.toBeCalled()
                    expect(usersService.findOneById).toBeCalledWith(receiver.id)
                })
            })

            describe("accept a friend request", () => {
                const user = receiver
                
                const senderUser = {
                    ...sender,
                    profile: {
                        relations: [
                            {
                                id: receiver.id,
                                status: RelationStatus.Outgoing
                            }
                        ]
                    }
                }

                afterEach(() => {
                    expect(mongo.client.startSession).toBeCalled()
                    expect(mockWithTransaction).toBeCalled()
                    expect(mongo.users.updateOne).toBeCalledWith(
                        {
                            _id: user.id,
                            "profile.relations.id": senderUser.id
                        },
                        {
                            $set: {
                                "profile.relations.$.status": RelationStatus.Friend
                            }
                        },
                        {
                            session: expect.any(Object)
                        }
                    );
                    expect(mongo.users.updateOne).toBeCalledWith(
                        {
                            _id: senderUser.id,
                            "profile.relations.id": user.id
                        },
                        {
                            $set: {
                                "profile.relations.$.status": RelationStatus.Friend
                            }
                        },
                        {
                            session: expect.any(Object)
                        }
                    )
                    expect(mongo.chats.findOne).toBeCalledWith({
                        chatType: ChatType.Direct,
                        "recipients.id": {
                            $all: [senderUser.id, user.id]
                        }
                    }, { projection: chatProjection, session: expect.any(Object) })

                    expect(mockEndSession).toBeCalledTimes(1)
                    expect(mongo.client.startSession).toBeCalledTimes(1)
                    expect(mockWithTransaction).toBeCalledTimes(1)
                    expect(mongo.users.updateOne).toBeCalledTimes(2)
                    expect(mongo.chats.findOne).toBeCalledTimes(1)

                })
                describe("has existing chat", () => {

                    
                    const chatDoc: ChatDoc = {
                        _id: "34",
                        chatType: ChatType.Direct,
                        recipients: [{ id: senderUser.id }, { id: user.id }],
                    }

                    const { _id: chatId, ...chat } = chatDoc;
                    const result = {
                        user: {
                            id: senderUser.id,
                            username: senderUser.username
                        },
                        chat: {
                            ...chat, id: chatId
                        },
                        message: "Friend request accepted."
                    }

                    

                    beforeEach(() => {
                        jest.spyOn(mongo.chats, "findOne").mockResolvedValue(chatDoc as never);

                    })
                    it("should accept by id", async () => {
                    

                        jest.spyOn(usersService, "findOneById").mockResolvedValue(senderUser);
                        jest.spyOn(usersService, "findOneByName").mockResolvedValue(null);

                        await expect(usersService.addFriend(senderUser.id, user, true)).resolves.toStrictEqual(result);

                        expect(usersService.findOneById).toBeCalledWith(senderUser.id)
                        expect(usersService.findOneByName).not.toBeCalled()
                        expect(mongo.chats.insertOne).not.toBeCalled()
                    })

                    it("should accept by username", async() => {
                        jest.spyOn(usersService, "findOneById").mockResolvedValue(null);
                        jest.spyOn(usersService, "findOneByName").mockResolvedValue(senderUser);

                        await expect(usersService.addFriend(senderUser.username, user, false)).resolves.toStrictEqual(result);

                        expect(usersService.findOneByName).toBeCalledWith(senderUser.username)
                        expect(usersService.findOneById).not.toBeCalled()
                        expect(mongo.chats.insertOne).not.toBeCalled()
                    })
                })

                describe("create new chat", () => {
                    const chatId = "02934"

                    const result = {
                        user: {
                            id: senderUser.id,
                            username: senderUser.username
                        },
                        chat: {
                            id: chatId,
                            chatType: ChatType.Direct,
                            recipients: [{ id: senderUser.id }, { id: user.id }],
                        },
                        message: "Friend request accepted."
                    }
                
                    beforeEach(() => {
                        jest.spyOn(mongo.chats, "findOne").mockResolvedValue(null as never);
                        jest.spyOn(ulid, "ulid").mockReturnValue(chatId)
                    })
                    
                    afterEach(() => {
                        expect(mongo.chats.insertOne).toBeCalledWith({
                            _id: chatId,
                            chatType: ChatType.Direct,
                            recipients: [{ id: senderUser.id }, { id: user.id }]
                        }, { session: expect.any(Object) })
                        expect(mongo.chats.insertOne).toBeCalledTimes(1)
                        expect(ulid.ulid).toBeCalled()
                    })

                    it("should accept by id", async () => {
                        jest.spyOn(usersService, "findOneById").mockResolvedValue(senderUser);
                        jest.spyOn(usersService, "findOneByName").mockResolvedValue(null);

                        await expect(usersService.addFriend(senderUser.id, user, true)).resolves.toEqual(result);
                        
                        expect(usersService.findOneById).toBeCalledWith(senderUser.id)
                        expect(usersService.findOneByName).not.toBeCalled()
                    })
                    it("should accept by username", async() => {
                        jest.spyOn(usersService, "findOneById").mockResolvedValue(null);
                        jest.spyOn(usersService, "findOneByName").mockResolvedValue(senderUser);
                        
                        await expect(usersService.addFriend(senderUser.username, user, false)).resolves.toEqual(result);

                        expect(usersService.findOneByName).toBeCalledWith(senderUser.username)
                        expect(usersService.findOneById).not.toBeCalled()
                    })

                })
            })
        })
        describe("unhappy path", () => {

            it("should throw NotFoundException when user id is not found", async() => {
                jest.spyOn(usersService, "findOneById").mockResolvedValue(null);
                jest.spyOn(usersService, "findOneByName").mockResolvedValue(null);
                await expect(usersService.addFriend(sender.id, receiver, true)).rejects.toThrow(NotFoundException)
                expect(usersService.findOneById).toBeCalledWith(sender.id)
                expect(usersService.findOneById).toBeCalledTimes(1)
                expect(usersService.findOneByName).not.toBeCalled()
            })

            it("should throw NotFoundException when username is not found", async() => {
                jest.spyOn(usersService, "findOneById").mockResolvedValue(null);
                jest.spyOn(usersService, "findOneByName").mockResolvedValue(null);
                await expect(usersService.addFriend(sender.username, receiver, false)).rejects.toThrow(NotFoundException)
                expect(usersService.findOneByName).toBeCalledWith(sender.username)
                expect(usersService.findOneByName).toBeCalledTimes(1)
                expect(usersService.findOneById).not.toBeCalled()
            })

            it("should throw ConflictException when user sends a request to themself", async () => {
                jest.spyOn(usersService, "findOneByName").mockResolvedValue(sender);
                const fn = () => usersService.addFriend(sender.username, sender, false);
                await expect(fn()).rejects.toThrowError(ConflictException);
                await expect(fn()).rejects.toThrowError("You can't add yourself as a friend.");
            });

            it("should throw ConflictException when user is already a friend", async () => {

                const otherUser: User = {
                    ...receiver,
                    profile: {
                        relations: [{ id: sender.id, status: RelationStatus.Friend }]
                    }
                }
                jest.spyOn(usersService, "findOneByName").mockResolvedValue(otherUser);

                const fn = () => usersService.addFriend(otherUser.username, sender, false);

                await expect(fn()).rejects.toThrowError(ConflictException);
                await expect(fn()).rejects.toThrowError("You are already friends with this user.");
            });

            it("should throw ConflictException when user already sent a request", async () => {
                const otherUser: User = {
                    ...receiver,
                    profile: {
                        relations: [{ id: sender.id, status: RelationStatus.Incoming }]
                    }
                }
                jest.spyOn(usersService, "findOneByName").mockResolvedValue(otherUser);

                const fn = () => usersService.addFriend(otherUser.username, sender, false);
                await expect(fn()).rejects.toThrowError(ConflictException);
                await expect(fn()).rejects.toThrowError("You already sent a friend request to this user.");


            });

            it("should throw ConflictException when user blocked otherUser", async () => {
                const otherUser: User = {
                    ...receiver,
                    profile: {
                        relations: [{ id: sender.id, status: RelationStatus.BlockedByOther }]
                    }
                }
                jest.spyOn(usersService, "findOneByName").mockResolvedValue(otherUser);

                const fn = () => usersService.addFriend(otherUser.username, sender, false);
                await expect(fn()).rejects.toThrowError(ConflictException);
                await expect(fn()).rejects.toThrowError("You blocked this user.");

            })

            it("should throw ConflictException when user is blocked by otherUser", async () => {
                const otherUser: User = {
                    ...receiver,
                    profile: {
                        relations: [{ id: sender.id, status: RelationStatus.Blocked }]
                    }
                }
                jest.spyOn(usersService, "findOneByName").mockResolvedValue(otherUser);

                const fn = () => usersService.addFriend(otherUser.username, sender, false);
                await expect(fn()).rejects.toThrowError(ConflictException);
                await expect(fn()).rejects.toThrowError("This user blocked you.");


            })
        })
    });

    describe("createUser", () => {

        const userId = "14312"
        const username = "username"
        const password = "password"
        const passwordHash = "passwordHash"

        it("should create user", async () => {


            jest.spyOn(configService, "get").mockImplementation((key: string) => {
                if(key == "disableSignup") return false;
                if(key == "bcryptRounds") return 10;
                return;
            })

            jest.spyOn(mongo.users, "findOne").mockResolvedValue(null as never);
            jest.spyOn(ulid, "ulid").mockReturnValue(userId);
            jest.spyOn(bcrypt, "hash").mockResolvedValue(passwordHash as never); //silence typescript.

            await expect(usersService.createUser(username, password)).resolves.toBeUndefined();

            expect(configService.get).toBeCalledWith("disableSignup")
            expect(configService.get).toBeCalledWith("bcryptRounds")

            expect(mongo.users.findOne).toBeCalledWith({ username }, { projection: { _id: 1 }, collation: { locale: "en", strength: 2 } })
            expect(bcrypt.hash).toBeCalledWith(password, 10)
            expect(mongo.users.insertOne).toBeCalledWith({ _id: userId, username, passwordHash })
            
            expect(mongo.users.insertOne).toBeCalledTimes(1)
            expect(mongo.users.findOne).toBeCalledTimes(1)
            expect(bcrypt.hash).toBeCalledTimes(1)

        })

        it("should throw ImATeapotException when disableSignup is true", async () => {
            jest.spyOn(configService, "get").mockImplementation((key: string) => {
                if(key == "disableSignup") return true;
                return;
            });
            const fn = () => usersService.createUser(username, password);
            await expect(fn).rejects.toThrowError(ImATeapotException);
            await expect(fn).rejects.toThrowError("User registration is currently turned off.");
            expect(configService.get).toBeCalledWith("disableSignup")
            
            expect(mongo.users.findOne).not.toBeCalled()
            expect(mongo.users.insertOne).not.toBeCalled()
            expect(bcrypt.hash).not.toBeCalled()

        });

        it("should throw ConflictException when username is already taken", async () => {

            jest.spyOn(configService, "get").mockImplementation((key: string) => {
                if(key == "disableSignup") return false;
                return;
            });

            jest.spyOn(mongo.users, "findOne").mockResolvedValue({ _id: "thisuserexistsId" } as never);
            const fn = () => usersService.createUser(username, password);
            
            await expect(fn).rejects.toThrowError(ConflictException);
            await expect(fn).rejects.toThrowError("Username is taken.");

            expect(mongo.users.findOne).toBeCalledWith({ username }, { projection: { _id: 1 }, collation: { locale: "en", strength: 2 }})
            expect(mongo.users.insertOne).not.toBeCalled()
            expect(bcrypt.hash).not.toBeCalled()

        })
    })

});
