<template>
    <div class="flex flex-col h-full w-full">
        <div class="h-14 p-2 flex items-center">
            <button
                @click="goHome"
                class="md:hidden mr-2 leading-none text-emerald-600 hover:text-emerald-500 p-1"
            >
                <font-awesome-icon
                    icon="fa-solid fa-arrow-left"
                    class="w-5 h-5"
                />
            </button>
            <h2 class="text-2xl leading-none font-medium">Friends</h2>
        </div>
        <TabGroup>
            <TabList
                class="flex mx-2 space-x-1 rounded-md bg-slate-800 backdrop-blur-sm p-1"
            >
                <Tab v-slot="{ selected }" class="w-full outline-none">
                    <button
                        :class="[
                            'w-full outline-none rounded py-2.5 text-sm font-medium leading-5 text-white',
                            'ring-emerald-500 ring-opacity-60 focus:outline-none focus:ring-2',
                            selected
                                ? 'bg-emerald-600/50 font-semibold'
                                : 'text-white hover:bg-white/[0.12]',
                        ]"
                    >
                        Friends
                    </button>
                </Tab>
                <Tab v-slot="{ selected }" class="w-full outline-none">
                    <button
                        :class="[
                            'w-full outline-none rounded py-2.5 text-sm font-medium leading-5 text-white',
                            'ring-emerald-500 ring-opacity-60 focus:outline-none focus:ring-2',
                            selected
                                ? 'bg-emerald-600/50 font-semibold'
                                : 'text-white hover:bg-white/[0.12]',
                        ]"
                    >
                        Requests
                    </button>
                </Tab>
                <Tab v-slot="{ selected }" class="w-full outline-none">
                    <button
                        :class="[
                            'w-full outline-none rounded py-2.5 text-sm font-medium leading-5 text-white',
                            'ring-emerald-500 ring-opacity-60 focus:outline-none focus:ring-2',
                            selected
                                ? 'bg-emerald-600/50 font-semibold'
                                : 'text-white hover:bg-white/[0.12]',
                        ]"
                    >
                        Add Friend
                    </button>
                </Tab>
            </TabList>
            <TabPanels class="mt-4 text-white mx-2">
                <TabPanel class="focus:outline-none">
                    <FriendUser
                        v-for="friend in userStore.getFriends"
                        :username="friend.username"
                        :online="friend.online"
                        :chat-id="chatsStore.getChatIdOfUserById(friend.id)"
                        :id="friend.id"
                        type="Friend"
                    />
                </TabPanel>
                <TabPanel class="focus:outline-none flex flex-col items-start">
                    <Disclosure
                        default-open
                        as="div"
                        class="mb-2 w-full"
                        v-slot="{ open }"
                    >
                        <DisclosureButton
                            class="w-full text-slate-300 hover:text-white py-2 px-3 hover:bg-slate-800 rounded-md items-center flex"
                        >
                            <font-awesome-icon
                                icon="fa-solid fa-angle-down"
                                class="w-6 h-6 mr-2 transition transform"
                                :class="open ? '' : '-rotate-90'"
                            />
                            <p class="text-sm leading-none">
                                Incoming —
                                {{ userStore.getIncomingRequests.length }}
                            </p>
                        </DisclosureButton>
                        <transition
                            enter-active-class="transition duration-100 ease-out"
                            enter-from-class="transform -translate-y-2 opacity-0"
                            enter-to-class="transform translate-y-0 opacity-100"
                            leave-active-class="transition duration-75 ease-out"
                            leave-from-class="transform translate-y-0 opacity-100"
                            leave-to-class="transform -translate-y-2 opacity-0"
                        >
                            <DisclosurePanel
                                :class="[
                                    'w-full',
                                    userStore.getIncomingRequests.length
                                        ? 'mt-1'
                                        : '',
                                ]"
                            >
                                <FriendUser
                                    v-for="incomingRequest in userStore.getIncomingRequests"
                                    :username="incomingRequest.username"
                                    :id="incomingRequest.id"
                                    type="Incoming"
                                />
                            </DisclosurePanel>
                        </transition>
                    </Disclosure>
                    <Disclosure
                        default-open
                        as="div"
                        class="w-full"
                        v-slot="{ open }"
                    >
                        <DisclosureButton
                            class="text-slate-300 w-full hover:text-white py-2 px-3 hover:bg-slate-800 rounded-md flex items-center"
                        >
                            <font-awesome-icon
                                icon="fa-solid fa-angle-down"
                                class="w-6 h-6 mr-2 transition transform"
                                :class="open ? '' : '-rotate-90'"
                            />
                            <p class="text-sm leading-none">
                                Outgoing —
                                {{ userStore.getOutgoingRequests.length }}
                            </p>
                        </DisclosureButton>
                        <transition
                            enter-active-class="transition duration-100 ease-out"
                            enter-from-class="transform -translate-y-2 opacity-0"
                            enter-to-class="transform translate-y-0 opacity-100"
                            leave-active-class="transition duration-75 ease-out"
                            leave-from-class="transform translate-y-0 opacity-100"
                            leave-to-class="transform -translate-y-2 opacity-0"
                        >
                            <DisclosurePanel
                                :class="[
                                    'w-full',
                                    userStore.getIncomingRequests.length
                                        ? 'mt-1'
                                        : '',
                                ]"
                            >
                                <FriendUser
                                    v-for="incomingRequest in userStore.getOutgoingRequests"
                                    :username="incomingRequest.username"
                                    :id="incomingRequest.id"
                                    type="Outgoing"
                                />
                            </DisclosurePanel>
                        </transition>
                    </Disclosure>
                </TabPanel>
                <TabPanel class="focus:outline-none">
                    <p class="text-slate-300 mb-2">
                        You can add a friend using their username. It's case
                        insensitive.
                    </p>
                    <form @submit.prevent="sendFriendRequest">
                        <div
                            class="w-full flex rounded-md bg-slate-800 focus-within:ring ring-indigo-500"
                        >
                            <input
                                @input="setFriendUsername"
                                :value="friendUsername"
                                :disabled="isRequestSending"
                                class="disabled:opacity-60 w-full py-2 pl-2 outline-none bg-transparent"
                                placeholder="Enter a username"
                            />
                            <button
                                :disabled="
                                    isRequestSending || !friendUsername.trim()
                                "
                                class="disabled:cursor-not-allowed disabled:opacity-70 shrink-0 w-32 h-10 text-center transition flex items-center justify-center leading-none bg-indigo-500 hover:hover:bg-indigo-600 rounded-md m-2"
                            >
                                <Spinner
                                    class="w-6 h-6"
                                    v-if="isRequestSending"
                                />
                                <span v-else>Send Request</span>
                            </button>
                        </div>
                        <p
                            v-if="sendFriendRequestError"
                            class="text-rose-400 mt-2"
                        >
                            {{ sendFriendRequestError }}
                        </p>
                    </form>
                </TabPanel>
            </TabPanels>
        </TabGroup>
    </div>
</template>
<script setup>
import FriendUser from "@/components/Friends/User.vue";
import Spinner from "@/components/icons/Spinner.vue";

import { useChatsStore } from "@/stores/chats";
import { useUserStore } from "@/stores/user";
import {
    Disclosure,
    DisclosureButton,
    DisclosurePanel,
    Tab,
    TabGroup,
    TabList,
    TabPanel,
    TabPanels,
} from "@headlessui/vue";
import { useTitle } from "@vueuse/core";
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";

const router = useRouter();
const userStore = useUserStore();
const chatsStore = useChatsStore();
const toast = useToast();
useTitle("Friends");

const friendUsername = ref("");
const sendFriendRequestError = ref("");
const isRequestSending = ref(false);

const goHome = () => router.push("/");
const sendFriendRequest = async () => {
    isRequestSending.value = true;
    const response = await userStore.sendFriendRequest(
        friendUsername.value.trim()
    );
    isRequestSending.value = false;

    if (response.ok) return toast.success(response.ok);
    sendFriendRequestError.value = response;
};

const setFriendUsername = (e) => {
    friendUsername.value = e.target.value;
    sendFriendRequestError.value = "";
};
</script>
