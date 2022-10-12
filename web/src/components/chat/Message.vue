<template>
    <div class="message-wrapper flex flex-col">
        <div
            :class="[
                'flex gap-2 group',
                fromSelf ? 'flex-row-reverse self-end' : 'self-start',
            ]"
        >
            <div class="w-[30px] shrink-0" v-show="!fromSelf">
                <Avatar size="xs" v-if="showAvatar" />
            </div>
            <div
                :class="[
                    'rounded-xl py-2 px-3 message',
                    fromSelf ? 'bg-fuchsia-600' : 'bg-slate-800',
                    fromSelf && error ? 'opacity-70' : '',
                ]"
            >
                <p class="whitespace-pre-wrap overflow-wrap-anywhere text-[15px]">
                    {{ content }}
                </p>
                <div
                    :class="[
                        'text-[13px] text-white/70',
                        fromSelf ? 'text-end' : '',
                    ]"
                >
                    <!-- TODO: make it shorter, currently it looks kinda ugly when date is shown -->
                    <p class="inline-block">{{ formattedTime }}</p>
                    <MessageStatus
                        :from-self="fromSelf"
                        :sending="sending"
                        :error="error"
                    />
                </div>
            </div>
            <div class="w-10 flex-shrink-0 self-center transition duration-100">
                <div
                    :class="[
                        'items-center justify-end',
                        error ? 'flex' : 'hidden group-hover:flex',
                    ]"
                >
                    <button
                        @click="resendMessage"
                        v-if="error"
                        class="w-8 h-8 flex items-center justify-center bg-slate-700 rounded-full text-fuchsias-200 hover:bg-slate-600 transition duration-75"
                    >
                        <RetryIcon :size="25" />
                    </button>
                </div>
            </div>
        </div>
        <div
            v-if="error"
            :class="['text-rose-400', fromSelf ? 'text-right' : '']"
        >
            <font-awesome-icon icon="fa-solid fa-triangle-exclamation" />
            <p class="inline-block ml-2" v-if="error">
                Your message could not be delivered.
            </p>
        </div>
    </div>
</template>
<script setup>
import Avatar from "@/components/user/Avatar.vue";
import MessageStatus from "@/components/chat/MessageStatus.vue";
import { useFormatTime } from "@/composables/FormatTime";
import { useMessagesStore } from "@/stores/messages";
import RetryIcon from "vue-material-design-icons/Refresh.vue";

const props = defineProps([
    "fromSelf",
    "content",
    "time",
    "sending",
    "error",
    "messageId",
    "chatId",
    "showAvatar",
]);

const { formattedTime } = useFormatTime(props.time);
const messagesStore = useMessagesStore();

const resendMessage = () => {
    messagesStore.resendMessage(props.messageId, props.chatId);
};
</script>
<style></style>
