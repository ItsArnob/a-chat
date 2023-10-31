<template>
    <div class="flex flex-col h-full w-full relative">
        <div
            class="h-12 shrink-0 w-full self-start flex flex-wrap justify-between items-center p-2 bottom-shadow"
        >
            <div class="flex items-center h-full">
                <button
                    @click="emit('toggleSideBar')"
                    class="hidden md:inline-block mr-2 leading-none text-emerald-600 hover:text-emerald-500 p-1"
                >
                    <font-awesome-icon
                        icon="fa-solid fa-bars"
                        class="w-5 h-5"
                    />
                </button>
                <button
                    @click="goHome"
                    class="md:hidden mr-2 leading-none text-emerald-600 hover:text-emerald-500 p-1"
                >
                    <font-awesome-icon
                        icon="fa-solid fa-arrow-left"
                        class="w-5 h-5"
                    />
                </button>
                <div
                    class="flex items-center"
                    v-if="chatsStore.currentlyOpenChat"
                >
                    <Avatar
                        size="sm"
                        :online="chatsStore.currentlyOpenChat.online === true"
                    />
                    <div class="ml-2">
                        <p class="text-lg leading-none">
                            {{ chatsStore.currentlyOpenChat.name }}
                        </p>
                        <p class="text-sm leading-none text-slate-300">
                            {{ activeStatus }}
                        </p>
                    </div>
                </div>
            </div>
        </div>
        <p
            class="text-center bg-rose-500 text-sm"
            v-if="internalMiscStore.wsNetworkError"
        >
            Reconnecting...
        </p>
        <div
            class="h-full pt-2 px-2 overflow-y-auto flex flex-col gap-y-1.5 messages-container"
            ref="messagesContainer"
            @scroll="autoScrollToBottomButtonHandler"
        >
            <div
                v-if="chatsStore.currentlyOpenChat?.beginningOfChatReached"
                class="my-4 flex flex-col items-center"
            >
                <Avatar
                    size="lg"
                    :online="chatsStore.currentlyOpenChat.online === true"
                />
                <p class="text-xl mt-2">
                    {{ chatsStore.currentlyOpenChat.name }}
                </p>
                <p class="text-gray-300 ">This is the beginning of your conversation.</p>
            </div>
            <div class="flex flex-col gap-y-1 mt-auto relative">
                <Spinner
                    v-if="messageLoading.top && !messageLoadFailed.failed"
                    class="w-6 h-6 shrink-0 mr-auto ml-auto my-2"
                />
                <button
                    @click="loadFailedMessages"
                    v-else-if="messageLoadFailed.failed"
                    class="text-center text-sm"
                >
                    <RefreshIcon class="h-6 w-6 text-rose-400 mx-auto" />
                    <p class="text-rose-400">
                        Failed to load messages, click to retry.
                    </p>
                </button>
                <template
                    v-for="message in messagesStore.getMessagesOfOpenChat"
                    :key="message.id"
                >
                    <div
                        v-if="message.dateSeparator"
                        class="text-center text-slate-300 text-sm or-line-around"
                    >
                        {{ message.dateSeparator }}
                    </div>
                    <message
                        :id="message.id"
                        :message-id="message.id"
                        :content="message.content"
                        :from-self="message.fromSelf"
                        :time="message.timestamp"
                        :sending="message.sending"
                        :error="message.error"
                        :show-avatar="!!message.showAvatar"
                        :chat-id="chatsStore.currentlyOpenChatId"
                    />
                </template>
                <Spinner
                    v-if="messageLoading.bottom"
                    class="w-6 h-6 shrink-0 mr-auto ml-auto my-2"
                />
            </div>
            <TypingIndicator v-show="chatsStore.currentChatIsTyping"/>
        </div>

        <transition name="slide-fade">
            <div
                v-if="showScrollToBottomBtn"
                class="absolute bottom-[4rem] left-0 right-0 mx-auto w-16 flex justify-center"
            >
                <button
                    class="bg-slate-700 hover:bg-slate-600 transition duration-75 p-1.5 rounded-full"
                    @click="() => scrollToBottom(true)"
                >
                    <ArrowSmDownIcon class="w-7 h-7 text-fuchsia-300" />
                </button>
            </div>
        </transition>

        <MessageInput
            @scroll-to-bottom="() => scrollToBottom(true)"
            v-if="userStore.canSendMessageToUser(otherUserId)"
            :chatId="$route.params.id"
        />
        <div
            v-else
            class="w-full px-2 py-3 bg-slate-800 flex items-center text-slate-300"
        >
            <font-awesome-icon icon="fa-solid fa-ban" class="w-5 h-5 mr-2" />
            <p>You must be friends to exchange messages.</p>
        </div>
    </div>
</template>

<script setup>
import Avatar from "@/components/user/Avatar.vue";
import Message from "@/components/chat/Message.vue";
import MessageInput from "@/components/chat/MessageInput.vue";
import Spinner from "@/components/icons/Spinner.vue";
import TypingIndicator from "@/components/chat/TypingIndicator.vue";

import { useActiveStatusRef } from "@/composables/ActiveStatus";

import { useChatsStore } from "@/stores/chats";
import { useInternalMiscStore } from "@/stores/internalMisc";
import { useMessagesStore } from "@/stores/messages";
import { useUserStore } from "@/stores/user";

import { ArrowSmDownIcon, RefreshIcon } from "@heroicons/vue/outline";

import { useRoute, useRouter } from "vue-router";
import { useTitle } from "@vueuse/core";
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from "vue";

const chatsStore = useChatsStore();
const userStore = useUserStore();
const internalMiscStore = useInternalMiscStore();
const messagesStore = useMessagesStore();

const route = useRoute();
const router = useRouter();
const { activeStatus } = useActiveStatusRef(
    computed(() => chatsStore.currentlyOpenChat?.online)
);
useTitle(
    computed(() => chatsStore.currentlyOpenChat?.name || "Loading chat...")
);

const messagesContainer = ref();
const messageLoading = ref({ top: false, bottom: false });
const messageLoadFailed = ref({ failed: false, type: null });
const firstMessage = ref(null);
const showScrollToBottomBtn = ref(false);

let previousObservingFirstMessage;
let startObservingMessages = false;
const otherUserId = computed(
    () =>
        chatsStore.currentlyOpenChat?.recipients?.find(
            (recipient) => recipient.id !== userStore.getUser.id
        ).id
);

const loadMessageObserver = new IntersectionObserver(
    async (entries) => {
        if (entries[0].isIntersecting) {
            if (chatsStore.currentlyOpenChat.beginningOfChatReached)
                return loadMessageObserver.unobserve(entries[0].target);
            firstMessage.value = entries[0].target;
            loadMessagesBeforeFirstMessage();
        }
    },
    {
        root: messagesContainer.value,
        rootMargin: "0px",
        threshold: 1,
    }
);

const observeFirstMessage = async () => {
    const firstMessage = await nextTick(
        () => Array.from(document.querySelectorAll(".message-wrapper"))[0]
    );
    firstMessage.value = firstMessage;
    if (previousObservingFirstMessage)
        loadMessageObserver.unobserve(previousObservingFirstMessage);
    if (firstMessage) {
        loadMessageObserver.observe(firstMessage);
        previousObservingFirstMessage = firstMessage;
    }
};
const loadInitialMessages = () => {
    if (messageLoading.value.top) return;
    messageLoading.value.top = true;
    messagesStore
        .InitMessagesByChatIdIfStale(route.params.id, true)
        .then(async () => {
            scrollToBottom();
            if (!chatsStore.currentlyOpenChat.beginningOfChatReached) {
                startObservingMessages = true;
                await observeFirstMessage();
            }
        })
        .catch((e) => {
            console.log(e.message);
            messageLoadFailed.value = {
                failed: true,
                type: "LoadInitialMessages",
            };
        })
        .finally(() => {
            messageLoading.value.top = false;
        });
};
const loadMessagesBeforeFirstMessage = () => {
    if (messageLoading.value.top) return;
    messageLoading.value.top = true;
    messageLoadFailed.value = { failed: false, type: null };

    let initialHeight = messagesContainer.value.scrollHeight;
    messagesStore
        .loadMessageBeforeId(firstMessage.value.id, route.params.id)
        .then(async (result) => {
            await nextTick(() => {
                messagesContainer.value.scrollTop =
                    messagesContainer.value.scrollHeight - initialHeight;
            });

            if (result?.beginningOfChatReached) {
                chatsStore.updateChat({
                    id: route.params.id,
                    beginningOfChatReached: result.beginningOfChatReached,
                });
                return loadMessageObserver.unobserve(firstMessage.value);
            }
        })
        .catch((e) => {
            console.log(e.message);
            messageLoadFailed.value = {
                failed: true,
                type: "LoadMoreMessages",
            };
        })
        .finally(() => {
            messageLoading.value.top = false;
        });
};
const loadFailedMessages = () => {
    if (messageLoading.value.top) return;
    messageLoadFailed.value.failed = false;

    if (messageLoadFailed.value.type === "LoadInitialMessages") {
        messageLoadFailed.value.type = null;
        loadInitialMessages();
    } else if (messageLoadFailed.value.type === "LoadMoreMessages") {
        messageLoadFailed.value.type = null;
        loadMessagesBeforeFirstMessage();
    }
};
const escapeListenerHandler = (event) => {
    event = event || window.event;
    let isEscape = false;
    if ("key" in event) {
        isEscape = event.key === "Escape" || event.key === "Esc";
    } else {
        isEscape = event.keyCode === 27;
    }
    if (isEscape) {
        scrollToBottom(true);
    }
};
const autoScrollToBottomButtonHandler = (event) => {
    const element = event.target;
    showScrollToBottomBtn.value =
        Math.abs(
            element.scrollHeight - element.clientHeight - element.scrollTop
        ) > 1000;
};

const scrollToBottom = (smooth) => {
    const reducedMotion = window.matchMedia(`(prefers-reduced-motion: reduce)`).matches
    messagesContainer.value.scrollTo({ top: messagesContainer.value.scrollHeight, behavior: smooth && !reducedMotion ? 'smooth' : 'instant' });
};

const goHome = () => {
    router.push("/");
};

const emit = defineEmits(["toggleSideBar"]);

onMounted(async () => {
    chatsStore.setCurrentlyOpenChat(route.params.id);
    loadInitialMessages();
    document.addEventListener("keydown", escapeListenerHandler);
});

onBeforeUnmount(() => {
    document.removeEventListener("keydown", escapeListenerHandler);
    messagesStore.keepLastNMessages(chatsStore.currentlyOpenChatId, 50);
    chatsStore.setCurrentlyOpenChat(null);
});
watch(
    () => messagesStore.getMessagesOfOpenChat.length,
    async (newLength, oldLength) => {
        // for autoscroll on new message (only if its in view).
        if (newLength > oldLength) {
            // new message has been added to the store.
            const distanceFromBottom = Math.abs(
                messagesContainer.value.scrollHeight -
                    messagesContainer.value.clientHeight -
                    messagesContainer.value.scrollTop
            );
            if (distanceFromBottom < 30) {
                // using 30px here just for some headroom

                nextTick(() => scrollToBottom(true));
            }
        }

        // observe the very first message that's rendered, so we can load more message before that when its in view.
        if (
            startObservingMessages &&
            !chatsStore.currentlyOpenChat.beginningOfChatReached
        ) {
            await observeFirstMessage();
        }
    }
);

watch(() => chatsStore.currentChatIsTyping, (newVal) => {
    const shouldScroll = Math.abs(
            messagesContainer.value.scrollHeight - messagesContainer.value.clientHeight - messagesContainer.value.scrollTop
        ) < 30;    
    if(newVal && shouldScroll) nextTick(() => scrollToBottom(true)) 
});

internalMiscStore.$onAction(({ after, name, args: disconnected }) => {
    if (name === "setWsNetworkError")
        after(() => {
            if (
                !disconnected[0] &&
                messagesStore.isMessagesStale(route.params.id)
            ) {
                loadInitialMessages();
            }
        });
});
</script>
<style>
.vue-simple-context-menu {
    position: fixed !important;
}
.or-line-around {
    display: flex;
    flex-direction: row;
}
.or-line-around:before,
.or-line-around:after {
    content: "";
    flex: 1 1;
    border-bottom: 1px solid rgba(156, 163, 175, 0.3);
    margin: auto;
}
.or-line-around:before {
    margin-right: 10px;
}
.or-line-around:after {
    margin-left: 10px;
}

.message-wrapper:nth-child(2) {
    @apply mt-auto;
}
.bottom-shadow {
    box-shadow: 6px 1px 4px -1px rgba(0, 0, 0, 0.8);
    z-index: 1;
}
.slide-fade-enter-active {
    transition: all 0.2s ease-out;
}

.slide-fade-leave-active {
    transition: all 0.2s;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateY(20px);
    opacity: 0;

}
</style>
