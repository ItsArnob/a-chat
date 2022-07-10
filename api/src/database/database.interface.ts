import { ChatDoc, MessageDoc } from '@/models/chat.model';
import { User, UserDoc } from '@/models/user.model';
import { Collection, Db, MongoClient } from 'mongodb';

export interface MongoDB {
    db: Db;
    client: MongoClient;
    users: Collection<UserDoc>;
    chats: Collection<ChatDoc>;
    messages: Collection<MessageDoc>;
}