<template>
    <button class="text-emerald-600 hover:text-emerald-500" @click="() => logout(true)">
        <font-awesome-icon
            icon="fa-solid fa-arrow-right-from-bracket"
            class="w-7 h-7"
        />
    </button>
</template>

<script setup>
import { useLogout } from "@/composables/Logout";

const { logout } = useLogout();
</script>
