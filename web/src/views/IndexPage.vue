<template>
    <LoginPage v-if="!userStore.getUser" />
    <template v-else>
        <h1>Click on the hamburger icon and open a chat.</h1>
    </template>
</template>
<script setup>
import { useUserStore } from "@/stores/user";
import LoginPage from "@/views/LoginPage.vue";

const userStore = useUserStore();
</script>
