<template>

    <button @click="logout"
        class="disabled:opacity-80 transition bg-emerald-600 hover:bg-emerald-500  text-white font-bold py-2 px-4 rounded-full whitespace-nowrap">
        Log Out
    </button>


</template>

<script setup>
import { useUserStore } from '@/stores/user';
import { api } from '@/utils/axios';
import { clearSocket } from '@/utils/socket';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();

const logout = () => {
    const token = localStorage.getItem("token");
    localStorage.removeItem("token");
    router.push({ name: "homeContainer" });
    clearSocket();

    userStore.clearData();

    api.delete('/auth/logout', { 
        headers: { 
            Authorization: `Bearer ${token}`
        }
    })
}

</script>