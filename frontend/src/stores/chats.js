import { useMessagesStore } from "@/stores/messages";
import { useUserStore } from "@/stores/user";
import { api } from "@/utils/axios";
import { compareString } from "@/utils/utils";
import { defineStore } from "pinia";

export const useChatsStore = defineStore({
    id: "chats",
    state: () => ({
        currentlyOpenChatId: null,
        chats: [],
    }),
    getters: {
        chatsWithProperData(state) {
            const chats = [];
            state.chats.forEach((chat) => {
                const chatNormalized = this.getChatById(chat.id);
                if (chatNormalized) chats.push(chatNormalized);
            });
            return chats.sort((a, b) =>
                compareString(b.lastMessage?.id, a.lastMessage?.id)
            );
        },
        getChatById(state) {
            return (id) => {
                const userStore = useUserStore();
                const messagesStore = useMessagesStore();

                const chat = state.chats.find(
                    (chat) => chat.id === id && chat.chatType === "Direct"
                ); // TODO: ignoring other types of chats. fix this in the future.
                if (!chat) return;

                const recipient = chat.recipients.find(
                    (recipient) => recipient.id !== userStore.auth.user.id
                );
                const recipientUser = userStore.users.find(
                    (user) => user.id === recipient.id
                );

                return {
                    id: chat.id,
                    chatType: chat.chatType,
                    online: recipientUser?.online || false,
                    name:
                        recipient?.nickname ||
                        recipientUser?.username ||
                        "Deleted User",
                    recipients: chat.recipients,
                    lastMessage: messagesStore.getMessageById(
                        chat.id,
                        chat.lastMessageId
                    ),
                    beginningOfChatReached: chat.beginningOfChatReached,
                    typing: chat.typing?.length ? chat.typing : []
                };
            };
        },
        currentlyOpenChat(state) {
            return this.getChatById(state.currentlyOpenChatId);
        },
        currentChatIsTyping() {
            return !!this.currentlyOpenChat?.typing?.length
        },
        getChatIdOfUserById(state) {
            return (id) => {
                const chat = state.chats.find(
                    (chat) =>
                        chat.recipients.find(
                            (recipient) => recipient.id === id
                        ) && chat.chatType === "Direct"
                );
                if (!chat) return;

                return chat.id;
            };
        },
    },
    actions: {
        setCurrentlyOpenChat(id) {
            this.currentlyOpenChatId = id;
        },
        setChats(chats) {
            this.chats = chats;
        },
        openChat(recipientId) {
            return api
                .post(`/chat/${recipientId}?type=user`)
                .then((res) => {
                    this.addOrReplaceChat(res.data);
                    return { ok: res.data.id };
                })
                .catch((e) => {
                    return e.response?.data?.message || e.message;
                });
        },
        updateChat({ id, ...chat }) {
            const chatIndex = this.chats.findIndex((chat) => chat.id === id);
            if (chatIndex > -1) {
                this.chats[chatIndex] = { ...this.chats[chatIndex], ...chat };
            } else {
                this.chats.push({ id, ...chat });
            }
        },

        setTypingStatus(chatId, userId, isTyping) {
            const chatIndex = this.chats.findIndex((chat) => chat.id === chatId);
            if(chatIndex > -1) {
                const chat = this.chats[chatIndex];
                if(!chat.typing) chat.typing = [];

                if(isTyping && !chat.typing.includes(userId)) {
                    chat.typing.push(userId)
                } else if(!isTyping && chat.typing.includes(userId)) {
                    chat.typing = chat.typing.filter(id => id != userId)
                };
            }
        },

        addOrReplaceChat(data) {
            const chatExists = this.chats.find((chat) => chat.id === data.id);

            if (chatExists) {
                this.chats = this.chats.map((chat) => {
                    if (chat.id === data.id) {
                        return data;
                    }
                    return chat;
                });
            } else {
                this.chats.push(data);
            }
        },
        setLastMessageId(chatId, messageId) {
            const chatIndex = this.chats.findIndex(
                (chat) => chat.id === chatId
            );
            this.chats[chatIndex] = {
                ...this.chats[chatIndex],
                lastMessageId: messageId,
            };
        },
    },
});
