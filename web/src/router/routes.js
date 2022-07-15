import chatLayout from "@/layouts/chatLayout.vue";
import ChatPage from "@/views/chat/ChatPage.vue";
import FriendsPage from "@/views/friends/FriendsPage.vue";
import HomeView from "@/views/IndexPage.vue";

export const routes = [
    {
        path: "/",
        name: "homeContainer",
        component: chatLayout,
        children: [
            {
                path: "",
                name: "home",
                component: HomeView,
            },
            {
                path: "/i/:id",
                name: "chat",
                component: ChatPage,
                meta: {
                    auth: true,
                },
            },
            {
                path: "/friends",
                name: "friends",
                component: FriendsPage,
                meta: {
                    auth: true,
                },
            },
        ],
    },
];
