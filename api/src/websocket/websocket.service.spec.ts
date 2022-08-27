import { AuthService } from "@/auth/auth.service";
import { ChatService } from "@/chat/chat.service";
import { Chat, ChatType, Message } from "@/models/chat.model";
import { RelationStatus } from "@/models/user.model";
import { UsersService } from "@/users/users.service";
import { InternalServerErrorException, UnauthorizedException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ModuleMocker, MockFunctionMetadata } from "jest-mock";
import { WebsocketGateway } from "./websocket.gateway";
import { Rooms } from "./websocket.interface";
import { WebsocketModule } from "./websocket.module";
import { WebsocketService } from "./websocket.service";

const moduleMocker = new ModuleMocker(global);

describe("WebsocketService", () => {
    let websocketService: WebsocketService
    let chatService: ChatService
    let authService: AuthService
    let usersService: UsersService
    let websocketGateway: WebsocketGateway

    let mockWebsocketEmit: jest.Mock
    let mockSocketsJoin: jest.Mock
    let mockSocketsLeave: jest.Mock
    let mockDisconnectSockets: jest.Mock

    beforeEach(async () => {
        mockWebsocketEmit = jest.fn();
        mockSocketsJoin = jest.fn()
        mockSocketsLeave = jest.fn()
        mockDisconnectSockets = jest.fn()
        const moduleRef = await Test.createTestingModule({
            providers: [WebsocketService, 
                {
                    provide: UsersService,
                    useValue: {
                        findRelatedUsersWithStatus: jest.fn(),
                        getFriendIds: jest.fn()
                    }
                },
                {
                    provide: AuthService,
                    useValue: {
                        validateToken: jest.fn()
                    }
                },
                {
                    provide: ChatService,
                    useValue: {
                        getChatsOfUser: jest.fn(),
                        getMessagesById: jest.fn()
                    }
                },
                {
                    provide: WebsocketGateway,
                    useValue: {
                        server: {
                            to: jest.fn().mockImplementation(() => ({ emit: mockWebsocketEmit, disconnectSockets: mockDisconnectSockets })),
                            in: jest.fn().mockImplementation(() => ({ socketsJoin: mockSocketsJoin, socketsLeave: mockSocketsLeave }))
                        },
                        sockets: {
                            get: jest.fn()
                        }
                    }
                }
            ],
        })
        .useMocker((token) => {
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
        websocketService = moduleRef.get<WebsocketService>(WebsocketService);

        websocketService.onModuleInit()
        authService = moduleRef.get<AuthService>(AuthService)
        chatService = moduleRef.get<ChatService>(ChatService)
        usersService = moduleRef.get<UsersService>(UsersService)
        websocketGateway = moduleRef.get<WebsocketGateway>(WebsocketGateway)
    });


    describe("getUserFromSocket", () => {

        const result = {
            id: "1",
            sessionId: "okoi",
            sessionName: "okoi",
            passwordHash: "iohgrstdytfugyhu",
            username: "rdfg"
        }

        it("should authenticate user from socket auth object and return user", async () => {
            const socket = {
                handshake: {
                    auth: {
                        token: "token",
                    },
                },
            };
            const { sessionId, sessionName, ...user } = result;
            jest.spyOn(authService, "validateToken").mockResolvedValue(result)
            await expect(websocketService.getUserFromSocket(socket as any)).resolves.toStrictEqual({
                sessionId, user
            })
            expect(authService.validateToken).toBeCalledWith(socket.handshake.auth.token, true);
        })

        it("should authenticate user from authorization header and return user", async () => {
            const socket = {
                handshake: {
                    headers: {
                        authorization: "Bearer token",
                    },
                },
            };

            const { sessionId, sessionName, ...user } = result;
            jest.spyOn(authService, "validateToken").mockResolvedValue(result)
            await expect(websocketService.getUserFromSocket(socket as any)).resolves.toStrictEqual({
                sessionId, user
            })
            expect(authService.validateToken).toBeCalledWith(socket.handshake.headers.authorization.split(" ")[1], true);
        })

        it("should throw UnauthorizedException if authorization header is invalid", async() => {
            const socket = {
                handshake: {
                    headers: {
                        authorization: "NotBearer token",
                    },
                },
            };
            const fn = () => websocketService.getUserFromSocket(socket as any) 
            await expect(fn).rejects.toThrow(UnauthorizedException)
            await expect(fn).rejects.toThrow("Invalid authorization header scheme")
            expect(authService.validateToken).not.toBeCalled()

        })
        it("should throw UnauthorizedException if authorization header has too many or not enough arguments", async () => {
            const socket = {
                handshake: {
                    headers: {
                        authorization: "Bearer token token",
                    },
                },
            };
            const fn = () => websocketService.getUserFromSocket(socket as any)
            await expect(fn).rejects.toThrow(UnauthorizedException)
            await expect(fn).rejects.toThrow("Invalid authorization header scheme")
            expect(authService.validateToken).not.toBeCalled()
        })

        it("should throw UnauthorizedException if authorization header doesn't exist", async () => {
            const socket = {
                handshake: {
                    headers: {
                        authorization: undefined,
                    },
                },
            };

            const fn = () => websocketService.getUserFromSocket(socket as any)
            await expect(fn).rejects.toThrow(UnauthorizedException)
            await expect(fn).rejects.toThrow("Invalid authorization header scheme")
            expect(authService.validateToken).not.toBeCalled()
            
        })
    });

    describe("authenticateUserFromSocket", () => {
        const socket = {
            handshake: {
                auth: {
                    token: "token",
                },
            },
        };
        const account = {
            sessionId: "okoi",
            user: {
                id: "1",
                passwordHash: "iohgrstdytfugyhu",
                username: "rdfg",
            }
        }
        const lastOnlineDateOiw = new Date()

        const lastMessageIds = ['awea', 'aweeeerr']

        const chats: Chat[] = [
            {
                chatType: ChatType.Direct,
                id: "113",
                recipients: [{ id: account.user.id }, { id: "owur" }]
            },
            {
                chatType: ChatType.Direct,
                id: "awe",
                recipients: [{ id: account.user.id }, { id: "oiw" }],
                lastMessageId: lastMessageIds[0]
            },
            {
                chatType: ChatType.Group,
                id: "awaweawee",
                recipients: [{ id: account.user.id }, { id: "oiw" }, { id: "thirdperson"}],
                lastMessageId: lastMessageIds[1]
            },
            {
                chatType: ChatType.Direct,
                id: "aweaewa",
                recipients: [{ id: account.user.id }, { id: "notRelated" }]
            }
        ]

        const lastMessages: Message[] = [
            {
                id: lastMessageIds[0],
                authorId: account.user.id,
                chatId: chats[1].id,
                content: "No"
            },
            {
                id: lastMessageIds[1],
                authorId: "oiw",
                chatId: chats[2].id,
                content: "yeehaw"
            }
        ]

        it("should return relevant data for the 'Ready' socket event", async () => {

            
            const user = {
                sessionId: account.sessionId,
                user: {
                    ...account.user,
                    profile: {
                    relations: [
                        {
                            id: "owur",
                            status: RelationStatus.Friend
                        },
                        {
                            id: "oiw",
                            status: RelationStatus.Outgoing
                        }
                    ]
                }
                }
            }

            const onlineSockets = new Map([[user.user.profile.relations[0].id, true], [user.user.profile.relations[0].id, lastOnlineDateOiw as any]])
            
            const relatedUsers = [
                {
                    id: user.user.profile.relations[0].id,
                    username: "user1",
                    online: onlineSockets.get(user.user.profile.relations[0].id),
                    relationship: user.user.profile.relations[0].status
                },
                {
                    id: user.user.profile.relations[1].id,
                    username: "user2",
                    online: onlineSockets.get(user.user.profile.relations[1].id),
                    relationship: user.user.profile.relations[1].status
                },
                {
                    id: "thirdperson",
                    username: "Ishan'texist",
                    online: false,
                    relationship: undefined
                },
                {
                    id: "notRelated",
                    username: "ImnOtRelatedToTheUser",
                    online: false,
                    relationship: undefined
                }
            ]

            jest.spyOn(chatService, "getChatsOfUser").mockResolvedValue(chats)
            jest.spyOn(chatService, "getMessagesById").mockResolvedValue(lastMessages)
            jest.spyOn(websocketService, "getUserFromSocket").mockResolvedValue(user)
            jest.spyOn(usersService, "findRelatedUsersWithStatus").mockResolvedValue(relatedUsers)
            
            await expect(websocketService.authenticateUserFromSocket(socket as any, onlineSockets)).resolves.toStrictEqual({
                id: account.user.id,
                username: account.user.username,
                users: relatedUsers,
                chats,
                lastMessages,
                sessionId: account.sessionId
            })
            expect(websocketService.getUserFromSocket).toBeCalledWith(socket)
            expect(chatService.getChatsOfUser).toBeCalledWith(account.user.id)
            expect(usersService.findRelatedUsersWithStatus).toBeCalledWith(relatedUsers.map(usr => usr.id), onlineSockets, user.user.profile.relations);
            expect(chatService.getMessagesById).toBeCalledWith(lastMessageIds)
        })
        it("should return relevant data for the 'Ready' socket event (without relations array)", async () => {
            const relatedUsers = [
                {
                    id: "owur",
                    username: "user1",
                    online: false,
                    relationship: undefined
                },
                {
                    id: "oiw",
                    username: "user2",
                    online: false,
                    relationship: undefined
                },
                {
                    id: "thirdperson",
                    username: "Ishan'texist",
                    online: false,
                    relationship: undefined
                },
                {
                    id: "notRelated",
                    username: "ImnOtRelatedToTheUser",
                    online: false,
                    relationship: undefined
                }
            ]
            const onlineSockets = new Map()


            jest.spyOn(chatService, "getChatsOfUser").mockResolvedValue(chats)
            jest.spyOn(chatService, "getMessagesById").mockResolvedValue(lastMessages)
            jest.spyOn(websocketService, "getUserFromSocket").mockResolvedValue(account)
            jest.spyOn(usersService, "findRelatedUsersWithStatus").mockResolvedValue(relatedUsers)
            console.log(account)
            await expect(websocketService.authenticateUserFromSocket(socket as any, onlineSockets)).resolves.toStrictEqual({
                id: account.user.id,
                username: account.user.username,
                users: relatedUsers,
                chats,
                lastMessages,
                sessionId: account.sessionId
            })
            expect(websocketService.getUserFromSocket).toBeCalledWith(socket)
            expect(chatService.getChatsOfUser).toBeCalledWith(account.user.id)
            expect(usersService.findRelatedUsersWithStatus).toBeCalledWith(relatedUsers.map(usr => usr.id), onlineSockets, []);
            expect(chatService.getMessagesById).toBeCalledWith(lastMessageIds)
        })
        it("should return relevant data for the 'Ready' socket event (without relations array)", async () => {
            
            const onlineSockets = new Map()

            jest.spyOn(chatService, "getChatsOfUser").mockResolvedValue([])
            jest.spyOn(chatService, "getMessagesById").mockResolvedValue(undefined as any)
            jest.spyOn(websocketService, "getUserFromSocket").mockResolvedValue(account)
            jest.spyOn(usersService, "findRelatedUsersWithStatus").mockResolvedValue(undefined as any)
            console.log(account)
            await expect(websocketService.authenticateUserFromSocket(socket as any, onlineSockets)).resolves.toStrictEqual({
                id: account.user.id,
                username: account.user.username,
                users: [],
                chats: [],
                lastMessages: [],
                sessionId: account.sessionId
            })
            expect(websocketService.getUserFromSocket).toBeCalledWith(socket)
            expect(chatService.getChatsOfUser).toBeCalledWith(account.user.id)
            expect(usersService.findRelatedUsersWithStatus).not.toBeCalled()
            expect(chatService.getMessagesById).not.toBeCalled()
        })
    })

    describe("getFriendIdsFromSocket", () => {
        it("should call getFriendIds", async () => {
            const socket = {
                user: {
                    id: "awe"
                }
            }
            jest.spyOn(usersService, "getFriendIds").mockResolvedValue(["id"])
            expect(websocketService.getFriendIdsFromSocket(socket as any)).resolves.toStrictEqual(["id"])
            expect(usersService.getFriendIds).toBeCalledWith(socket.user.id)
        })
    })

    describe("emitFriendAdded", () => {
        it("should emit and join users to their chat room", () => {

            const chat: Chat = {
                chatType: ChatType.Direct,
                id: "awea",
                recipients: [],
            }

            jest.spyOn(websocketService, "userRoom").mockImplementation((id) => `prefix:${id}`)
            jest.spyOn(websocketService, "userOnline").mockReturnValue(true)

            websocketService.emitUpdateUser = jest.fn()
            websocketService.emitNewDirectChatJoin = jest.fn();

            expect(websocketService.emitFriendAdded("user1", "user2", chat)).not.toBeDefined()
            expect(websocketService.emitUpdateUser).toBeCalledWith(`prefix:user2`, {
                id: "user1",
                online: true,
                relationship: RelationStatus.Friend
            })
            expect(websocketService.emitUpdateUser).toBeCalledWith(`prefix:user1`, {
                id: "user2",
                online: true,
                relationship: RelationStatus.Friend
            })
            expect(websocketService.emitNewDirectChatJoin).toBeCalledWith(["user1", "user2"], chat)
            expect(websocketService.userRoom).toBeCalledWith("user1")
            expect(websocketService.userRoom).toBeCalledWith("user2")
            expect(websocketService.userOnline).toBeCalledWith("user1")
            expect(websocketService.userOnline).toBeCalledWith("user2")
            
        })
    })

    describe("emitNewFriendRequest", () => {
        it("should emit new friend request", () => {
            const user1 = {
                id: "1",
                username: "we"
            }
            const user2 = {
                id: "2",
                username: "heeh"
            }
            websocketService.emitUpdateUser = jest.fn()
            jest.spyOn(websocketService, "userRoom").mockImplementation((id) => `prefix:${id}`)
            
            expect(websocketService.emitNewFriendRequest(user1, user2)).not.toBeDefined()

            expect(websocketService.emitUpdateUser).toBeCalledWith(`prefix:${user1.id}`, {
                ...user2,
                relationship: RelationStatus.Outgoing
            })
            expect(websocketService.emitUpdateUser).toBeCalledWith(`prefix:${user2.id}`, {
                ...user1,
                relationship: RelationStatus.Incoming
            })
            expect(websocketService.userRoom).toBeCalledWith(user1.id)
            expect(websocketService.userRoom).toBeCalledWith(user2.id)
        })
    })

    describe("emitFriendRemoved", () => {

        beforeEach(() => {
            jest.spyOn(websocketService, "userRoom").mockImplementation((id) => `prefix:${id}`)
            websocketService.emitUpdateUser = jest.fn()
            websocketService.leaveDirectChatRoom = jest.fn()
        })
        afterEach(() => {
            expect(websocketService.userRoom).toBeCalledWith("user1")
            expect(websocketService.userRoom).toBeCalledWith("user2")
        })
        const runCommonTests = (msg: string) => {
            expect(websocketService.emitUpdateUser).toBeCalledWith(`prefix:user1`, {
                id: "user2",
                relationship: RelationStatus.None,
                online: false,
            }, msg)
            expect(websocketService.emitUpdateUser).toBeCalledWith(`prefix:user2`, {
                id: "user1",
                relationship: RelationStatus.None,
                online: false,
            }, msg)
        } 
        it("should emit and not leave chat room", () => {
            const msg = "Friend request declined."

            expect(websocketService.emitFriendRemoved("user1", "user2", msg, "chatId")).not.toBeDefined()
            runCommonTests(msg)
            expect(websocketService.leaveDirectChatRoom).not.toBeCalled()
        })
        it("should emit and leave chat room", () => {
            const msg = "Friend removed."
            expect(websocketService.emitFriendRemoved("user1", "user2", msg, "chatId")).not.toBeDefined()
            runCommonTests(msg)
            expect(websocketService.leaveDirectChatRoom).toBeCalledWith(["user1", "user2"], "chatId")
        })
    })
    
    describe("emitUserOnline", () => {
        it("should emit user online", () => {
            jest.spyOn(websocketService, "userRoom").mockImplementation((id) => `prefix:${id}`)
            websocketService.emitUpdateUser = jest.fn()
            const recipients = ['id1', 'id2']

            expect(websocketService.emitUserOnline("user1", recipients, true)).not.toBeDefined();
            expect(websocketService.emitUpdateUser).toBeCalledWith(['prefix:id1', 'prefix:id2'], { id: "user1", online: true })
        })
    })

    describe("emitUpdateUser", () => {
        it("should emit updated user data", () => {
            expect(websocketService.emitUpdateUser("room", { data: "data" }, "a message")).not.toBeDefined()
            expect(websocketGateway.server.to).toBeCalledWith("room")
            expect(mockWebsocketEmit).toBeCalledWith("User:Update", { user: { data: "data" }, message: "a message" })
        })

        it("should throw InternalServerError if no room is passed", () => {
            expect(() => websocketService.emitUpdateUser("", {})).toThrowError(InternalServerErrorException)
            expect(websocketGateway.server.to).not.toBeCalled()
            expect(mockWebsocketEmit).not.toBeCalled()
        })
    })

    describe("emitUpdateChat", () => {
        it("should emit updated chat data", () => {
            const chat = { data: "data" }
            expect(websocketService.emitUpdateChat("room", chat as any)).not.toBeDefined()
            expect(websocketGateway.server.to).toBeCalledWith("room")
            expect(mockWebsocketEmit).toBeCalledWith("Chat:Update", { chat })
        })

        it("should throw InternalServerError if no room is passed", () => {
            expect(() => websocketService.emitUpdateChat("", {} as any)).toThrowError(InternalServerErrorException)
            expect(websocketGateway.server.to).not.toBeCalled()
            expect(mockWebsocketEmit).not.toBeCalled()
        })
    })

    describe("emitNewMessage", () => {
        it("should emit new message", () => {
            const message = { data: "data" }
            expect(websocketService.emitNewMessage("room", message as any, "ackId")).not.toBeDefined()
            expect(websocketGateway.server.to).toBeCalledWith("room")
            expect(mockWebsocketEmit).toBeCalledWith("Message:New", { ...message, ackId: "ackId" })
        });

        it("should throw InternalServerError if no room is passed", () => {
            expect(() => websocketService.emitNewMessage("", {} as any)).toThrowError(InternalServerErrorException)
            expect(websocketGateway.server.to).not.toBeCalled()
            expect(mockWebsocketEmit).not.toBeCalled()
        })
    })

    describe("emitException", () => {

        it("should emit exception event to the socket", () => {

            const socket = {
                emit: jest.fn()
            }

            const type = "test"
            const message = "message"

            expect(websocketService.emitException(socket as any, type, message)).not.toBeDefined()
            expect(socket.emit).toBeCalledWith("exception", { type, message })

        })
    })

    describe("emitNewDirectChatJoin", () => {
        const chat = { 
            id: "data"
        }
        const userIds = ["user1", "user2"]

        it("should join users to a direct chat room and emit their updated chat", () => {
            
            websocketService.joinDirectChatRoom = jest.fn()
            websocketService.emitUpdateChat = jest.fn()
            jest.spyOn(websocketService, "directChatRoom").mockImplementation((id) => `prefix:${id}`) 
            expect(websocketService.emitNewDirectChatJoin(userIds, chat as any)).not.toBeDefined()
            expect(websocketService.joinDirectChatRoom).toBeCalledWith(userIds, chat.id)
            expect(websocketService.emitUpdateChat).toBeCalledWith(`prefix:${chat.id}`, chat)

        })
    })

    describe("joinDirectChatRoom", () => {
        it("should join users to a direct chat room", () => {

            const chatId = "1"
            
            jest.spyOn(websocketService, "userRoom").mockImplementation((id) => `prefix:${id}`) 
            jest.spyOn(websocketService, "directChatRoom").mockImplementation((id) => `prefix1:${id}`)
            
            expect(websocketService.joinDirectChatRoom(["user1", "user2"], chatId)).not.toBeDefined()
            expect(websocketGateway.server.in).toBeCalledWith([`prefix:user1`, `prefix:user2`])
            expect(mockSocketsJoin).toBeCalledWith(`prefix1:${chatId}`)
            expect(websocketService.userRoom).toBeCalledWith("user1")
            expect(websocketService.userRoom).toBeCalledWith("user2")
            expect(websocketService.directChatRoom).toBeCalledWith(chatId)
        })
    })

    describe("leaveDirectChatRoom", () => {
        it("should remove users from a direct chat room", () => {

            const chatId = "1"

            jest.spyOn(websocketService, "userRoom").mockImplementation((id) => `prefix:${id}`)
            jest.spyOn(websocketService, "directChatRoom").mockImplementation((id) => `prefix1:${id}`)

            expect(websocketService.leaveDirectChatRoom(["user1", "user2"], chatId)).not.toBeDefined()
            expect(websocketGateway.server.in).toBeCalledWith([`prefix:user1`, `prefix:user2`])
            expect(mockSocketsLeave).toBeCalledWith(`prefix1:${chatId}`)
            expect(websocketService.userRoom).toBeCalledWith("user1")
            expect(websocketService.userRoom).toBeCalledWith("user2")
            expect(websocketService.directChatRoom).toBeCalledWith(chatId)
        })
    })

    describe("userOnline", () => {
        it("should return true", () => {
            jest.spyOn(websocketGateway.sockets, "get").mockReturnValue({ online: true } as any)
            expect(websocketService.userOnline("1")).toBe(true)
            expect(websocketGateway.sockets.get).toBeCalledWith("1")
        })
        it("should return false", () => {
            jest.spyOn(websocketGateway.sockets, "get").mockReturnValue(undefined)
            expect(websocketService.userOnline("1")).toBe(false)
            expect(websocketGateway.sockets.get).toBeCalledWith("1")
        })
    })
    describe("logoutSession", () => {
        it("should disconnect sockets of a specific session id (not the socket session id)", () => {

            jest.spyOn(websocketService, "userSessRoom").mockImplementation((id) => `prefix:${id}`) 
            expect(websocketService.logoutSession("sessionId")).not.toBeDefined()
            expect(websocketGateway.server.to).toBeCalledWith(`prefix:sessionId`)
            expect(mockDisconnectSockets).toBeCalled()
        })

        it("should throw InternalServerError if no session id is provided", () => {
            expect(() => websocketService.logoutSession("")).toThrowError(InternalServerErrorException)
            expect(websocketGateway.server.to).not.toBeCalled()
            expect(mockDisconnectSockets).not.toBeCalled()
        })
    })

    describe("userRoom", () => {
        it("should return the room name suffixed with the userId", () => {
            expect(websocketService.userRoom("userId")).toBe(`user:userId`)
        })
    })

    describe("directChatRoom", () => {
        it("should return the room name suffixed with the chatId", () => {
            expect(websocketService.directChatRoom("chatId")).toBe("chat-direct:chatId")
        })
    })

    describe("userSessRoom", () => {
        it("should return the room name suffixed with the sessionId", () => {
            expect(websocketService.userSessRoom("sessionId")).toBe("user-sessid:sessionId")
        })
    })

});