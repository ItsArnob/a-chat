import { Test, TestingModule } from "@nestjs/testing";
import { ModuleMocker, MockFunctionMetadata } from "jest-mock";

import { WebsocketService } from "@/websocket/websocket.service";
import { ChatService } from "./chat.service";
import { ChatController } from "./chat.controller";
import { Rooms } from "@/websocket/websocket.interface";
import { Message } from "@/models/chat.model";
const moduleMocker = new ModuleMocker(global);

describe("ChatController", () => {
    let chatController: ChatController;
    let chatService: ChatService;
    let websocketService: WebsocketService;

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [ChatController],
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
        chatService = app.get<ChatService>(ChatService);
        chatController = app.get<ChatController>(ChatController);
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
    it("should save a message", async () => {
        const data = {
            authorId: req.user.id,
            chatId: "2",
            content: "message!",
            timestamp: 123,
            id: "1",
        };
        const ackId = "123";
        const body = {
            content: data.content,
            ackId,
        };
        const chatRoom = `${Rooms.DirectChat}:${data.chatId}`;

        jest.spyOn(chatService, "saveDirectMessage").mockResolvedValue(data);
        jest.spyOn(websocketService, "directChatRoom").mockReturnValue(
            chatRoom
        );

        await expect(
            chatController.saveDirectMessage(req as any, data.chatId, body)
        ).resolves.toStrictEqual({ ...data, ackId });
        expect(chatService.saveDirectMessage).toBeCalledWith(
            req.user.id,
            data.chatId,
            body.content
        );
        expect(websocketService.directChatRoom).toBeCalledWith(data.chatId);
        expect(websocketService.emitNewMessage).toBeCalledWith(
            chatRoom,
            data,
            ackId
        );

        expect(chatService.saveDirectMessage).toBeCalledTimes(1);
        expect(websocketService.emitNewMessage).toBeCalledTimes(1);
    });

    it("should get messages", async () => {
        const messages: Message[] = [
            {
                authorId: "1",
                chatId: "2",
                id: "2",
                content: "message!",
            },
        ];
        const query = { before: "3", after: "1", limit: 1 };
        jest.spyOn(chatService, "getMessages").mockResolvedValue(messages);
        await expect(
            chatController.getMessages(req as any, messages[0].chatId, query)
        ).resolves.toStrictEqual(messages);
        expect(chatService.getMessages).toBeCalledWith(
            req.user.id,
            messages[0].chatId,
            query.before,
            query.after,
            query.limit
        );
        expect(chatService.getMessages).toBeCalledTimes(1);
    });
});
