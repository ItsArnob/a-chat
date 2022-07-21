import { customAlphabet } from "nanoid";

export function generateSessionId(userId: string) {
    const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", 50);
    return `${userId}-${nanoid()}`;
}