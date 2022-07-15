<template>
    <div
        :class="[
            'z-50',
            !!chatsStore.currentlyOpenChatId
                ? forceHideSideBar
                    ? 'hidden'
                    : 'hidden md:block'
                : route.name === 'home'
                ? 'block'
                : 'hidden md:block',
        ]"
    >
        <div
            class="fixed md:static shrink-0 h-full w-full md:w-[400px] z-10 flex flex-col bg-slate-900 md:bg-slate-800/30"
        >
            <p
                class="text-center w-full bg-rose-500"
                v-if="internalMiscStore.wsNetworkError"
            >
                Reconnecting...
            </p>
            <div class="px-1.5 left-side-bar-top-bar">
                <div
                    class="shrink-0 h-14 px-2 self-start w-full flex items-center justify-between"
                >
                    <div class="flex">
                        <img
                            alt="user avatar"
                            src="https://static.wikia.nocookie.net/oneshot/images/0/02/Niko.png/"
                            class="rounded-full w-10 md:w-11"
                        />
                        <logout-button class="ml-2" />
                    </div>
                    <h2 class="text-2xl font-semibold">Chats</h2>
                    <div class="text-emerald-600 flex">
                        <router-link
                            :to="{ name: 'friends' }"
                            class="hover:text-emerald-500 transition"
                        >
                            <font-awesome-icon
                                icon="fa-solid fa-address-book"
                                class="w-7 h-7"
                            />
                        </router-link>
                    </div>
                </div>
            </div>

            <div
                class="h-full px-1.5 pt-2 w-full flex flex-col gap-0.5 overflow-y-auto"
            >
                <Chat
                    v-for="chat in chatsStore.chatsWithProperData"
                    :key="chat.id"
                    :name="chat.name"
                    :chat-id="chat.id"
                    :last-message="chat.lastMessage?.content"
                    :last-message-from-self="chat.lastMessage?.fromSelf"
                    :last-message-sending="chat.lastMessage?.sending"
                    :last-message-error="chat.lastMessage?.error"
                    :time="chat.lastMessage?.timestamp"
                    :online="chat.online"
                    :is-open="chatsStore.currentlyOpenChatId === chat.id"
                />
            </div>
        </div>
    </div>
</template>
<script setup>
import Chat from "@/components/chat/Chat.vue";
import LogoutButton from "@/components/LogoutButton.vue";

import { useChatsStore } from "@/stores/chats";
import { useInternalMiscStore } from "@/stores/internalMisc";
import { useRoute } from "vue-router";

const chatsStore = useChatsStore();
const internalMiscStore = useInternalMiscStore();
const route = useRoute();

const props = defineProps(["forceHideSideBar"]);
</script>
