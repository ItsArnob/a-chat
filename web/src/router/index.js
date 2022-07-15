import { useUserStore } from "@/stores/user";
import { createRouter, createWebHistory } from "vue-router";
import { routes } from "./routes";

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

// this is ugly but it works
router.beforeEach(async (to, from, next) => {
    const userStore = useUserStore();
    const isinitialized = new Promise((resolve, reject) => {
        if (userStore.auth.initialized) {
            resolve();
        } else {
            const unwatch = userStore.$subscribe((_, state) => {
                if (state.auth.initialized) {
                    unwatch();
                    resolve();
                }
            });
        }
    });
    await isinitialized;
    if (to.meta.auth && !userStore.auth.user) {
        next({ path: "/" });
    } else next();
});

export default router;
