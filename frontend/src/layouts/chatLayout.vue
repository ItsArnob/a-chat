<template>
    <template v-if="userStore.auth.user">
        <div class="flex h-full">
            <LeftSideBar :force-hide-side-bar="forceHideSideBar" />

            <router-view
                @toggle-side-bar="() => (forceHideSideBar = !forceHideSideBar)"
                :key="$route.params.id"
            >
            </router-view>
        </div>
    </template>
    <RouterView v-else />
</template>

<script setup>
import LeftSideBar from "@/components/LeftSideBar.vue";
import { useUserStore } from "@/stores/user";
import { ref } from "vue";
import { RouterView, useRouter } from "vue-router";

const userStore = useUserStore();

const forceHideSideBar = ref(false);

const router = useRouter();

router.afterEach(() => {
    forceHideSideBar.value = false;
});
</script>
