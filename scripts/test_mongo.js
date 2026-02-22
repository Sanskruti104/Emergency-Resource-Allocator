const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://rokadesrushti800_db_user:f3AkVev2xTlNWwj6@cluster0.pazkcw3.mongodb.net/";

async function test() {
    console.log("Connecting to MongoDB...");
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log("Connected successfully!");
        const db = client.db();
        const collections = await db.listCollections().toArray();
        console.log("Collections:", collections.map(c => c.name));
    } catch (err) {
        console.error("Connection failed:", err);
    } finally {
        await client.close();
    }
}

test();
