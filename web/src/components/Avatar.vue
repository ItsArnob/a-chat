<template>
    <div class="relative shrink-0">
        <img
            :src="avatar"
            class="rounded-full w-14"
            height="60"
            width="60"
            alt="user avatar"
        />
        <div
            v-show="online"
            :class="[
                'w-4 bg-green-500 h-4 rounded-full ring absolute left-11 top-11',
                hasFocus ? 'ring-slate-800' : 'ring-slate-900',
            ]"
        ></div>
    </div>
</template>
<script setup>
const props = defineProps(['online', 'avatar', 'hasFocus']);
</script>
