import { ObjectId } from 'mongodb';

export interface Chat {
    id: ObjectId
    name?: string | null
    chatType: ChatType
    recipients: ChatRecipient[]
    lastMessageId?: string
}

export interface Message {
    id: string
    chatId: ObjectId
    authorId: ObjectId
    content?: string | null
    deleted?: boolean | null
}


export enum ChatType {
    Direct = "Direct",
    Group = "Group",
}
export interface ChatRecipient {
    id: ObjectId
    nickname?: string
}


export const chatProjection = {
    _id: 1,
    name: 1,
    chatType: 1,
    recipients: 1,
    lastMessageId: 1
}
export const messageProjection = {
    _id: 1,
    chatId: 1,
    authorId: 1,
    content: 1,
    deleted: 1
}

export interface ChatDoc extends Omit<Chat, 'id'> {};
export interface MessageDoc extends Omit<Message, 'id'> {
    _id: string
};
