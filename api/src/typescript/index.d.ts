import { UserNoProfile } from '@/models/user.model';
declare module 'express' {
    interface Request {
        user: UserNoProfile;
    }
}

declare module 'socket.io' {
    interface Socket {
        user: { id: string };
    }
}
