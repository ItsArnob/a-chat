<script setup>
import { useInternalMiscStore } from '@/stores/internalMisc';
import { useUserStore } from '@/stores/user';
import { initSocket } from '@/utils/socket';
import { onMounted } from 'vue';
import Loading from 'vue-loading-overlay';
import 'vue-loading-overlay/dist/vue-loading.css';
import { RouterView } from 'vue-router';

const userStore = useUserStore();
const internalMiscStore = useInternalMiscStore();
onMounted(() => {
    initSocket();
});
setInterval(() => internalMiscStore.updateTime(Date.now()), 1000);
</script>

<template>

    <RouterView v-if="userStore.auth.initialized" />
    <!-- TODO: replace this -->
    <Loading
        :active="!userStore.auth.initialized"
        :is-full-page="true"
        blur="0px"
        background-color="transparent"
        color="white"
    />
</template>
<style></style>
