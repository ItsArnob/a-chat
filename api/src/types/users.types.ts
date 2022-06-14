import { ObjectId } from "mongodb";

export enum Relationship {
    FRIEND = 'Friend',
    BLOCKED = 'Blocked',
    INCOMING = "Incoming",
    OUTGOING = "Outgoing",
    BLOCKEDBY = "BlockedBy"

}
export interface IRelation {
    id: ObjectId;
    status: Relationship;
}
export interface IUserBase {
    id: string;
    username: string;
    isOwner: boolean | null;
    relations: IRelation[]
}