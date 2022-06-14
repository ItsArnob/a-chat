import chatLayout from "@/layouts/chatLayout.vue"
import HomeView from '@/views/index.vue'

export const routes = [
    {
        path: '/',
        name: 'homeContainer',
        component: chatLayout,
        children: [
            {
                path: '',
                name: 'home',
                component: HomeView
            },
            {
                path: '/i/:id',
                name: 'inbox',
                component: () => import("@/views/chat/inbox.vue"),
                meta: {
                    auth: true
                }

            },
            {
                path: '/friends',
                name: 'friends',
                component: () => import("@/views/friends/index.vue"),
                meta: {
                    auth: true
                }
            }
        ]
    }
]