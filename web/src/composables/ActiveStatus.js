import { useInternalMiscStore } from "@/stores/internalMisc";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { computed } from "vue";

dayjs.extend(relativeTime);

export function useActiveStatusRef(onlineStatus) {
    const internalMiscStore = useInternalMiscStore();
    const activeStatus = computed(() => {
        const timestamp = internalMiscStore.time; // just so it updates every second, probably not a good idea but eh, it works!
        if (onlineStatus.value === true) return "Active now";
        if (typeof onlineStatus.value === "string")
            return `Active ${dayjs(onlineStatus.value).fromNow()}`;
    });

    return { activeStatus };
}
