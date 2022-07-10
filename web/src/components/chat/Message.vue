<template>
    <div class='message-wrapper flex flex-col'>
    <div
        :class="['text-lg rounded-xl py-2 px-3 max-w-[90%] message', fromSelf ? 'self-end bg-indigo-500' : 'self-start bg-slate-800', fromSelf && error ? 'opacity-70' : '']">
        <p class='whitespace-pre-wrap overflow-wrap-anywhere'> {{ content }}</p>
        <div :class='["text-sm text-white/70", fromSelf ? "text-end" : ""]'>
            <!-- TODO: make it shorter, currently it looks kinda ugly when date is shown -->
            <p class='inline-block'> {{ formattedTime }} </p>
            <MessageStatus :from-self='fromSelf' :sending='sending' :error='error'/>
        </div>
    </div>
    <div v-if='error' :class="['text-rose-400',fromSelf ? 'text-right' : '']">
        <font-awesome-icon icon='fa-solid fa-triangle-exclamation'/>
        <p class='inline-block ml-2' v-if='error'>Your message could not be delivered.</p>
    </div>
    </div>
</template>
<script setup>
import MessageStatus from '@/components/chat/MessageStatus.vue';
import { useFormatTime } from '@/composables/FormatTime';

const props = defineProps(['fromSelf', 'content', 'time', 'sending', 'error'])

const { formattedTime } = useFormatTime(props.time);
</script>
<style>

</style>