<template>
    <LoginPage v-if="!userStore.getUser" />
    <template v-else>
        <h1>Click on the hamburger icon and open a chat.</h1>
    </template>
</template>
<script setup>
import { useUserStore } from "@/stores/user";
import LoginPage from "@/views/LoginPage.vue";
import { useTitle } from "@vueuse/core";
import { computed } from "vue";

const userStore = useUserStore();
useTitle(computed(() => (userStore.getUser ? "Home" : "Log In")));
</script>
