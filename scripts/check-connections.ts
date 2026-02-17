import { MongoClient } from "mongodb";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

async function checkMongoDB() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.log("❌ MongoDB: MONGODB_URI is not defined in environment variables.");
        return;
    }

    console.log("⏳ MongoDB: Attempting to connect...");
    const client = new MongoClient(uri);
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("✅ MongoDB: Connected successfully!");
    } catch (error: any) {
        console.log(`❌ MongoDB: Connection failed: ${error.message}`);
    } finally {
        await client.close();
    }
}

async function checkFirebase() {
    const config = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    if (!config.apiKey) {
        console.log("❌ Firebase: NEXT_PUBLIC_FIREBASE_API_KEY is not defined.");
        return;
    }

    console.log("⏳ Firebase: Initializing...");
    try {
        const app = getApps().length > 0 ? getApp() : initializeApp(config);
        const auth = getAuth(app);
        console.log("✅ Firebase: Initialized successfully!");
        // Note: Real connectivity check usually requires an operation, 
        // but getting auth is a good start for config validation.
    } catch (error: any) {
        console.log(`❌ Firebase: Initialization failed: ${error.message}`);
    }
}

async function main() {
    console.log("=== Database Connection Check ===\n");
    await checkMongoDB();
    console.log("");
    await checkFirebase();
    console.log("\n=================================");
}

main().catch(console.error);
