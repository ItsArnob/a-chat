import { useChatsStore } from "@/stores/chats";
import { useUserStore } from "@/stores/user";
import { api } from "@/utils/axios";
import { compareString } from "@/utils/utils";
import dayjs from "dayjs";
import { defineStore } from "pinia";
import { monotonicFactory } from "ulid";

const ulid = monotonicFactory();

export const useMessagesStore = defineStore({
    id: "messages",
    state: () => ({
        messagesByChat: {},
    }),
    getters: {
        getMessagesOfOpenChat: (state) => {
            const userStore = useUserStore();
            const chatsStore = useChatsStore();

            if (
                !state.messagesByChat[chatsStore.currentlyOpenChatId]?.messages
                    ?.length
            )
                return [];
            const sortedMessages = state.messagesByChat[
                chatsStore.currentlyOpenChatId
            ].messages.sort((a, b) => compareString(a.id, b.id));

            let lastMessageAuthor;
            return sortedMessages.map((message, index) => {
                let dataToReturn = {
                    ...message,
                    fromSelf: message.authorId === userStore.getUser.id,
                };
                if (index > 0) {
                    const prevMessage = sortedMessages[index - 1];
                    const prevMessageTime = dayjs(prevMessage.timestamp).format(
                        "MMM DD, YYYY"
                    );
                    const thisMessageTime = dayjs(
                        dataToReturn.timestamp
                    ).format("MMM DD, YYYY");
                    if (prevMessageTime !== thisMessageTime) {
                        dataToReturn.dateSeparator = dayjs(
                            dataToReturn.timestamp
                        ).format("dddd, MMM DD, YYYY");
                        
                        if(!dataToReturn.fromSelf) dataToReturn.showAvatar = true;
                    }

                    if (message.authorId !== lastMessageAuthor && !dataToReturn.fromSelf) {
                        dataToReturn.showAvatar = true;
                    }
                    
                    lastMessageAuthor = message.authorId;
                } else {
                    dataToReturn.dateSeparator = dayjs(
                        dataToReturn.timestamp
                    ).format("dddd, MMM DD, YYYY");
                    if (!dataToReturn.fromSelf) dataToReturn.showAvatar = true;
                    
                    lastMessageAuthor = message.authorId;
                }
                return dataToReturn;
            });
        },

        getMessageById: (state) => (chatId, messageId) => {
            const userStore = useUserStore();
            const message = state.messagesByChat[chatId]?.messages?.find(
                (message) => message.id === messageId
            );
            if (!message) return;
            return {
                ...message,
                timestamp: new Date(message.timestamp),
                fromSelf: message.authorId === userStore.auth.user.id,
            };
        },
    },
    actions: {
        appendSelfMessage(chatId, content) {
            const userStore = useUserStore();
            const ackId = ulid();
            this.addMessageToStore(
                {
                    id: ackId,
                    content,
                    timestamp: Date.now(),
                    authorId: userStore.auth.user.id,
                    sending: true,
                },
                chatId,
                ackId
            );
            return ackId;
        },
        saveMessage(chatId, ackId, content) {
            api.post(`/chat/${chatId}/messages`, { content, ackId })
                .then(({ data }) => {
                    const { chatId, ackId, ...rest } = data;
                    this.addMessageToStore(rest, chatId, ackId);
                })
                .catch((e) => {
                    this.addMessageToStore(
                        { error: true },
                        chatId,
                        ackId,
                        true
                    );
                });
        },
        addMessageToStore(data, chatId, ackId, shouldUpdate) {
            const chatsStore = useChatsStore();

            if (!this.messagesByChat[chatId]?.messages?.length) {
                this.messagesByChat[chatId] = { messages: [] };
            }
            const indexOfMessage = this.messagesByChat[
                chatId
            ].messages.findIndex(
                (value) => value.id === ackId || value.id === data.id
            );
            chatsStore.setLastMessageId(chatId, data.id || ackId);

            if (indexOfMessage > -1) {
                if (shouldUpdate) {
                    const message =
                        this.messagesByChat[chatId].messages[indexOfMessage];
                    return (this.messagesByChat[chatId].messages[
                        indexOfMessage
                    ] = { ...message, ...data });
                } else
                    return (this.messagesByChat[chatId].messages[
                        indexOfMessage
                    ] = data);
            }
            this.messagesByChat[chatId].messages.push(data);
        },
        setInitialMessages(data, chatId, keepFailedMessages) {
            const chatsStore = useChatsStore();
            let messages = data.map(({ chatId, ...message }) => ({
                ...message,
            }));
            if (keepFailedMessages && this.messagesByChat[chatId]?.messages) {
                const failedMessages = this.messagesByChat[
                    chatId
                ].messages.filter((message) => message.error);
                messages.push(...failedMessages);
            }
            messages.sort((a, b) => compareString(a.id, b.id));
            this.messagesByChat[chatId] = { messages }; // note: this also removes the stale field.
            if (messages[messages.length - 1])
                chatsStore.setLastMessageId(
                    chatId,
                    messages[messages.length - 1].id
                );
        },
        addMessagesToStore(data, chatId) {
            let messages = data.map(({ chatId, ...message }) => ({
                ...message,
            }));
            this.messagesByChat[chatId].messages.push(...messages);
        },
        async InitMessagesByChatIdIfStale(chatId, keepFailedMessages) {
            const chatsStore = useChatsStore();

            if (this.messagesByChat[chatId]?.stale) {
                return api
                    .get(`/chat/${chatId}/messages?limit=50`)
                    .then(({ data }) => {
                        if (data.length < 50)
                            chatsStore.updateChat({
                                id: chatId,
                                beginningOfChatReached:
                                    data[data.length - 1].id,
                            });
                        this.setInitialMessages(
                            data,
                            chatId,
                            keepFailedMessages
                        );
                    });
            } else if (!this.messagesByChat[chatId]?.messages?.length) {
                chatsStore.updateChat({
                    id: chatId,
                    beginningOfChatReached: true,
                });
            }
        },
        async loadMessageBeforeId(messageId, chatId) {
            return api
                .get(`/chat/${chatId}/messages?before=${messageId}&limit=50`)
                .then(({ data }) => {
                    if (!data.length)
                        return { beginningOfChatReached: messageId };
                    this.addMessagesToStore(data, chatId);
                    if (data.length < 50)
                        return {
                            beginningOfChatReached: data[data.length - 1].id,
                        };
                });
        },
        async resendMessage(messageId, chatId) {
            const newTime = Date.now();
            const newId = ulid(newTime);
            const message = this.addMessageToStore(
                { id: newId, timestamp: newTime, sending: true, error: false },
                chatId,
                messageId,
                true
            );
            await this.saveMessage(chatId, newId, message.content);
        },
        keepLastNMessages(chatId, messagesCount) {
            if (!this.messagesByChat[chatId]?.messages) return;
            if (messagesCount >= this.messagesByChat[chatId].messages.length)
                return;
            const chatsStore = useChatsStore();

            const messagesSorted = this.messagesByChat[chatId].messages.sort(
                (a, b) => compareString(a.id, b.id)
            );
            messagesSorted.splice(0, messagesSorted.length - messagesCount);

            chatsStore.updateChat({
                id: chatId,
                beginningOfChatReached: undefined,
            });
            this.messagesByChat[chatId].messages = messagesSorted;
        },
        isMessagesStale(chatId) {
            return !!this.messagesByChat[chatId]?.stale;
        },
        setMessagesStale(chatId, staleOrNot) {
            this.messagesByChat[chatId].stale = staleOrNot;
        },
        setAllMessagesStale() {
            for (let chatId in this.messagesByChat) {
                this.messagesByChat[chatId].stale = true;
            }
        },
    },
});
