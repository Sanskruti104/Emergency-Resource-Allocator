const { MongoClient } = require('mongodb');

async function checkUsers() {
    const uri = "mongodb+srv://rokadesrushti800_db_user:f3AkVev2xTlNWwj6@cluster0.pazkcw3.mongodb.net/";

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db();
        const users = await db.collection("users").find({}).sort({ createdAt: -1 }).limit(5).toArray();
        console.log("Latest Users:", JSON.stringify(users, null, 2));

        const hospitals = await db.collection("hospitals").find({}).sort({ createdAt: -1 }).limit(5).toArray();
        console.log("Latest Hospitals:", JSON.stringify(hospitals, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await client.close();
    }
}

checkUsers();
