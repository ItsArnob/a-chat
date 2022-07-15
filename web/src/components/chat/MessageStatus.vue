<template>
    <font-awesome-icon
        v-if="sending && fromSelf && !error"
        icon="fa-solid fa-circle-notch"
        class="ml-2 animate-spin"
    />
    <font-awesome-icon
        v-else-if="!sending && fromSelf && !error"
        icon="fa-solid fa-check-circle"
        class="ml-2"
    />
    <font-awesome-icon
        icon="fa-solid fa-triangle-exclamation"
        class="text-orange-300 ml-2"
        v-else-if="fromSelf && error"
    />
</template>
<script setup>
const props = defineProps(["sending", "fromSelf", "error"]);
</script>
