import router from "@/router/index";
import { useChatsStore } from "@/stores/chats";
import { useInternalMiscStore } from "@/stores/internalMisc";
import { useMessagesStore } from "@/stores/messages";
import { useUserStore } from "@/stores/user";
import { clearSocket } from "@/utils/socket";
import axios from "axios";
import { nextTick } from "vue";

export const useLogout = () => {
    const userStore = useUserStore();
    const chatsStore = useChatsStore();
    const internalMiscStore = useInternalMiscStore();
    const messagesStore = useMessagesStore();

    const clearStore = () => {
        chatsStore.$reset();
        internalMiscStore.$reset();
        messagesStore.$reset();
        userStore.$reset();
    };
    const logout = (deleteSession) => {
        const token = localStorage.getItem("token");
        localStorage.removeItem("token");

        router.push("/");

        clearSocket();
        clearStore();

        if (deleteSession) {
            axios
                .delete(`${ import.meta.env.VITE_API_URL }/auth/logout`, {
                    headers: {
                        Authorization: `Bearer ${ token }`
                    }
                })
                .finally(() => {
                    localStorage.setItem("loggedOut", true);
                    userStore.setUser(null);
                });
        } else {

            nextTick(() => userStore.setUser(null));
        }
    };
    return { logout, clearStore };
};
