export interface Session {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
    name?: string; 
}
export interface SessionDoc extends Omit<Session, "id"> {
    _id: string;
}

export const sessionProjection = {
    _id: 1,
    token: 1,
    userId: 1,
    expiresAt: 1,
    name: 1
}