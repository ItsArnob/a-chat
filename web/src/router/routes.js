import chatLayout from '@/layouts/chatLayout.vue';
import HomeView from '@/views/IndexPage.vue';

export const routes = [
    {
        path: '/',
        name: 'homeContainer',
        component: chatLayout,
        children: [
            {
                path: '',
                name: 'home',
                component: HomeView,
            },
            {
                path: '/i/:id',
                name: 'chat',
                component: () => import('@/views/chat/ChatPage.vue'),
                meta: {
                    auth: true,
                },
            },
            {
                path: '/friends',
                name: 'friends',
                component: () => import('@/views/friends/FriendsPage.vue'),
                meta: {
                    auth: true,
                },
            },
        ],
    },
];
