import '@/assets/tailwind.css';
import { defaultConfig, plugin } from '@formkit/vue';
import { library } from '@fortawesome/fontawesome-svg-core';
import {
    faAddressBook,
    faAngleDown,
    faAngleLeft,
    faBan,
    faBars,
    faCheck,
    faGear,
    faMessage,
    faUserXmark,
    faXmark,
    faCircleNotch,
    faCheckCircle,
    faTriangleExclamation,
    faArrowLeft
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import Toast from 'vue-toastification';
import FloatingVue from 'floating-vue';

import 'vue-toastification/dist/index.css';
import 'floating-vue/dist/style.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);

library.add(
    faAddressBook,
    faGear,
    faBars,
    faAngleLeft,
    faMessage,
    faXmark,
    faCheck,
    faAngleDown,
    faUserXmark,
    faBan,
    faCircleNotch,
    faCheckCircle,
    faTriangleExclamation,
    faArrowLeft
);
app.component('font-awesome-icon', FontAwesomeIcon);

app.use(createPinia());
app.use(router);
app.use(plugin, defaultConfig);
app.use(Toast, {
    position: 'top-center',
    transition: 'Vue-Toastification__fade',
    closeOnClick: true,
    pauseOnFocusLoss: true,
    draggable: true,
    draggablePercent: 0.6,
    showCloseButtonOnHover: false,
    closeButton: 'button',
    icon: true,
    rtl: false,
});
app.use(FloatingVue);
app.mount('#app');
