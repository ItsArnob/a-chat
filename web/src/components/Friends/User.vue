<template>
    <div
        class="hover:cursor-pointer flex justify-between hover:bg-slate-800 rounded p-2"
        @click="openInbox"
    >
        <Avatar :online="online" :avatar="avatar" />
        <div
            :class="[
                'ml-3 flex-1 min-w-0 flex flex-col',
                status ? 'justify-evenly' : 'justify-center',
            ]"
        >
            <p class="md:text-xl break-all flex shrink-0 leading-5">
                {{ username }}
            </p>
        </div>
        <div class="ml-auto leading-none flex gap-2 items-center">
            <button
                :disabled="removeFriendLoading"
                v-if="type === 'Friend'"
                class="disabled:cursor-not-allowed transition bg-transparent hover:bg-emerald-800/70 rounded-full p-2 text-emerald-600 hover:text-emerald-400"
            >
                <Spinner v-if="openInboxLoading" class="w-6 h-6" />
                <font-awesome-icon
                    v-else
                    icon="fa-solid fa-message"
                    class="w-6 h-6"
                />
            </button>
            <button
                v-if="type === 'Incoming'"
                :disabled="acceptFriendRequestLoading || removeFriendLoading"
                @click.stop="acceptFriendRequest"
                class="disabled:cursor-not-allowed transition bg-transparent hover:bg-emerald-800/70 rounded-full p-2 text-emerald-600 hover:text-emerald-400"
            >
                <Spinner class="w-6 h-6" v-if="acceptFriendRequestLoading" />
                <font-awesome-icon
                    v-else
                    icon="fa-solid fa-check"
                    class="w-6 h-6"
                />
            </button>
            <button
                @click.stop="deleteFriend"
                :disabled="removeFriendLoading || acceptFriendRequestLoading"
                class="disabled:cursor-not-allowed transition bg-transparent focus:outline-none focus-visible:ring ring-red-400 hover:bg-red-800/40 rounded-full p-2 text-red-500 hover:text-red-400"
            >
                <spinner v-if="removeFriendLoading" class="w-6 h-6" />
                <font-awesome-icon
                    v-else
                    icon="fa-solid fa-xmark"
                    class="w-6 h-6"
                />
            </button>
        </div>
        <TransitionRoot
            appear
            :show="isRemoveConfirmationDialogOpen"
            as="template"
        >
            <Dialog
                as="div"
                @close="closeRemoveConfirmation"
                class="relative z-10"
            >
                <TransitionChild
                    as="template"
                    enter="duration-200 ease-out"
                    enter-from="opacity-0"
                    enter-to="opacity-100"
                    leave="duration-100 ease-in"
                    leave-from="opacity-100"
                    leave-to="opacity-0"
                >
                    <div class="fixed inset-0 bg-black bg-opacity-25" />
                </TransitionChild>

                <div class="fixed inset-0 overflow-y-auto">
                    <div
                        class="flex min-h-full items-center justify-center p-4 text-center"
                    >
                        <TransitionChild
                            as="template"
                            enter="duration-200 ease-out"
                            enter-from="opacity-0 scale-95"
                            enter-to="opacity-100 scale-100"
                            leave="duration-100 ease-in"
                            leave-from="opacity-100 scale-100"
                            leave-to="opacity-0 scale-95"
                        >
                            <DialogPanel
                                class="w-full max-w-md transform overflow-hidden rounded-md bg-gray-700 text-left align-middle shadow-xl transition-all"
                            >
                                <DialogTitle
                                    as="h3"
                                    class="text-xl font-medium leading-6 text-slate-100 px-4 pt-4"
                                >
                                    Remove
                                    <span class="font-semibold"
                                        >'{{ username }}'</span
                                    >?
                                </DialogTitle>
                                <div class="mt-2 px-4">
                                    <p class="leading-snug text-slate-300">
                                        Are you sure you want to remove
                                        <span class="font-bold">{{
                                            username
                                        }}</span>
                                        from your friends? You wont be able to
                                        talk with them until you re-friend them.
                                    </p>
                                </div>

                                <div
                                    class="mt-4 flex gap-3 justify-end bg-gray-800/40 p-2"
                                >
                                    <button
                                        type="button"
                                        :disabled="removeFriendLoading"
                                        class="disabled:cursor-not-allowed disabled:opacity-70 transition py-2 px-4 focus:outline-none rounded-md text-slate-200 hover:bg-gray-600/80 focus-visible:ring ring-indigo-400"
                                        @click="closeRemoveConfirmation"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        :disabled="removeFriendLoading"
                                        class="disabled:cursor-not-allowed disabled:opacity-70 w-24 flex items-center justify-center transition transform p-2 focus:outline-none rounded-md text-slate-200 bg-red-500 hover:bg-red-400 hover:text-white focus-visible:ring ring-red-400"
                                        @click="removeFriend"
                                    >
                                        <Spinner
                                            v-if="removeFriendLoading"
                                            class="w-6 h-6"
                                        />
                                        <span v-else>Remove</span>
                                    </button>
                                </div>
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </TransitionRoot>
    </div>
</template>
<script setup>
import Avatar from '@/components/Avatar.vue';
import Spinner from '@/components/icons/Spinner.vue';
import { useInboxesStore } from '@/stores/inboxes';
import { useUserStore } from '@/stores/user';
import {
    Dialog,
    DialogPanel,
    DialogTitle,
    TransitionChild,
    TransitionRoot,
} from '@headlessui/vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';

const router = useRouter();
const userStore = useUserStore();
const inboxesStore = useInboxesStore();
const toast = useToast();

const acceptFriendRequestLoading = ref(false);
const openInboxLoading = ref(false);
const removeFriendLoading = ref(false);
const isRemoveConfirmationDialogOpen = ref(false);

const props = defineProps([
    'username',
    'avatar',
    'online',
    'id',
    'status',
    'inboxId',
    'type',
]);

function closeRemoveConfirmation() {
    if (!removeFriendLoading.value)
        isRemoveConfirmationDialogOpen.value = false;
}
function openRemoveConfirmation() {
    isRemoveConfirmationDialogOpen.value = true;
}

const openInbox = async () => {
    if (
        removeFriendLoading.value ||
        acceptFriendRequestLoading.value ||
        openInboxLoading.value
    )
        return;
    if (props.inboxId)
        return router.push({ name: 'inbox', params: { id: props.inboxId } });
    if (props.type === 'Friend') {
        openInboxLoading.value = true;
        const response = await inboxesStore.openInbox(props.id);
        openInboxLoading.value = false;
        if (response.ok)
            return router.push({ name: 'inbox', params: { id: response.ok } });
        else toast.error(response);
    }
};
const removeFriend = async () => {
    removeFriendLoading.value = true;
    const response = await userStore.removeOrDeclineFriendRequest(props.id);
    removeFriendLoading.value = false;
    if (response.ok) {
        toast.success(response.ok);
    } else toast.error(response);
};
const deleteFriend = async () => {
    if (props.type === 'Friend') return openRemoveConfirmation();
    await removeFriend();
};
const acceptFriendRequest = async () => {
    acceptFriendRequestLoading.value = true;
    userStore
        .acceptFriendRequest(props.id)
        .then((msg) => {
            if (msg.ok) toast.success(msg.ok);
            else toast.error(msg);
        })
        .finally(() => (acceptFriendRequestLoading.value = false));
};
</script>
