<script setup>
import Spinner from "@/components/icons/Spinner.vue";
import { useInternalMiscStore } from "@/stores/internalMisc";
import { useUserStore } from "@/stores/user";
import { initSocket } from "@/utils/socket";
import { onMounted } from "vue";
import { RouterView } from "vue-router";

const userStore = useUserStore();
const internalMiscStore = useInternalMiscStore();

onMounted(() => {
    initSocket();
});
setInterval(() => internalMiscStore.updateTime(Date.now()), 1000);
</script>

<template>
    <RouterView v-if="userStore.auth.initialized" />
    <div class="h-full flex items-center justify-center" v-else>
        <spinner class="w-16 h-16" />
    </div>
</template>
<style></style>
