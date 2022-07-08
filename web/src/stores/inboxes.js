import { useMessagesStore } from '@/stores/messages';
import { defineStore } from 'pinia';
import { api } from '@/utils/axios';
import { useUserStore } from '@/stores/user';

export const useInboxesStore = defineStore({
    id: 'inboxes',
    state: () => ({
        currentlyOpenInboxId: null,
        inboxes: [],
    }),
    getters: {
        inboxesWithProperData(state) {
            return state.inboxes.map((inbox) => {
                return this.getInboxById(inbox.id);
            }).sort((a, b) => (b.lastMessage?.id > a.lastMessage?.id) - (b.lastMessage?.id < a.lastMessage?.id));
        },
        getInboxById(state) {
            return (id) => {
                const userStore = useUserStore();
                const messagesStore = useMessagesStore();

                const inbox = state.inboxes.find(
                    (inbox) => inbox.id === id && inbox.chatType === 'Direct'
                ); // TODO: ignoring other types of chats. fix this in the future.
                if (!inbox) return;

                const recipient = inbox.recipients.find(
                    (recipient) => recipient.id !== userStore.auth.user.id
                );
                const recipientUser = userStore.users.find(
                    (user) => user.id === recipient.id
                );

                return {
                    id: inbox.id,
                    chatType: inbox.chatType,
                    online: recipientUser?.online || false,
                    name:
                        recipient?.nickname ||
                        recipientUser?.username ||
                        'Deleted User',
                    recipients: inbox.recipients,
                    lastMessage: messagesStore.getMessageById(inbox.id, inbox.lastMessageId),
                    beginningOfChatReached: inbox.beginningOfChatReached
                };
            };
        },
        currentlyOpenInbox(state) {
            return this.getInboxById(state.currentlyOpenInboxId);
        },
        getInboxIdOfUserById(state) {
            return (id) => {
                const inbox = state.inboxes.find(
                    (inbox) =>
                        inbox.recipients.find(
                            (recipient) => recipient.id === id
                        ) && inbox.chatType === 'Direct'
                );
                if (!inbox) return;

                return inbox.id;
            };
        },
    },
    actions: {
        setCurrentlyOpenInbox(id) {
            this.currentlyOpenInboxId = id;
        },
        setInboxes(inboxes) {
            this.inboxes = inboxes;
        },
        openInbox(recipientId) {
            return api
                .post(`/chat/${recipientId}?type=user`)
                .then((res) => {
                    this.addOrReplaceInbox(res.data);
                    return { ok: res.data.id };
                })
                .catch((e) => {
                    return e.response?.data?.message || e.message;
                });
        },
        updateChat({ id, ...chat }) {
                const chatIndex = this.inboxes.findIndex((chat) => chat.id === id);
                if (chatIndex > -1) {
                    this.inboxes[chatIndex] = { ...this.inboxes[chatIndex], ...chat };
                } else {
                    this.inboxes.push({ id, ...chat });
                }
        },
        addOrReplaceInbox(data) {
            const inboxExists = this.inboxes.find(
                (inbox) => inbox.id === data.id
            );

            if (inboxExists) {
                this.inboxes = this.inboxes.map((inbox) => {
                    if (inbox.id === data.id) {
                        return data;
                    }
                    return inbox;
                });
            } else {
                this.inboxes.push(data);
            }
        },
        setLastMessageId(chatId, messageId) {
            const inboxIndex = this.inboxes.findIndex(inbox => inbox.id === chatId);
            this.inboxes[inboxIndex] = { ...this.inboxes[inboxIndex], lastMessageId: messageId };
        },

    },
});
