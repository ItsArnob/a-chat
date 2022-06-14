<template>

<div class="w-full bg-slate-900 flex flex-col shrink-0 min-h-[3.5rem]">
       
        <div class="flex w-full p-2">
            <button class="self-end bg-gray-800 p-2 rounded-full mr-2 mb-[0.10rem] hover:bg-gray-600">
                <UploadIcon class="h-5 w-5" />
            </button>
            <textarea ref="textarea" v-model="message" rows="1" @input="resizeTextArea" @keydown="shouldSubmit" class="max-h-[208px] bg-gray-800 resize-none outline-none p-2 rounded w-full" placeholder="Say something!" />
            <button data-onClick="{submitMessage}" data-disabled="{!message.trim()}" class="self-end bg-gray-800 p-2 rounded-full ml-2 mb-[0.10rem] hover:bg-gray-600 ${message.trim() && 'bg-rose-500 hover:bg-rose-400'}">
                <ChevronRightIcon class="h-5 w-5" />
            </button>
        </div>
    </div>

</template>
<script setup>
import { ChevronRightIcon, UploadIcon } from "@heroicons/vue/outline";
import { defineEmits, nextTick, ref } from "vue";


const textarea = ref(); 
const message = ref();

const emit = defineEmits(["scrollToBottom"])

const resizeTextArea = () => {
    textarea.value.style.height = "auto";
    textarea.value.style.height = `${textarea.value.scrollHeight}px`;   
}
const shouldSubmit = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        message.value.trim() && submitMessage();
    }
}
const submitMessage = () => {

    console.log(message.value)
    message.value = "";
    emit("scrollToBottom");
    nextTick(resizeTextArea);
}
</script>