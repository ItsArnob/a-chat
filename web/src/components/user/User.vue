<template>
    <div
        class="transition duration-75 flex justify-between rounded-md p-2 w-full"
    >
        <Avatar :online="online" :avatar="avatar" />
        <div
            class="ml-3 flex-1 min-w-0 flex flex-col justify-center"
        >
        <div :class="['md:text-lg flex shrink-0']" >
        <span :class="['leading-none',nameEllipsis ? 'text-ellipsis overflow-hidden whitespace-nowrap' : 'break-all']">{{ name }}</span>
                <slot name="content-top-right">
                </slot>
            </div>
            <slot name="description">
            </slot>
        </div>
        <slot name="content-right"></slot>
    </div>
</template>

<script setup>
import Avatar from "@/components/user/Avatar.vue"

const emitProps = defineProps(['online', 'avatar', 'name', 'nameEllipsis'])

</script>