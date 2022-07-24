import { UserNoProfile } from "@/models/user.model";
import { Request } from "express";

declare module "express" {
    interface Request {
        user: UserNoProfile & {
            sessionName?: string | undefined;
            sessionId: string;
        };
    }
}

declare module "socket.io" {
    interface Socket {
        user: { id: string };
    }
}
