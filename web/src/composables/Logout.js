import router from "@/router/index";
import { useChatsStore } from "@/stores/chats";
import { useInternalMiscStore } from "@/stores/internalMisc";
import { useMessagesStore } from "@/stores/messages";
import { useUserStore } from "@/stores/user";
import { clearSocket } from "@/utils/socket";
import axios from "axios";
import { nextTick } from "vue";
import localforage from "localforage";

export const useLogout = () => {
    const userStore = useUserStore();
    const chatsStore = useChatsStore();
    const internalMiscStore = useInternalMiscStore();
    const messagesStore = useMessagesStore();

    const clearStore = () => {
        userStore.$reset();
        chatsStore.$reset();
        internalMiscStore.$reset();
        messagesStore.$reset();
    };
    const logout = async (deleteSession, showLogoutMessage) => {
        const session = await localforage.getItem("session");
        await localforage.removeItem("session");

        await router.push("/");

        clearSocket();
        clearStore();

        if (deleteSession) {
            axios
                .delete(`${import.meta.env.VITE_API_URL}/auth/logout`, {
                    headers: {
                        Authorization: `Bearer ${session?.token}`,
                    },
                })
                .finally(() => {
                    if (showLogoutMessage)
                        sessionStorage.setItem("loggedOut", true);
                    userStore.setUser(null);
                });
        } else {
            if (showLogoutMessage) sessionStorage.setItem("loggedOut", true);
            nextTick(() => userStore.setUser(null));
        }
    };
    return { logout, clearStore };
};
