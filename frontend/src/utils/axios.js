import { useLogout } from "@/composables/Logout";
import Axios from "axios";
import localforage from "localforage";

const api = Axios.create({
    withCredentials: true,
    baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.response.use(
    (res) => {
        return res;
    },
    async (error) => {
        if (error.response?.data?.message === "Internal server error") {
            error.response.data.message =
                "Something went wrong, please try again.";
        }
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (res) => {
        return res;
    },
    async (error) => {
        if (error.response?.status === 401) {
            console.log(error);
            const { logout } = useLogout();
            await logout(false, true);
        }

        return Promise.reject(error);
    }
);
api.interceptors.request.use(async (config) => {
    const session = await localforage.getItem("session");
    if (session) {
        config.headers.Authorization = `Bearer ${session?.token}`;
    }
    return config;
});

if (import.meta.env.DEV) {
    window.api = api;
}
export { api };
