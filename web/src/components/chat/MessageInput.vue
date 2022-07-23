<template>
    <div class="w-full bg-slate-900 flex flex-col shrink-0 min-h-[3.5rem]">
        <div class="flex w-full p-2">
            <button
                class="self-end bg-gray-800 p-2 rounded-full mr-2 mb-[0.10rem] hover:bg-gray-600"
            >
                <UploadIcon class="h-5 w-5" />
            </button>
            <textarea
                ref="textarea"
                :value="message"
                rows="1"
                @input="handleInputTextarea"
                @keydown="shouldSubmit"
                class="max-h-[208px] bg-gray-800 resize-none outline-none p-2 rounded w-full"
                placeholder="Say something!"
            />
            <button
                @click="submitMessage"
                :disabled="!canSubmit"
                :class="[
                    'self-end p-2 rounded-full ml-2 mb-[0.10rem]',
                    canSubmit
                        ? 'bg-indigo-500 hover:bg-indigo-400'
                        : 'bg-gray-800 hover:bg-gray-600',
                ]"
            >
                <ChevronRightIcon class="h-5 w-5" />
            </button>
        </div>
    </div>
</template>
<script setup>
import { useMessagesStore } from "@/stores/messages";
import { ChevronRightIcon, UploadIcon } from "@heroicons/vue/outline";
import { onStartTyping } from "@vueuse/core";
import { computed, defineEmits, nextTick, ref } from "vue";

const props = defineProps(["chatId"]);
const textarea = ref();
const message = ref("");

const canSubmit = computed(() => !!message.value.trim());

const messagesStore = useMessagesStore();

const emit = defineEmits(["scrollToBottom"]);

const resizeTextArea = () => {
    textarea.value.style.height = "auto";
    textarea.value.style.height = `${textarea.value.scrollHeight}px`;
};
const shouldSubmit = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        message.value.trim() && submitMessage();
    }
};
const handleInputTextarea = (ev) => {
    resizeTextArea();
    message.value = ev.target.value;
};
const submitMessage = async () => {
    const messageCloned = message.value.trim();
    message.value = "";
    textarea.value.focus();
    const ackId = messagesStore.appendSelfMessage(props.chatId, messageCloned);
    await nextTick(() => emit("scrollToBottom"));
    await nextTick(resizeTextArea);
    messagesStore.saveMessage(props.chatId, ackId, messageCloned);
};

onStartTyping(() => {
    if (!textarea.value.active) textarea.value.focus();
});
</script>
