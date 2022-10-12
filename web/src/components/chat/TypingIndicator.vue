<template>
    <div class="flex gap-2">
        <Avatar size="xs"/>
        <div class="px-2 py-1 rounded-xl bg-slate-800 self-start">
            <TypingIcon size="8px"  :color="colors.slate[400]"/>
        </div>
    </div>
</template>

<script setup>
import TypingIcon from "vue-spinner/src/SyncLoader.vue";
import colors from "tailwindcss/colors";

import Avatar from "@/components/user/Avatar.vue";

</script>
