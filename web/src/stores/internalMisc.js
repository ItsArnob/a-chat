import { defineStore } from 'pinia'

export const useInternalMiscStore = defineStore({
    id: 'internalMisc',
    state: () => ({
        wsNetworkError: false
    }),
    getters: {
       
    },
    actions: {
        setWsNetworkError(error) {
            this.wsNetworkError = error;
        }
    }
})
