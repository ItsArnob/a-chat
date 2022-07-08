<template>
    <RouterLink
        :to="{ name: 'inbox', params: { id: inboxId } }"
        @click="inboxClicked"
        :class="[
            'transition duration-75 p-2 hover:cursor-pointer flex justify-between rounded-md',
            isOpen ? 'md:bg-slate-800' : 'hover:bg-slate-800',
        ]"
    >
        <Avatar
            :online="online"
            avatar="https://static.wikia.nocookie.net/oneshot/images/0/02/Niko.png/"
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
                <BellIcon
                    v-show="hasNewMessages"
                    class="h-5 w-5 shrink-0 text-blue-400"
                />

                <p class="text-base whitespace-nowrap text-gray-300/90 ml-auto">
                    <MessageTimeAgo :time='time' v-if='time'/>

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
import MessageStatus from '@/components/chat/MessageStatus.vue';
import MessageTimeAgo from '@/components/chat/MessageTimeAgo.vue';
import { useUserStore } from '@/stores/user';
import { BellIcon } from '@heroicons/vue/solid';
import { RouterLink } from 'vue-router';

import Avatar from './Avatar.vue';

const emit = defineEmits(['inboxClicked']);
const userStore = useUserStore();

const props = defineProps([
    'name',
    'lastMessageFromSelf',
    'lastMessage',
    'lastMessageError',
    'hasNewMessages',
    'online',
    'inboxId',
    'time',
    'isOpen',
    'lastMessageSending',
]);

const inboxClicked = () => {
    emit('inboxClicked');
};
</script>
