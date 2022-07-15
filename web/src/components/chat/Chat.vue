<template>
    <RouterLink
        :to="{ name: 'chat', params: { id: chatId } }"
        @click="chatClicked"
        :class="[
            'transition duration-75 p-2 hover:cursor-pointer flex justify-between rounded-md',
            isOpen ? 'md:bg-slate-800' : 'hover:bg-slate-800',
        ]"
    >
        <Avatar
            :online="online"
            :has-focus="isOpen"
        />

        <div
            :class="[
                'ml-3 flex-1 min-w-0 flex flex-col',
                lastMessage ? 'justify-evenly' : 'justify-center',
            ]"
        >
            <div class="md:text-xl break-all flex shrink-0 leading-5">
                {{ name }}
                <!-- TODO: use a different icon -->
                <BellIcon
                    v-show="hasNewMessages"
                    class="h-5 w-5 shrink-0 text-blue-400"
                />

                <p class="text-base whitespace-nowrap text-gray-300/90 ml-auto">
                    <p>{{ formattedTime }} </p>
                </p>

            </div>
            <div class="flex">
                <p
                    :class="[
                        'text-ellipsis overflow-hidden whitespace-nowrap text-gray-300/90',
                    ]"
                >
                    {{ lastMessageFromSelf ? 'You:' : '' }} {{ lastMessage }}
                </p>
                <div class='ml-auto text-gray-300/90'>
                    <MessageStatus :from-self='lastMessageFromSelf' :sending='lastMessageSending' :error='lastMessageError'/>
                </div>
            </div>
        </div>
    </RouterLink>
</template>

<script setup>
import Avatar from '@/components/Avatar.vue';
import MessageStatus from '@/components/chat/MessageStatus.vue';
import { useFormatTime } from '@/composables/FormatTime';
import { useUserStore } from '@/stores/user';
import { BellIcon } from '@heroicons/vue/solid';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const emit = defineEmits(['chatClicked']);
const userStore = useUserStore();

const props = defineProps([
    'name',
    'lastMessageFromSelf',
    'lastMessage',
    'lastMessageError',
    'hasNewMessages',
    'online',
    'chatId',
    'time',
    'isOpen',
    'lastMessageSending',
]);
const { formattedTime } = useFormatTime(computed(() => props.time));

const chatClicked = () => {
    emit('chatClicked');
};
</script>
