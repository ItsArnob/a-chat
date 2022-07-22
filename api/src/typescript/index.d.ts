import { UserNoProfile } from "@/models/user.model";
import { IncomingMessage } from "http";
import { Request } from 'express';
import { Session, Store } from "express-session";

declare module "express" {
    interface Request {
        user: UserNoProfile & { 
            sessionName?: string | undefined
            sessionId: string;
        };
        
    }
}

declare module "socket.io" {
    interface Socket {
        user: { id: string };
    }
}