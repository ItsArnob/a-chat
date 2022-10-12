<template>
    <div class="h-full w-full flex">
        <div class="m-auto w-[400px] p-2">
            <p class="text-rose-400" v-if="isLoggedOut">
                You've been logged out.
            </p>
            <TabGroup @change="changeTab">
                <TabList
                    class="flex space-x-1 rounded-md bg-slate-800 backdrop-blur-sm p-1"
                >
                    <Tab v-slot="{ selected }" class="w-full outline-none">
                        <button
                            :class="[
                                'w-full outline-none rounded py-2.5 text-sm font-medium leading-5 text-white',
                                'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                                selected
                                    ? 'bg-white/20 shadow font-semibold'
                                    : 'text-white hover:bg-white/[0.12]',
                            ]"
                        >
                            Log In
                        </button>
                    </Tab>
                    <Tab v-slot="{ selected }" class="w-full outline-none">
                        <button
                            :class="[
                                'w-full outline-none rounded py-2.5 text-sm font-medium leading-5 text-white',
                                'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                                selected
                                    ? 'bg-white/30 shadow font-semibold'
                                    : 'text-white hover:bg-white/[0.12]',
                            ]"
                        >
                            Create An Account
                        </button>
                    </Tab>
                </TabList>
                <TabPanels class="mt-6 mx-2 text-white">
                    <TabPanel>
                        <FormKit
                            id="loginForm"
                            type="form"
                            :actions="false"
                            @submit="login"
                            message-class="text-rose-400"
                        >
                            <LoginOrSignupInputs
                                :is-form-submitting="isFormSubmitting"
                            />
                        </FormKit>
                    </TabPanel>
                    <TabPanel>
                        <div
                            class="text-lg text-green-400"
                            v-if="isAccountCreated"
                        >
                            <p class="text-center">
                                Your account has been created! login using your
                                username and password to get started.
                            </p>
                        </div>
                        <FormKit
                            v-else
                            id="signupForm"
                            type="form"
                            :actions="false"
                            @submit="createAccount"
                            message-class="text-rose-400"
                        >
                            <LoginOrSignupInputs
                                sign-up="true"
                                :is-form-submitting="isFormSubmitting"
                            />
                        </FormKit>
                    </TabPanel>
                </TabPanels>
            </TabGroup>
        </div>
    </div>
</template>
<script setup>
import LoginOrSignupInputs from "@/components/LoginOrSignupInputs.vue";
import { useUserStore } from "@/stores/user";
import { clearErrors, FormKit, setErrors } from "@formkit/vue";
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/vue";
import { useTitle } from "@vueuse/core";
import { computed, onMounted, ref } from "vue";

const isFormSubmitting = ref(false);
const isLoggedOut = ref(false);
const isAccountCreated = ref(false);
const isSignupFormOpen = ref(false);

const userStore = useUserStore();
useTitle(
    computed(() => (isSignupFormOpen.value ? "Create an account" : "Log In"))
);

async function login(credentials) {
    isFormSubmitting.value = true;
    clearErrors("loginForm");

    userStore
        .login(credentials.username, credentials.password)
        .then((message) => {
            if (!message.ok) setErrors("loginForm", [`${message}`]);
        })
        .finally(() => {
            isFormSubmitting.value = false;
        });
}
async function createAccount(credentials) {
    isFormSubmitting.value = true;
    clearErrors("signupForm");
    userStore
        .createAccount(credentials.username, credentials.password)
        .then((message) => {
            if (!message.ok) {
                if (message.toLowerCase().includes("username")) {
                    setErrors("signupForm", [], { username: message });
                } else setErrors("signupForm", [`${message}`]);
            } else {
                isAccountCreated.value = true;
            }
        })
        .finally(() => {
            isFormSubmitting.value = false;
        });
}

const changeTab = (index) => {
    if (index === 1) isSignupFormOpen.value = true;
    else isSignupFormOpen.value = false;
    isAccountCreated.value = false;
};

onMounted(() => {
    if (sessionStorage.getItem("loggedOut")) {
        isLoggedOut.value = true;
        sessionStorage.removeItem("loggedOut");
    }
});
</script>
