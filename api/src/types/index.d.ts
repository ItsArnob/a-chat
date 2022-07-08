import { UserNoProfileWithId } from '@/models/user.model';
import { Account } from '@prisma/client';
import { ObjectId } from 'mongodb';

declare module 'express' {
    interface Request {
        user: UserNoProfileWithId;
    }
}

declare module 'socket.io' {
    interface Socket {
        user: { id: ObjectId };
    }
}
