import { GET } from "../app/api/users/[uid]/route";
import clientPromise from "../lib/mongodb";

async function testGetUser() {
    console.log("=== Testing GET User API Logic ===\n");

    const testUid = "verify-get-user-" + Date.now();

    try {
        const client = await clientPromise;
        const db = client.db();
        const usersCollection = db.collection("users");

        // 0. Setup: Create a test user
        console.log("⏳ Setting up: Creating test user...");
        await usersCollection.insertOne({
            uid: testUid,
            role: "patient",
            email: "get-test@example.com",
            createdAt: new Date()
        });

        // 1. Test Successful Retrieval
        console.log("⏳ Testing: Successful Retrieval...");
        const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ uid: testUid }) });
        const data = await response.json();

        if (response.status === 200 && data.uid === testUid && data.role === "patient") {
            console.log("✅ Success: User retrieved (Status 200)");
        } else {
            console.log(`❌ Failed: Status ${response.status}`, data);
        }

        // 2. Test User Not Found
        console.log("\n⏳ Testing: User Not Found...");
        const response404 = await GET(new Request("http://localhost"), { params: Promise.resolve({ uid: "non-existent-uid" }) });
        const data404 = await response404.json();

        if (response404.status === 404) {
            console.log("✅ Success: Returned 404 for missing user");
        } else {
            console.log(`❌ Failed: Status ${response404.status}`, data404);
        }

        // Cleanup
        await usersCollection.deleteOne({ uid: testUid });
        console.log("\n🧹 Cleanup: Test user removed.");

    } catch (error: any) {
        console.error("❌ Test script error:", error);
    } finally {
        process.exit(0);
    }
}

testGetUser();
