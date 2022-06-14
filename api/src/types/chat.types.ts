import { RelationStatus } from "@prisma/client";

export interface IUserForUser {
    id: string;
    username: string;
    online: boolean;
    relationship: RelationStatus;
}
export interface IUserInitData {
    id: string;
    username: string;
    isOwner: boolean;
    users: IUserForUser[]
}