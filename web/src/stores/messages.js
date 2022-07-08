import { useInboxesStore } from '@/stores/inboxes';
import { useUserStore } from '@/stores/user';
import { api } from '@/utils/axios';
import { monotonicFactory } from 'ulid';
import { defineStore } from 'pinia';
import dayjs from 'dayjs';

const ulid = monotonicFactory();

export const useMessagesStore = defineStore({
    id: 'messages',
    state: () => ({
        messagesByInbox: {}
    }),
    getters: {
        getMessagesOfOpenChat: (state) => {

            const userStore = useUserStore();
            const chatsStore = useInboxesStore();

            if(!state.messagesByInbox[chatsStore.currentlyOpenInboxId]?.messages?.length) return []
            const sortedMessages = state.messagesByInbox[chatsStore.currentlyOpenInboxId].messages.sort((a, b) => (a.id > b.id) - (a.id < b.id));
            return sortedMessages.map((message, index) => {
                    let dataToReturn = { ...message, fromSelf: message.authorId === userStore.getUser.id };
                    if(index > 0) {
                        const prevMessage = sortedMessages[index -1];
                        const prevMessageTime = dayjs(prevMessage.timestamp).format('MMM DD, YYYY');
                        const thisMessageTime = dayjs(dataToReturn.timestamp).format('MMM DD, YYYY');
                        if(prevMessageTime !== thisMessageTime) dataToReturn.dateSeparator = dayjs(dataToReturn.timestamp).format("dddd, MMM DD, YYYY");
                    } else {
                        dataToReturn.dateSeparator = dayjs(dataToReturn.timestamp).format("dddd, MMM DD, YYYY");
                    }
                    return dataToReturn;
                })

        },

        getMessageById: (state) => (chatId, messageId) => {
            const userStore = useUserStore();
            const message = state.messagesByInbox[chatId]?.messages?.find(message => message.id === messageId);
            if(!message) return;
            return {
                ...message,
                timestamp: new Date(message.timestamp),
                fromSelf: message.authorId === userStore.auth.user.id
            }
        }
    },
    actions: {
        // TODO: REPLACE WITH addMessageToStore
        appendSelfMessage(chatId, content) {

            const userStore = useUserStore();
            const inboxesStore = useInboxesStore();

            const ackId = ulid()
            if(!this.messagesByInbox[chatId]?.messages?.length) {
                this.messagesByInbox[chatId] = { messages: [] };
            }
            this.messagesByInbox[chatId].messages.push({
                id: ackId,
                content,
                timestamp: Date.now(),
                authorId: userStore.auth.user.id,
                sending: true
            });
            inboxesStore.setLastMessageId(chatId, ackId);
            return ackId;
        },
        saveMessage(chatId, ackId, content) {
            const userStore = useUserStore();

            api.post(`/chat/${chatId}/messages`, { content, ackId })
                .then(({ data }) => {
                    const { chatId, ackId, ...rest } = data
                    this.addMessageToStore(rest, chatId, ackId)
                })
                .catch(e => {
                console.error(e);
                // TODO: use addMessageToStore
                const indexOfMessage = this.messagesByInbox[chatId].messages.findIndex((value) => value.id === ackId);
                const message = this.messagesByInbox[chatId][indexOfMessage]
                this.messagesByInbox[chatId][indexOfMessage] = { ...message, error: true };
            });
        },
        addMessageToStore(data, chatId, ackId) {
            const inboxesStore = useInboxesStore();

            if(!this.messagesByInbox[chatId]?.messages?.length) {
                this.messagesByInbox[chatId] = { messages: [] };
            }
            const indexOfMessage = this.messagesByInbox[chatId].messages.findIndex((value) => value.id === ackId || value.id === data.id);
            inboxesStore.setLastMessageId(chatId, data.id || ackId);

            if(indexOfMessage > -1) return this.messagesByInbox[chatId].messages[indexOfMessage] = data;
            this.messagesByInbox[chatId].messages.push(data);

        },
        setInitialMessages(data, chatId) {
            const inboxesStore = useInboxesStore();
            let messages = data.map(({ chatId, ...message }) => ({ ...message }));
            this.messagesByInbox[chatId] = { messages };
            // TODO: Do i need to set lastMessageId?
        },
        addMessagesToStore(data, chatId) {
            let messages = data.map(({ chatId, ...message }) => ({ ...message }));
            this.messagesByInbox[chatId].messages.push(...messages);
        },
        InitMessagesByChatIdIfStale(chatId) {
            const inboxesStore = useInboxesStore();

            if(this.messagesByInbox[chatId]?.stale) {
                return api.get(`/chat/${chatId}/messages?limit=50`).then(({ data }) => {
                    if(data.length < 50) inboxesStore.updateChat({ id: chatId, beginningOfChatReached: data[data.length - 1].id })
                    this.setInitialMessages(data, chatId);
                });
            } else if(!this.messagesByInbox[chatId]?.messages?.length) {
                inboxesStore.updateChat({ id: chatId, beginningOfChatReached: true })
            }
        },
        loadMessageBeforeId(messageId, chatId) {
            return api.get(`/chat/${chatId}/messages?before=${messageId}&limit=50`).then(({ data }) => {
                if(!data.length) return { beginningOfChatReached: messageId };
                this.addMessagesToStore(data, chatId);
                if(data.length < 50) return { beginningOfChatReached: data[data.length - 1 ].id };
            })
        },
        setMessagesStale(chatId, staleOrNot) {
            this.messagesByInbox[chatId].stale = staleOrNot;
        },
        setAllMessagesStale() {
            for(let chatId in this.messagesByInbox) {
                this.messagesByInbox[chatId].stale = true;
            }
        }
    },
});
