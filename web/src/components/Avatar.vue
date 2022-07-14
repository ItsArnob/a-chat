<template>
    <div class="relative shrink-0" v-if='!invisible'>
        <img
            :src="avatar"
            class="rounded-full"
            :height="sizePx"
            :width="sizePx"
            alt="user avatar"
        />
        <div
            v-show="online && typeof online !== 'string'"
            :class="[
                'bg-green-500 rounded-full ring absolute',
                hasFocus ? 'ring-slate-800' : 'ring-slate-900',
                onlineStatusClasses
            ]"
        ></div>
    </div>
    <div v-else :class='invisibleClass'></div>
</template>
<script setup>
import { computed } from 'vue';

const props = defineProps(['online', 'avatar', 'hasFocus', 'size', 'invisible']);

const invisibleClass = computed(() => {
    if(props.size === 'xs') {
        return 'w-[35px]'
    }
    else if(props.size === 'sm') {
        return 'w-[40px]'
    } else if(props.size === 'lg') {
        return 'w-[100px]'
    } else return 'w-[58]'

})
const sizePx = computed(() => {
    if(props.size === 'xs') {
        return '35'
    }
    else if(props.size === 'sm') {
        return '40'
    } else if(props.size === 'lg') {
        return '100'
    } else return '58'
})
const onlineStatusClasses = computed(() => {
    if(props.size === 'xs') return; // note: too small, online status probably wouldn't look good on this size.
    else if(props.size === 'sm') {
      return 'left-7 top-8 w-3 h-3'
    } else if(props.size === 'lg') {
        return 'w-6 h-6 left-[4.5rem] top-20'
    }
    return 'left-11 top-11 w-4 h-4'
})
</script>
