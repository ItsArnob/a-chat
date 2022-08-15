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
import { ChatType } from "@/models/chat.model";
import {
    ConflictException,
    InternalServerErrorException,
    NotFoundException,
} from "@nestjs/common";

const moduleMocker = new ModuleMocker(global);

describe("UsersService", () => {
    let usersService: UsersService;
    let mongo: Pick<MongoDB, "users" | "chats" | "client">;
    let mockWithTransaction: jest.Mock;
    let mockEndSession: jest.Mock;
    beforeEach(async () => {
        mockWithTransaction = jest.fn().mockImplementation(async (cb) => {
            await cb();
        });
        mockEndSession = jest.fn();

        const moduleRef = await Test.createTestingModule({
            providers: [UsersService],
        })
            .useMocker((token) => {
                if (token === MONGODB_PROVIDER) {
                    return {
                        users: {
                            findOne: jest.fn(),
                            find: jest.fn(),
                            updateOne: jest.fn(),
                        },
                        chats: {
                            findOne: jest.fn(),
                        },
                        client: {
                            startSession: jest.fn().mockReturnValue({
                                withTransaction: mockWithTransaction,
                                endSession: mockEndSession,
                            }),
                        },
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
        mongo =
            moduleRef.get<Pick<MongoDB, "users" | "chats" | "client">>(
                MONGODB_PROVIDER
            );
    });

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
    });

    describe("removeFriend", () => {
        const otherUserId = "otherUserId";
        const userNoProfile: UserNoProfile = {
            id: "userId",
            passwordHash: "passwordHash",
            username: "username",
        };
        const chatId = "chatId";

        const runCommonTests = () => {
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
        };
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
            runCommonTests();
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
            runCommonTests();
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
    });
});
