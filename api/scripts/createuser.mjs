import { MongoClient } from "mongodb";
import { ulid } from "ulid"
const mongodb = new MongoClient("mongodb://localhost:27017");
await mongodb.connect()

await mongodb.db("a_chat").collection("users").insertOne({
        _id: ulid(),
        username: process.argv[2],
        passwordHash: '$2a$10$Ta2ZnpdYM63IMWwRiSRDS.tChZEOqAFb1pOpTAoIo4qgqn8iRF.Xa',

});
await mongodb.close()