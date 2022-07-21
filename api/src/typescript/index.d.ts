import { UserNoProfile } from "@/models/user.model";
import { IncomingMessage } from "http";
import { Request } from 'express';
import { Session, Store } from "express-session";

declare module "express" {
    interface Request {
        user: UserNoProfile;
    }
}

declare module "socket.io" {
    interface Socket {
        user: { id: string };
    }
}


declare module 'express-session' {
    export interface SessionData {
        friendlyName?: string | undefined;
        passport: {
            user: {
                id: string;
            }
        }
    }
}
