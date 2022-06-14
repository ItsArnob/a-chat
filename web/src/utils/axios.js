import Axios from "axios";

const api =  Axios.create({ withCredentials: true, baseURL: import.meta.env.VITE_API_URL })

api.interceptors.response.use((res) => {
    return res;
}, (error) => {
    if(error.response?.data?.message === "Internal server error") {
        error.response.data.message = "Something went wrong, please try again."
    }
    return Promise.reject(error);
})

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export { api };
