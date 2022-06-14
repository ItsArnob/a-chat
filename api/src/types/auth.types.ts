import { IUserBase } from './users.types';

export interface IUser extends IUserBase {
    passwordHash: string;
    tokenId?: string | null;
}
export interface IUserJWTResponse extends IUserBase {
    token: string;
}
