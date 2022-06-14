
<template>
    <div :class="['bg-slate-800 p-2 rounded mb-2 break-words', status === 'sending' ? 'opacity-80' : '']">
        <div>
            <span class="font-semibold text-lg text-rose-500">{{ username }}</span>
            <span class="ml-2 text-sm text-slate-300">{{ time }}</span>
            <span class='text-slate-300 text-sm italic'> {{ status === "sending" ? '(sending)' : '' }}</span>
        </div>
        <div class="text-white whitespace-pre-wrap">
            {{ message }}
        </div>

    </div>
</template>

<script setup>
import { computed, defineProps } from 'vue';

const props = defineProps(['messageId', 'message', 'username', 'date', 'status']);

function getOrdialDay(dt) {
        return dt + (dt % 10 == 1 && dt != 11 ? 'st' : (dt % 10 == 2 && dt != 12 ? 'nd' : (dt % 10 == 3 && dt != 13 ? 'rd' : 'th')));
    }
const time = computed(() => {

    const msgDate = new Date(props.date);
    const now = new Date();
    const hour12Time = msgDate.toLocaleString('default', { minute: 'numeric', second: 'numeric',hour: 'numeric', hour12: true })
    return now.getDate() === msgDate.getDate() 
        ? `Today at ${hour12Time}` 
        : now.getDate() - 1 === msgDate.getDate() 
            ? `Yesterday at ${hour12Time}` 
            : `${msgDate.toLocaleString('default', { month: 'short' })} ${getOrdialDay(msgDate.getDate())} ${msgDate.getFullYear()}`;


})
</script>