import {
    CHATS_COLLECTION,
    MONGODB_PROVIDER,
    MESSAGES_COLLECTION,
    USERS_COLLECTION,
    SESSIONS_COLLECTION,
    REDIS_PROVIDER,
} from "@/constants";
import { MongoDB } from "@/database/database.interface";
import { ChatDoc, MessageDoc } from "@/models/chat.model";
import { UserDoc } from "@/models/user.model";
import { ConfigService } from "@nestjs/config";
import { MongoClient } from "mongodb";
import { SessionDoc } from "@/models/session.model";

export const databaseProviders = [
    {
        provide: MONGODB_PROVIDER,
        useFactory: async (config: ConfigService): Promise<MongoDB> => {
            const mongo = new MongoClient(config.get("db.uri") as string);
            const db = mongo.db(config.get<string>("db.name"));
            await mongo.connect();
            return {
                db: db,
                client: mongo,
                users: db.collection<UserDoc>(USERS_COLLECTION),
                chats: db.collection<ChatDoc>(CHATS_COLLECTION),
                messages: db.collection<MessageDoc>(MESSAGES_COLLECTION),
                sessions: db.collection<SessionDoc>(SESSIONS_COLLECTION),
            };
        },
        inject: [ConfigService],
    },
    /*  {
        provide: REDIS_PROVIDER,
        useFactory: async(config: ConfigService): Promise<Redis> => {
            const redis = new Redis(config.get("redis.uri") as string);
            return redis;
        },
        inject: [ConfigService],
    }*/
];
