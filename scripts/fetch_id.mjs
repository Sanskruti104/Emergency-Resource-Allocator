import { MongoClient } from "mongodb";

const uri = "mongodb+srv://rokadesrushti800_db_user:f3AkVev2xTlNWwj6@cluster0.pazkcw3.mongodb.net/";
const client = new MongoClient(uri);

async function run() {
    try {
        await client.connect();
        // try to find the db name if possible, or use default
        // If uri has no db name, client.db() uses 'test' by default usually, unless configured otherwise.
        // Let's list dbs to be sure if we are unsure, but let's try default first.
        const db = client.db();
        const hospital = await db.collection("hospitals").findOne({});
        if (hospital) {
            console.log("Hospital ID:", hospital._id.toString());
            console.log("Hospital UID:", hospital.uid);
        } else {
            console.log("No hospitals found in default db.");
            // List databases to help debug if needed
            const dbs = await client.db().admin().listDatabases();
            console.log("Databases:", dbs.databases.map(d => d.name).join(", "));
        }
    } finally {
        await client.close();
    }
}

run().catch(console.dir);
