import { Test, TestingModule } from "@nestjs/testing";
import { ModuleMocker, MockFunctionMetadata } from "jest-mock";

import { WebsocketService } from "@/websocket/websocket.service";
import { ChatType, Message } from "@/models/chat.model";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { AddFriendDto, RemoveFriendDto } from "@/dto/user.dto";
const moduleMocker = new ModuleMocker(global);

describe("UsersController", () => {
    let usersController: UsersController;
    let usersService: UsersService;
    let websocketService: WebsocketService;

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [UsersController],
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

        websocketService = app.get<WebsocketService>(WebsocketService);
        usersController = app.get<UsersController>(UsersController);
        usersService = app.get<UsersService>(UsersService);
    });
    const req = {
        user: {
            id: "1",
            username: "username",
            passwordHash: "awe",
            sessionId: "1",
            sessionName: "Chrome on Linux",
        },
    };

    describe("addFriend", () => {

    
        describe("Send friend request", () => {
            const addFriendResult: AddFriendDto = {
                message: "Friend request sent.",
                user: {
                    id: "2",
                    username: "otherUser"
                },
            }
            afterEach(() => {
                expect(websocketService.emitNewFriendRequest).toBeCalledWith({ id: req.user.id, username: req.user.username }, addFriendResult.user)
                expect(websocketService.emitFriendAdded).not.toBeCalled();
            })

            it("should send a friend request by id", async() => {
                
                jest.spyOn(usersService, "addFriend").mockResolvedValue(addFriendResult);

                await expect(usersController.addFriend(
                    { usernameOrId: addFriendResult.user.id },
                    { type: "id" },
                    req as any
                )).resolves.toStrictEqual(addFriendResult);
                expect(usersService.addFriend).toBeCalledWith(addFriendResult.user.id, req.user, true);
            })
            it("should send a friend request by username", async () => {

                jest.spyOn(usersService, "addFriend").mockResolvedValue(addFriendResult);

                await expect(usersController.addFriend(
                    { usernameOrId: addFriendResult.user.username },
                    { type: "username" },
                    req as any
                )).resolves.toStrictEqual(addFriendResult);
                expect(usersService.addFriend).toBeCalledWith(addFriendResult.user.username, req.user, false);
            })

        })

        describe("accept a friend request", () => {
            const addFriendResult: AddFriendDto = {
                message: "Friend request accepted.",
                user: {
                    id: "2",
                    username: "otherUser"
                },
                chat: {
                    chatType: ChatType.Direct,
                    id: "123",
                    recipients: [{ id: req.user.id }, { id: "2" }],
                }
            }
            afterEach(() => {
                expect(websocketService.emitFriendAdded).toBeCalledWith(req.user.id, addFriendResult.user.id, addFriendResult.chat);
                expect(websocketService.emitNewFriendRequest).not.toBeCalled()
            })
            it("should accept a friend request by id", async () => {
                    
                jest.spyOn(usersService, "addFriend").mockResolvedValue(addFriendResult);

                await expect(usersController.addFriend(
                    { usernameOrId: addFriendResult.user.id },
                    { type: "id" },
                    req as any
                )).resolves.toStrictEqual(addFriendResult);
                expect(usersService.addFriend).toBeCalledWith(addFriendResult.user.id, req.user, true);
            })
            it("should accept a friend request by username", async () => {
                    
                jest.spyOn(usersService, "addFriend").mockResolvedValue(addFriendResult);

                await expect(usersController.addFriend(
                    { usernameOrId: addFriendResult.user.username },
                    { type: "username" },
                    req as any
                )).resolves.toStrictEqual(addFriendResult);
                expect(usersService.addFriend).toBeCalledWith(addFriendResult.user.username, req.user, false);
            })
        })
    })
    describe("removeFriend", () => {
        it("should remove a friend", async () => {
            const result: RemoveFriendDto = {
                message: "Friend removed.",
                user: {
                    id: "2",
                },
                chatId: "1312"
            }

            jest.spyOn(usersService, "removeFriend").mockResolvedValue(result);
            await expect(usersController.removeFriend(result.user.id, req as any)).resolves.toStrictEqual(result)
            expect(usersService.removeFriend).toBeCalledWith(result.user.id, req.user);
            expect(websocketService.emitFriendRemoved).toBeCalledWith(req.user.id, result.user.id, result.message, result.chatId)
        })
    })
})