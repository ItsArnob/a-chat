<template>
    <button
        @click="logout"
        class="text-emerald-600 hover:text-emerald-500"
    >
        <font-awesome-icon
            icon="fa-solid fa-arrow-right-from-bracket"
            class="w-7 h-7"
        />
    </button>
</template>

<script setup>
import { useChatsStore } from '@/stores/chats';
import { useInternalMiscStore } from '@/stores/internalMisc';
import { useMessagesStore } from '@/stores/messages';
import { useUserStore } from '@/stores/user';
import { api } from '@/utils/axios';
import { clearSocket } from '@/utils/socket';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const chatsStore = useChatsStore();
const internalMiscStore = useInternalMiscStore();
const messagesStore = useMessagesStore();
const router = useRouter();

// TODO: clear the stores
const logout = async () => {

    const token = localStorage.getItem('token');
    localStorage.removeItem('token');
    await router.push('/');
    clearSocket();
    chatsStore.$reset();
    internalMiscStore.$reset();
    messagesStore.$reset();
    userStore.$reset();

    await api.delete('/auth/logout', {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    userStore.setUser(null);
};
</script>
