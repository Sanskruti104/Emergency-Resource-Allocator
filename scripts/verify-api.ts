import { POST } from "../app/api/users/register/route";
import clientPromise from "../lib/mongodb";

// Mock Request object
function createMockRequest(body: any) {
    return new Request("http://localhost/api/users/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

async function testRegistration() {
    console.log("=== Testing User Registration API Logic ===\n");

    const testUid = "test-hospital-" + Date.now();
    const testHospital = {
        uid: testUid,
        role: "hospital",
        hospitalName: "Test Hospital",
        email: "hospital@test.com",
        contactNumber: "1234567890",
        adminName: "Hospital Admin",
    };

    try {
        // 1. Test Successful Registration
        console.log("⏳ Testing: Successful Hospital Registration...");
        const response = await POST(createMockRequest(testHospital));
        const data = await response.json();

        if (response.status === 201) {
            console.log("✅ Success: User registered (Status 201)");
        } else {
            console.log(`❌ Failed: Status ${response.status}`, data);
        }

        // 2. Test Duplicate UID
        console.log("\n⏳ Testing: Duplicate UID...");
        const responseDup = await POST(createMockRequest(testHospital));
        const dataDup = await responseDup.json();

        if (responseDup.status === 400 && dataDup.error === "User already exists") {
            console.log("✅ Success: Duplicate blocked (Status 400)");
        } else {
            console.log(`❌ Failed: Status ${responseDup.status}`, dataDup);
        }

        // 3. Test Validation (Missing UID)
        console.log("\n⏳ Testing: Missing UID...");
        const { uid, ...invalidUser } = testHospital;
        const responseVal = await POST(createMockRequest(invalidUser));
        const dataVal = await responseVal.json();

        if (responseVal.status === 400 && dataVal.error === "UID is required") {
            console.log("✅ Success: Validation caught missing UID (Status 400)");
        } else {
            console.log(`❌ Failed: Status ${responseVal.status}`, dataVal);
        }

        // 4. Verify data in MongoDB
        console.log("\n⏳ Verifying data in MongoDB...");
        const client = await clientPromise;
        const db = client.db();
        const usersCollection = db.collection("users");
        const userInDb = await usersCollection.findOne({ uid: testUid });

        if (userInDb && userInDb.email === "hospital@test.com") {
            console.log("✅ Success: User found in database match");
            // Cleanup
            await usersCollection.deleteOne({ uid: testUid });
            console.log("🧹 Cleanup: Test user removed.");
        } else {
            console.log("❌ Failed: User not found in database or data mismatch");
        }

    } catch (error: any) {
        console.error("❌ Test script error:", error);
    } finally {
        // We don't close the client here because clientPromise might be cached/global
        process.exit(0);
    }
}

testRegistration();
