import { useInternalMiscStore } from "@/stores/internalMisc";
import dayjs from "dayjs";
import isToday from "dayjs/plugin/isToday";
import isYesterday from "dayjs/plugin/isYesterday";
import { computed, isRef } from "vue";

dayjs.extend(isToday);
dayjs.extend(isYesterday);

export function useFormatTime(time) {
    const internalMiscStore = useInternalMiscStore();

    const formattedTime = computed(() => {
        const dateChanged = internalMiscStore.lastUpdatedTime;
        if (!time || (isRef(time) && !time.value)) return "";
        return dayjs(isRef(time) ? time.value : time).format(
            timeFormat(isRef(time) ? time.value : time)
        );
    });
    function timeFormat(timeToFormat) {
        if (dayjs(timeToFormat).isToday()) return "hh:mm A";
        if (dayjs(timeToFormat).isYesterday())
            return "[Yesterday] [at] hh:mm A";
        if (dayjs(timeToFormat).year() === dayjs().year())
            return "MMM DD, hh:mm A";
        return "MMM DD, YYYY, hh:mm A";
    }
    return { formattedTime };
}
