import { defineStore } from 'pinia';

export const useInternalMiscStore = defineStore({
    id: 'internalMisc',
    state: () => ({
        wsNetworkError: false,
        time: Date.now()
    }),
    getters: {},
    actions: {
        setWsNetworkError(error) {
            this.wsNetworkError = error;
        },
        updateTime(timestamp) {
            this.time = timestamp;
        }
    },
});
