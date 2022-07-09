import { ObjectId, WithId } from 'mongodb';

export interface User {
    id: string
    username: string
    passwordHash: string
    token?: string | null
    profile?: {
        relations?: Relation[]
    } | null
};
export interface UserDoc extends Omit<User, 'id'> {
    _id: string
};

export interface UserNoProfile extends Omit<User, 'profile'> {}
export interface UserNoProfileDoc extends Omit<UserNoProfile, 'id'> {
    _id: string
};

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
    id: string;
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
