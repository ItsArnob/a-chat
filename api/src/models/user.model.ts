import { ObjectId, WithId } from 'mongodb';

export interface User {
    id: ObjectId
    username: string
    passwordHash: string
    token?: string | null
    profile?: {
        relations?: Relation[]
    } | null
};
export interface UserDoc extends Omit<User, 'id'> {};

export interface UserNoProfile extends Omit<User, 'profile'> {}
export interface UserNoProfileDoc extends WithId<Omit<UserNoProfile, 'id'>> {};

export interface UserRelation extends Relation {};


export const userNoProfileProjection = {
    _id: 1,
    username: 1,
    passwordHash: 1,
    token: 1,
}

export const userProjection = {
    ...userNoProfileProjection,
    profile: 1
}

export const userRelationsProjection = {
    profile:  { relations: 1 }
};

export interface Relation {
    id: ObjectId;
    status: RelationStatus;
}

export enum RelationStatus {
    None = "None",
    Friend = "Friend",
    Blocked = "Blocked",
    BlockedByOther = "BlockedByOther",
    Incoming = "Incoming",
    Outgoing =  "Outgoing"
}
