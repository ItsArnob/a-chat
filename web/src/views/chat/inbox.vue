<template>
    <div
        class="h-14 shrink-0 w-full self-start bg-slate-800 flex flex-wrap justify-between items-center p-2"
    >
        <div class="flex items-center h-full">
            <button
                @click="emit('toggleSideBar')"
                class="hidden md:inline-block mr-2 leading-none text-emerald-600 hover:text-emerald-500 p-1"
            >
                <font-awesome-icon icon="fa-solid fa-bars" class="w-6 h-6" />
            </button>
            <button
                @click="goHome"
                class="md:hidden mr-2 leading-none text-emerald-600 hover:text-emerald-500 p-1"
            >
                <font-awesome-icon
                    icon="fa-solid fa-angle-left"
                    class="w-6 h-6"
                />
            </button>
            <p
                class="text-xl leading-none"
                v-if="inboxesStore.getCurrentlyOpenInbox"
            >
                {{ inboxesStore.getCurrentlyOpenInbox.name }}
            </p>
        </div>
        <div>
            <LogoutButton />
        </div>
    </div>
    <p class="text-center bg-rose-500" v-if="internalMiscStore.wsNetworkError">
        Reconnecting...
    </p>

    <div
        class="h-full pt-2 px-2 overflow-y-auto custom-scroll-bar"
        ref="messagesContainer"
    >
        <message
            v-for="msg in messages"
            :key="msg.messageId"
            :message="msg.message"
            :username="msg.username"
            :date="msg.date"
            :messageId="msg.messageId"
            :status="msg.status"
        />
    </div>
    <MessageInput
        @scroll-to-bottom="scrollToBottom"
        v-if="userStore.canSendMessageToUser(otherUserId)"
    />
    <div
        v-else
        class="w-full px-2 py-4 bg-slate-800 flex items-center text-slate-300"
    >
        <font-awesome-icon icon="fa-solid fa-ban" class="w-5 h-5 mr-2" />
        <p>You must be friends to exchange messages.</p>
    </div>
</template>

<script setup>
import Message from '@/components/chat/Message.vue';
import MessageInput from '@/components/chat/MessageInput.vue';
import LogoutButton from '@/components/LogoutButton.vue';
import { useInboxesStore } from '@/stores/inboxes';
import { useInternalMiscStore } from '@/stores/internalMisc';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from '../../stores/user';

const inboxesStore = useInboxesStore();
const userStore = useUserStore();
const internalMiscStore = useInternalMiscStore();
const route = useRoute();
const router = useRouter();
const messagesContainer = ref();
const messages = ref([]);

const inbox = inboxesStore.getInboxById(route.params.id);
const otherUserId = inbox.recipients.find(
    (recipient) => recipient.userId !== userStore.getUser.id
).userId;

onMounted(() => {
    inboxesStore.setCurrentlyOpenInbox(route.params.id);
});
onBeforeUnmount(() => {
    observer.disconnect();
    inboxesStore.setCurrentlyOpenInbox(null);
});

const observer = new IntersectionObserver(
    (entries) => {
        if (entries[0].isIntersecting) {
            messagesContainer.value.scrollTop =
                messagesContainer.value.scrollHeight;
        }
        observer.unobserve(entries[0].target);
    },
    {
        root: messagesContainer.value,
        rootMargin: '0px',
        threshold: 1,
    }
);

const scrollToBottom = () => {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
};
const goHome = () => {
    router.push('/');
};

const emit = defineEmits(['toggleSideBar']);
</script>
