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
    <router-view v-slot="{ Component }">
        <Transition name="fade">
            <component :is="Component" v-if="userStore.auth.initialized" />
            <div
                v-else
                class="fixed w-full h-full flex items-center justify-center"
            >
                <spinner class="w-16 h-16" />
            </div>
        </Transition>
    </router-view>
</template>
<style>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
