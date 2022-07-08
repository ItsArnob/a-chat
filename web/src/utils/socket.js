import { useInboxesStore } from '@/stores/inboxes';
import { useInternalMiscStore } from '@/stores/internalMisc';
import { useMessagesStore } from '@/stores/messages';
import { useUserStore } from '@/stores/user';
import io from 'socket.io-client';

import { logger } from './logger';

export const socket = io(import.meta.env.VITE_API_URL, {
    auth: { token: localStorage.token },
    autoConnect: false,
});
export const initSocket = () => {
    const userStore = useUserStore();
    const chatsStore = useInboxesStore();
    const internalMiscStore = useInternalMiscStore();
    const messagesStore = useMessagesStore();

    let buffer = [];
    let shouldBuffer = true;

    socket.auth.token = localStorage.token;
    socket.removeAllListeners();

    socket.onAny((name, ...args) => {
        if (name === 'Ready') return;

        if (shouldBuffer) {
            buffer.push({ name, args });
            logger.ws.info(`Buffered ${name} event.`);
        }
    });
    socket.on('Ready', (data) => {
        userStore.initData({
            users: data.users,
            user: {
                id: data.id,
                username: data.username,
                isOwner: data.isOwner,
            },
        });
        chatsStore.setInboxes(data.chats);
        data.lastMessages?.forEach(({ chatId, ...messageData }) => {

            messagesStore.addMessageToStore(messageData, chatId);
        });
        messagesStore.setAllMessagesStale();

        logger.ws.info('Socket connected & authenticated!');

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
        shouldBuffer = false;
    });
    socket.on('Ready', () => {});

    socket.on('User:Update', (data) => {
        userStore.updateUser(data.user);
    });

    socket.on("Chat:Update", (data) => {
        chatsStore.updateChat(data)
    });

    socket.on("Message:New", (data) => {
        const { ackId, chatId, ...rest } = data;
        messagesStore.addMessageToStore(rest, chatId, ackId);
    })



    // Error handling.

    socket.on('connect_error', (data) => {
        if (data.message === 'Invalid authentication token.') {
            localStorage.removeItem('token');
            userStore.setUser(null);
            logger.ws.info('Socket unauthorized.');
        } else {
            logger.ws.error(data.message);
        }
    });
    socket.on("exception", (data) => {
        if (data.message === 'Invalid authentication token.') {
            localStorage.removeItem('token');
            userStore.setUser(null);
            logger.ws.info('Socket unauthorized.');
        } else {
            logger.ws.error(data.message);
        }
    })
    socket.io.on('reconnect', () => {
        logger.ws.info('reconnected!');
        shouldBuffer = true;
        internalMiscStore.setWsNetworkError(false);
        if(chatsStore.currentlyOpenInboxId) messagesStore.InitMessagesByChatIdIfStale(chatsStore.currentlyOpenInboxId);
    });
    socket.io.on('reconnect_attempt', () => {
        logger.ws.info('attempting to reconnect...');
        internalMiscStore.setWsNetworkError(true);
    });
    socket.on("disconnect", (data) => {
        messagesStore.setAllMessagesStale();
    })
    socket.connect();
};

export const clearSocket = () => {
    socket.removeAllListeners();
    socket.offAny();
    socket.disconnect();
};
