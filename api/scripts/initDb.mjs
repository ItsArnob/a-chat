import { MongoClient } from "mongodb";
import { config as loadEnv } from "dotenv";

loadEnv();

const mongo = new MongoClient(
    process.env.DB_URI || "mongodb://localhost:27017/"
);

console.log("Connecting to mongodb...");
await mongo.connect();

const db = mongo.db(process.env.DB_NAME || "a_chat");

const usersColl = db.collection("users");
const chatsColl = db.collection("chats");
const messagesColl = db.collection("messages");
const sessionsColl = db.collection("sessions");

console.log("Creating indexes....");
await usersColl.createIndex(
    { username: 1 },
    {
        unique: true,
        collation: {
            strength: 2,
            locale: "en",
        },
    }
);

// NOTE: should i create a index on userId? probably no.
// it would help with fetching sessions by userId but
// it would be too infrequent to consider indexing i think.

await sessionsColl.createIndex({ token: 1 }, { unique: true });
await sessionsColl.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
await chatsColl.createIndex({ "recipients.id": 1, chatType: 1 });
await messagesColl.createIndex({ chatId: 1, _id: -1 });
console.log("Done!");
await mongo.close();
