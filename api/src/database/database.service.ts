import { CHATS_COLLECTION, DATABASE_PROVIDER, MESSAGES_COLLECTION, USERS_COLLECTION } from "@/constants";
import { MongoDB } from "@/database/database.interface";
import { ChatDoc, MessageDoc } from "@/models/chat.model";
import { UserDoc } from "@/models/user.model";
import { ConfigService } from "@nestjs/config";
import { MongoClient } from "mongodb";

export const databaseProviders = [
    {
        provide: DATABASE_PROVIDER,
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
            };
        },
        inject: [ConfigService],
    },
];
