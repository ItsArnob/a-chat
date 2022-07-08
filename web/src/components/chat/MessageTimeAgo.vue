<template>
    <p class='inline-block'>{{ time }}</p>
</template>
<script setup>

import { useInternalMiscStore } from '@/stores/internalMisc';
import { ref } from 'vue';

const props = defineProps(['time']);
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import dayjs from "dayjs";


dayjs.extend(isToday);
dayjs.extend(isYesterday);

const internalMiscStore = useInternalMiscStore();
const time = ref(dayjs(props.time).format(timeFormat()));

internalMiscStore.$onAction(({ after }) => {
    after((timestamp) => {
        time.value = dayjs(props.time).format(timeFormat());
    })
})

function timeFormat () {
    if(dayjs(props.time).isToday()) return 'hh:mm A';
    if(dayjs(props.time).isYesterday()) return '[Yesterday] [at] hh:mm A';
    if(dayjs(props.time).year() === dayjs().year()) return "MMM DD, hh:mm A";
    return "MMM DD, YYYY hh:mm A";
}
</script>