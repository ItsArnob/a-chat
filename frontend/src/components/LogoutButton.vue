<template>
    <button
        class="text-emerald-600 hover:text-emerald-500"
        @click="() => logout(true, true)"
    >
        <font-awesome-icon
            icon="fa-solid fa-arrow-right-from-bracket"
            class="w-6 h-6"
        />
    </button>
</template>

<script setup>
import { useLogout } from "@/composables/Logout";

const { logout } = useLogout();
</script>
