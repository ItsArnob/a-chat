import { api } from '@/utils/axios';
import { initSocket } from '@/utils/socket';
import { defineStore } from 'pinia';

export const useUserStore = defineStore({
    id: 'user',
    state: () => ({
        auth: {
            user: null,
            initialized: false,
        },
        users: [],
    }),
    getters: {
        getUser: (state) => state.auth.user,
        getUserById: (state) => (userId) =>
            state.users.find((user) => user.id === userId),
        canSendMessageToUser() {
            return (userId) =>
                this.getUserById(userId)?.relationship === 'Friend';
        },
        getFriends: (state) =>
            state.users
                ?.filter((user) => user.relationship === 'Friend')
                .sort(new Intl.Collator().compare),
        getIncomingRequests: (state) =>
            state.users
                .filter((user) => user.relationship === 'Incoming')
                .sort(new Intl.Collator().compare),
        getOutgoingRequests: (state) =>
            state.users
                .filter((user) => user.relationship === 'Outgoing')
                .sort(new Intl.Collator().compare),
    },
    actions: {
        async login(username, password) {
            return api
                .post('/auth/login', { username, password })
                .then((res) => {
                    localStorage.setItem('token', res.data.token);
                    initSocket();

                    const { users, ...user } = res.data;
                    this.initData({ users, user });
                    return { ok: true };
                })
                .catch((e) => {
                    return e.response?.data?.message || e.message;
                });
        },
        setUser(user) {
            this.auth.user = user;
            this.auth.initialized = true;
        },
        setUsers(users) {
            this.users = users;
        },
        initData({ users, user }) {
            this.setUsers(users);
            this.setUser(user);
        },
        async acceptFriendRequest(id) {
            return api
                .put(`/users/${id}/friend?type=id`)
                .then((res) => {
                    if (res.data.message === 'Friend request accepted.') {
                        this.setUserRelatedToFriend(id);
                    } else if (res.data.message === 'Friend request sent.') {
                        // gonna deal with that 0.000000000000001% that this ever SOMEHOW happens.
                        this.setUserRelatedToOutgoingOrAddUser(
                            id,
                            res.data.user.username
                        );
                    }
                    return { ok: res.data.message };
                })
                .catch((e) => {
                    return e.response?.data?.message || e.message;
                });
        },
        sendFriendRequest: async function (username) {
            return api
                .put(`/users/${username}/friend`)
                .then((res) => {
                    if (res.data.message === 'Friend request sent.') {
                        this.setUserRelatedToOutgoingOrAddUser(
                            res.data.user.id,
                            res.data.user.username
                        );
                    } else if (
                        res.data.message === 'Friend request accepted.'
                    ) {
                        this.setUserRelatedToFriend(res.data.user.id);
                    }
                    return { ok: res.data.message };
                })
                .catch((e) => {
                    return e.response?.data?.message || e.message;
                });
        },
        removeOrDeclineFriendRequest(id) {
            return api
                .delete(`/users/${id}/friend`)
                .then((res) => {
                    this.setUserRelationToNone(id);
                    return { ok: res.data.message };
                })
                .catch((e) => {
                    return e.response?.data?.message || e.message;
                });
        },
        updateUser({ id: userId, ...user }) {
            const userIndex = this.users.findIndex((u) => u.id === userId);
            if (userIndex > -1) {
                this.users[userIndex] = { ...this.users[userIndex], ...user };
            } else {
                this.users.push({ id: userId, ...user });
            }
        },
        setUserRelatedToOutgoingOrAddUser(id, username) {
            const userExists = !!this.users.find((user) => user.id === id);
            if (userExists) {
                this.users = this.users.map((user) => {
                    if (user.id === id) {
                        user.relationship = 'Outgoing';
                    }
                    return user;
                });
            } else {
                this.users.push({
                    id: id,
                    username: username,
                    relationship: 'Outgoing',
                });
            }
        },
        setUserRelatedToIncomingOrAddUser(id, username) {
            const userExists = !!this.users.find((user) => user.id === id);
            if (userExists) {
                this.users = this.users.map((user) => {
                    if (user.id === id) {
                        user.relationship = 'Incoming';
                    }
                    return user;
                });
            } else {
                this.users.push({
                    id: id,
                    username: username,
                    relationship: 'Incoming',
                });
            }
        },
        setUserRelatedToFriend(id) {
            this.users = this.users.map((user) => {
                if (user.id === id) {
                    user.relationship = 'Friend';
                }
                return user;
            });
        },
        setUserRelationToNone(id) {
            this.users = this.users.map((user) => {
                if (user.id === id) {
                    user.relationship = 'None';
                }
                return user;
            });
        },
        clearData() {
            this.setUser(null);
            this.setUsers([]);
        },
    },
});
