import dayjs from "dayjs";
import { defineStore } from "pinia";

export const useInternalMiscStore = defineStore({
    id: "internalMisc",
    state: () => ({
        wsNetworkError: false,
        lastUpdatedTime: dayjs().format("MMM DD, YYYY"),
    }),
    getters: {},
    actions: {
        setWsNetworkError(error) {
            this.wsNetworkError = error;
        },
        updateTime(timestamp) {
            /**
             * only update when the date changes.
             * e.g. from 12th to 13th or if you were to
             * time travel to the past from 13th to 12th etc.
             * this should prevent unnecessary update to components.
             */

            if (!dayjs().isSame(dayjs(this.lastUpdatedTime), "day")) {
                this.lastUpdatedTime = dayjs().format("MMM DD, YYYY");
            }
        },
    },
});
