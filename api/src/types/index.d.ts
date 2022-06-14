import { Account } from "@prisma/client";

declare module 'express' {
    interface Request {
        user: Account
    }
}

declare module 'socket.io' {
    interface Socket {
        user: { id: string }
    }
}