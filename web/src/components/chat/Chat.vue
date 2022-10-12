<template>
    <RouterLink
        :to="{ name: 'chat', params: { id: chatId } }"
        @click="chatClicked"
    >
        <User
            :name="name"
            :online="online"
            :class="[ 'hover:cursor-pointer', isOpen ? 'md:bg-slate-700/60' : 'hover:bg-slate-800' ]"
            :nameEllipsis="true"
        >
            <template #content-top-right>
                <p class="text-sm whitespace-nowrap text-gray-300/90 ml-auto">{{ formattedTime }}</p>
            </template>
            <template #description>
                <div class="flex text-sm">
                    <p
                        class="text-ellipsis overflow-hidden whitespace-nowrap text-gray-300/90"
                    >
                        <span class="font-medium"> {{ lastMessageFromSelf ? "You:" : "" }} </span> {{ lastMessage }}
                    </p>
                    <div class="ml-auto text-gray-300/90">
                        <MessageStatus
                        :from-self="lastMessageFromSelf"
                        :sending="lastMessageSending"
                        :error="lastMessageError"
                        />
                    </div>
                </div>
            </template>
        </User>
    </RouterLink>
</template>

<script setup>
import User from "@/components/user/User.vue";
import MessageStatus from "@/components/chat/MessageStatus.vue";
import { useFormatTime } from "@/composables/FormatTime";
import { useUserStore } from "@/stores/user";
import { computed } from "vue";
import { RouterLink } from "vue-router";

const emit = defineEmits(["chatClicked"]);
const userStore = useUserStore();

const props = defineProps([
    "name",
    "lastMessageFromSelf",
    "lastMessage",
    "lastMessageError",
    "hasNewMessages",
    "online",
    "chatId",
    "time",
    "isOpen",
    "lastMessageSending",
]);
const { formattedTime } = useFormatTime(computed(() => props.time));

const chatClicked = () => {
    emit("chatClicked");
};
</script>
