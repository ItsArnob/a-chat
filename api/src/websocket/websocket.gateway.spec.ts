import { ChatType } from "@/models/chat.model";
import { RelationStatus } from "@/models/user.model";
import { Test } from "@nestjs/testing";
import { ModuleMocker, MockFunctionMetadata } from "jest-mock";
import { WebsocketGateway } from "./websocket.gateway";
import { WebsocketService } from "./websocket.service";
import { Rooms } from './websocket.interface'
import { ImATeapotException, InternalServerErrorException, UnauthorizedException } from "@nestjs/common";

const moduleMocker = new ModuleMocker(global);

describe("WebsocketGateway", () => {
    let websocketGateway: WebsocketGateway
    let websocketService: WebsocketService

    beforeEach(async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [WebsocketGateway],
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
        websocketGateway = moduleRef.get<WebsocketGateway>(WebsocketGateway);
        websocketService = moduleRef.get<WebsocketService>(WebsocketService);

        jest.spyOn(websocketService, "userRoom").mockImplementation((id) => `${Rooms.User}:${id}`)
        jest.spyOn(websocketService, "userSessRoom").mockImplementation((id) => `${Rooms.UserSessionId}:${id}`)
        jest.spyOn(websocketService, "directChatRoom").mockImplementation((id) => `${Rooms.DirectChat}:${id}`)
        websocketService.emitUserOnline = jest.fn()
    });
    describe("handleConnection", () => {

        const socket = {
            join: jest.fn(),
            emit: jest.fn(),
            id: "socketId",
            disconnect: jest.fn()
        }
        afterEach(() => {
            socket.join.mockReset()
            socket.emit.mockReset()
            socket.disconnect.mockReset()
        })
        describe("happy path", () => {
            const userid = "id"
            const { sessionId, ...data } = {
                id: "id",
                chats: [
                    {
                        chatType: ChatType.Direct,
                        id: "chatId1",
                        recipients: [{ id: userid }, { id: "id1" }]
                    },
                    {
                        chatType: ChatType.Direct,
                        id: "chatId2",
                        recipients: [{ id: userid }, { id: "id2" }],
                        lastMessageId: "2"
                    },
                    {
                        chatType: ChatType.Direct,
                        id: "chatId3",
                        recipients: [{ id: userid }, { id: "id3" }],
                        lastMessageId: "3"
                    },
                    {
                        chatType: ChatType.Group,
                        id: "chatId35",
                        recipients: [{ id: userid }, { id: "id3" }],
                    },
                ],
                lastMessages: [
                    {
                        id: "2",
                        chatId: "chatId2",
                        authorId: userid
                    },
                    {
                        id: "3",
                        chatId: "chatId3",
                        authorId: "id3"
                    }
                ],
                sessionId: "weadaefawt",
                username: "username",
                users: [{
                    id: "id1",
                    online: true,
                    relationship: RelationStatus.Friend,
                    username: "firstFriend"
                }, {
                    id: "id2",
                    online: false,
                    relationship: RelationStatus.Outgoing,
                    username: "sentFr"
                }, {
                    id: "id3",
                    online: false,
                    relationship: undefined,
                    username: "onlyRelatedByChat"
                }]
            }
            it("should successfully handle connection (single active session)", async () => {
            
                const mockedMap = new Map([['id1', { sIds: ["socketsess"], online: true }]])
                websocketGateway.sockets = mockedMap

                jest.spyOn(websocketService, "authenticateUserFromSocket").mockResolvedValue({ sessionId, ...data })

                await expect(websocketGateway.handleConnection(socket as any)).resolves.not.toBeDefined()

                expect(websocketService.authenticateUserFromSocket).toBeCalledWith(socket, mockedMap)
                expect(mockedMap.get(data.id)).toEqual({ sIds: [socket.id], online: true })
                expect(websocketService.emitUserOnline).toBeCalledWith(data.id, [data.users[0].id], true)
                expect(socket.emit).toBeCalledWith("Ready", data)
                expect(socket.join).toBeCalledWith([`user:${data.id}`, `user-sessid:${sessionId}`, `chat-direct:${data.chats[0].id}`])

            })

            it("should successfully handle connection (multiple active sessions)", async () => {
                const mockedMap = new Map([['id1', { sIds: ["socketsess"], online: true }], ["id", { sIds: [ "socketid2" ], online: true }]])
                websocketGateway.sockets = mockedMap
                
                jest.spyOn(websocketService, "authenticateUserFromSocket").mockResolvedValue({ sessionId, ...data })

                await expect(websocketGateway.handleConnection(socket as any)).resolves.not.toBeDefined()

                expect(websocketService.authenticateUserFromSocket).toBeCalledWith(socket, mockedMap)
                expect(mockedMap.get(data.id)).toEqual({ sIds: ["socketid2", socket.id], online: true })
                expect(websocketService.emitUserOnline).toBeCalledWith(data.id, [data.users[0].id], true)
                expect(socket.emit).toBeCalledWith("Ready", data)
                expect(socket.join).toBeCalledWith([`user:${data.id}`, `user-sessid:${sessionId}`, `chat-direct:${data.chats[0].id}`])

            })

            it("should successfully handle connection (no friends)", async() => {
                const dataNoFriends = {
                    ...data
                }
                dataNoFriends.users = data.users.map(({ relationship, ...rest }) => ({ ...rest, relationship: undefined }))
                const mockedMap = new Map()
                websocketGateway.sockets = mockedMap

                jest.spyOn(websocketService, "authenticateUserFromSocket").mockResolvedValue({ sessionId, ...dataNoFriends })

                await expect(websocketGateway.handleConnection(socket as any)).resolves.not.toBeDefined()

                expect(websocketService.authenticateUserFromSocket).toBeCalledWith(socket, mockedMap) 
                expect(mockedMap.get(data.id)).toEqual({ sIds: [socket.id], online: true })
                expect(socket.emit).toBeCalledWith("Ready", dataNoFriends)
                expect(websocketService.emitUserOnline).not.toBeCalled()
                expect(socket.join).toBeCalledWith([`user:${data.id}`, `user-sessid:${sessionId}`])

            })

        })
        describe("unhappy path", () => {

            afterEach(() => {
                expect(socket.disconnect).toBeCalledTimes(1)
                expect(socket.join).not.toBeCalled()
            })

            it("should emit and disconnect socket on Unauthorized error", async() => {
                jest.spyOn(websocketService, "authenticateUserFromSocket").mockRejectedValue(new UnauthorizedException())
                
                await expect(websocketGateway.handleConnection(socket as any)).resolves.not.toBeDefined()
                
                expect(websocketService.emitException).toBeCalledWith(socket, "onGatewayConnection", "Invalid session.")
            })
            
            it("should emit unknown error when any other error is thrown", async () => {
                jest.spyOn(websocketService, "authenticateUserFromSocket").mockRejectedValue(new ImATeapotException())
                
                await expect(websocketGateway.handleConnection(socket as any)).resolves.not.toBeDefined()
                
                expect(websocketService.emitException).toBeCalledWith(socket, "onGatewayConnection", "An unknown error occurred.")
            })
        })
    })

    describe("handleDisconnect", () => {

        const socket = {
            id: "socketId",
            user: {
                id: "id"
            }
        }
        it("should remove socket session from state and notify friends (single active session)", async() => {
            const mockedMap = new Map([[socket.user.id, { sIds: [socket.id], online: true }]])
            const disconnectTime = new Date()

            websocketGateway.sockets = mockedMap

            jest.useFakeTimers({ now: disconnectTime });
            jest.spyOn(websocketService, "getFriendIdsFromSocket").mockResolvedValue(["id1"])

            await expect(websocketGateway.handleDisconnect(socket as any)).resolves.not.toBeDefined()
            expect(mockedMap.get(socket.user.id)).toEqual({ sIds: [], online: disconnectTime })
            expect(websocketService.getFriendIdsFromSocket).toBeCalledWith(socket)
            expect(websocketService.emitUserOnline).toBeCalledWith(socket.user.id, ["id1"], disconnectTime)

        })
        it("should remove socket session from state and notify friends (multiple active session)", async () => {
            const mockedMap = new Map([[socket.user.id, { sIds: [socket.id, "othersess"], online: true }]])
            const disconnectTime = new Date()

            websocketGateway.sockets = mockedMap

            jest.useFakeTimers({ now: disconnectTime });
            jest.spyOn(websocketService, "getFriendIdsFromSocket").mockResolvedValue(["id1"])

            await expect(websocketGateway.handleDisconnect(socket as any)).resolves.not.toBeDefined()
            expect(mockedMap.get(socket.user.id)).toEqual({ sIds: ["othersess"], online: true })
            expect(websocketService.getFriendIdsFromSocket).toBeCalledWith(socket)
            expect(websocketService.emitUserOnline).not.toBeCalled()
        })
        it("should do nothing if client isn't authenticated", async () => {
            await expect(websocketGateway.handleDisconnect({} as any)).resolves.not.toBeDefined()
            expect(websocketService.getFriendIdsFromSocket).not.toBeCalled()
        })

        it("should catch and not log http errors", async () => {
            jest.spyOn(websocketService, "getFriendIdsFromSocket").mockRejectedValue(() => new InternalServerErrorException())
            await expect(websocketGateway.handleDisconnect(socket as any)).resolves.not.toBeDefined()
            //TODO: assert logger.error is called
        })
        it("should catch and log non-http errors", async () => {
            jest.spyOn(websocketService, "getFriendIdsFromSocket").mockRejectedValue(() => new Error())
            await expect(websocketGateway.handleDisconnect(socket as any)).resolves.not.toBeDefined()
            //TODO: assert logger.error is not called
        })
    })
})
