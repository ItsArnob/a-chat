import { useLogout } from "@/composables/Logout";
import Axios from "axios";

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
        if (error.response.status === 401) {
            console.log(error);
            const { logout } = useLogout();
            await logout();
        }

        return Promise.reject(error);
    }
);
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export { api };
