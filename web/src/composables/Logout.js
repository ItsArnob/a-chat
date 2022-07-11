import { useChatsStore } from '@/stores/chats';
import { useInternalMiscStore } from '@/stores/internalMisc';
import { useMessagesStore } from '@/stores/messages';
import { useUserStore } from '@/stores/user';
import axios from 'axios';
import { clearSocket } from '@/utils/socket';
import router from '@/router/index'

export const useLogout = () => {

    const userStore = useUserStore();
    const chatsStore = useChatsStore();
    const internalMiscStore = useInternalMiscStore();
    const messagesStore = useMessagesStore();

    const logout = async () => {
        const token = localStorage.getItem('token');
        localStorage.removeItem('token');
        await router.push('/');
        clearSocket();
        chatsStore.$reset();
        internalMiscStore.$reset();
        messagesStore.$reset();
        userStore.$reset();

        axios.delete(`${import.meta.env.VITE_API_URL}/auth/logout`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }).finally(() => {
            localStorage.setItem("loggedOut", true);
            userStore.setUser(null);

        })
    };
    return { logout }
}