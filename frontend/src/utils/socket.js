import { useLogout } from "@/composables/Logout";
import { useChatsStore } from "@/stores/chats";
import { useInternalMiscStore } from "@/stores/internalMisc";
import { useMessagesStore } from "@/stores/messages";
import { useUserStore } from "@/stores/user";
import io from "socket.io-client";
import localforage from "localforage";

import { logger } from "./logger";

export const socket = io(import.meta.env.VITE_API_URL, {
    autoConnect: false,
    auth: { token: "" },
});
export const initSocket = async () => {
    const userStore = useUserStore();
    const chatsStore = useChatsStore();
    const internalMiscStore = useInternalMiscStore();
    const messagesStore = useMessagesStore();
    const { logout } = useLogout();

    let buffer = [];
    let shouldBuffer = true;
    const typingTimeoutsByChat = {};

    const session = await localforage.getItem("session");
    socket.auth.token = session?.token;
    socket.removeAllListeners();

    socket.onAny((name, ...args) => {
        if (name === "Ready") return;

        if (shouldBuffer) {
            buffer.push({ name, args });
            logger.ws.info(`Buffered ${name} event.`);
        }
    });
    socket.on("Ready", (data) => {
        userStore.initData({
            users: data.users,
            user: {
                id: data.id,
                username: data.username,
            },
        });
        chatsStore.setChats(data.chats);
        data.lastMessages?.forEach(({ chatId, ...messageData }) => {
            messagesStore.addMessageToStore(messageData, chatId);
        });
        messagesStore.setAllMessagesStale();
        internalMiscStore.setWsNetworkError(false);
        logger.ws.info("Socket connected & authenticated!");

        shouldBuffer = false;
        // load data from the buffer if it exists.
        if (buffer.length > 0) {
            buffer.forEach(({ name, args }) => {
                const callbacks = socket._callbacks[`$${name}`];
                callbacks.forEach((callback) => {
                    callback.apply(socket, args);
                });
            });
            buffer = [];
        }
    });

    socket.on("User:Update", (data) => {
        userStore.updateUser(data.user);
    });

    socket.on("Chat:Update", (data) => {
        chatsStore.updateChat(data.chat);
    });

    socket.on("Message:New", (data) => {
        const { ackId, chatId, ...rest } = data;
        messagesStore.addMessageToStore(rest, chatId, ackId);
    });

    socket.on("Chat:BeginTyping", (data) => {
        chatsStore.setTypingStatus(data.chatId, data.userId, true);
        
        clearTimeout(typingTimeoutsByChat[data.chatId])
        
        typingTimeoutsByChat[data.chatId] = setTimeout(() => {
            chatsStore.setTypingStatus(data.chatId, data.userId, false);
            delete typingTimeoutsByChat[data.chatId]
        }, 5000);
    });

    socket.on("Chat:EndTyping", (data) => {
        chatsStore.setTypingStatus(data.chatId, data.userId, false);
    });

    // Error handling.

    socket.on("exception", (data) => {
        if (
            data.message === "Invalid authentication token." ||
            data.message === "Unauthorized" ||
            data.message === "Invalid session."
        ) {
            if (!userStore.auth.initialized) {
                userStore.setInitialized(true);
            }
            // logout();
        } else {
            logger.ws.error(data.message);
        }
    });
    socket.io.on("reconnect", () => {
        logger.ws.info("reconnected!");
        shouldBuffer = true;
    });
    socket.io.on("reconnect_attempt", () => {
        logger.ws.info("attempting to reconnect...");
        internalMiscStore.setWsNetworkError(true);
    });
    socket.on("disconnect", (data) => {
        if (data === "io server disconnect") {
            if (userStore.getUser) logout(true, true);
        } else messagesStore.setAllMessagesStale();
    });
    socket.connect();
};

export const clearSocket = () => {
    socket.removeAllListeners();
    socket.offAny();
    socket.disconnect();
};
