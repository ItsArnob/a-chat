
<template>
    <LoginForm v-if="!userStore.getUser"/>
    <template v-else>
        <h1>Click on the hamburger icon and open a chat. </h1>
    </template>
</template>
<script setup>
import LoginForm from '@/components/Login.vue';
import { useUserStore } from '@/stores/user';

const userStore = useUserStore();

</script>

