<template>
    <FormKit
        type="text"
        name="username"
        label="Username"
        validation="required:trim|matches:/^[a-zA-Z_0-9\-]*$/|length:3,30"
        :validation-messages="{
            matches:
                'Username can only contain english letters, numbers, hyphens and underscores.',
        }"
        help="Enter your username"
        label-class="text-lg"
        input-class="w-full p-2 transition rounded outline-none bg-slate-800 focus:ring-2 focus:ring-indigo-400"
        message-class="text-rose-400"
        help-class="text-gray-400"
    />
    <FormKit
        :type="showPassword ? 'text' : 'password'"
        name="password"
        label="Password"
        validation="required:trim|matches:/^[\w&.\-!?@#$%^&*]*$/|length:8,72"
        :validation-messages="{
            matches:
                'Password can only english contain letters, numbers and some special characters (i.e. &.-!?@#$%^&*).',
        }"
        help="Enter your password"
        wrapper-class="mt-2"
        label-class="text-lg"
        input-class="w-full p-2 rounded outline-none bg-slate-800 transition focus:ring-2 focus:ring-indigo-400"
        message-class="text-rose-400"
        help-class="text-gray-400"
    >
        <template #suffix="context">
            <button
                @click="showPassword = !showPassword"
                type="button"
                class="text-indigo-300 p-2 bg-slate-800 rounded ml-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 hover:bg-slate-700 transition"
            >
                <EyeOffIcon v-if="showPassword" class="w-6 h-6" />
                <EyeIcon v-else class="w-6 h-6" />
            </button>
        </template>
    </FormKit>
    <FormKit
        v-if="signUp"
        :type="showConfirmPassword ? 'text' : 'password'"
        name="password_confirm"
        label="Confirm password"
        validation="required|confirm"
        validation-label="Confirmation"
        help="Re-enter your password"
        wrapper-class="mt-2"
        label-class="text-lg"
        input-class="w-full p-2 transition rounded outline-none bg-slate-800 focus:ring-2 focus:ring-indigo-400"
        message-class="text-rose-400"
        help-class="text-gray-400"
    >
        <template #suffix="context">
            <button
                @click="showConfirmPassword = !showConfirmPassword"
                type="button"
                class="text-indigo-300 p-2 bg-slate-800 rounded ml-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 hover:bg-slate-700 transition"
            >
                <EyeOffIcon v-if="showConfirmPassword" class="w-6 h-6" />
                <EyeIcon v-else class="w-6 h-6" />
            </button>
        </template>
    </FormKit>
    <FormKit
        type="submit"
        :disabled="isFormSubmitting"
        wrapper-class="mt-4 w-full text-center bg-indigo-600 rounded hover:bg-indigo-500 transition"
        input-class="font-semibold p-2 w-full outline-none focus:ring-2 rounded focus:ring-indigo-400"
    >
        <p v-if="isFormSubmitting && !signUp">Logging In...</p>
        <p v-else-if="isFormSubmitting && signUp">Creating account...</p>
        <p v-else-if="signUp">Create Account</p>
        <p v-else>Log in</p>
    </FormKit>
</template>
<script setup>
import { FormKit } from "@formkit/vue";
import { EyeIcon, EyeOffIcon } from "@heroicons/vue/solid";
import { ref } from "vue";

const props = defineProps(["signUp", "isFormSubmitting"]);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
</script>
<style>
.formkit-inner {
    display: flex;
}
</style>
