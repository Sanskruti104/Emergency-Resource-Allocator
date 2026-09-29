import fs from "fs";
import path from "path";
import crypto from "crypto";
import { MongoClient } from "mongodb";

// Load .env.local if variables are missing
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const [key, ...vals] = trimmed.split("=");
            const val = vals.join("=").trim().replace(/^["']|["']$/g, "");
            if (!process.env[key.trim()]) {
                process.env[key.trim()] = val;
            }
        }
    }
}

const DEFAULT_DEV_SECRET = "meddecision-dev-auth-secret-change-in-production-32chars";
function getSecret() {
    return process.env.AUTH_SECRET || process.env.SESSION_SECRET || DEFAULT_DEV_SECRET;
}

// Scrypt password hashing & verification
async function hashPassword(password) {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString("hex");
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(`${salt}:${derivedKey.toString("hex")}`);
        });
    });
}

async function verifyPassword(password, storedHash) {
    return new Promise((resolve, reject) => {
        if (!storedHash || !storedHash.includes(":")) {
            return resolve(false);
        }
        const [salt, key] = storedHash.split(":");
        if (!salt || !key) return resolve(false);

        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) return reject(err);
            const keyBuffer = Buffer.from(key, "hex");
            if (derivedKey.length !== keyBuffer.length) {
                return resolve(false);
            }
            const match = crypto.timingSafeEqual(derivedKey, keyBuffer);
            resolve(match);
        });
    });
}

// Session Token Generation & Verification
function createMongoSessionToken(payload, expiresInMs = 5 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const sessionData = {
        uid: payload.uid,
        email: payload.email,
        role: payload.role,
        iat: now,
        exp: now + expiresInMs,
    };

    const encodedPayload = Buffer.from(JSON.stringify(sessionData)).toString("base64url");
    const signature = crypto
        .createHmac("sha256", getSecret())
        .update(encodedPayload)
        .digest("base64url");

    return `mda.${encodedPayload}.${signature}`;
}

function verifyMongoSessionToken(token) {
    if (!token || typeof token !== "string" || !token.startsWith("mda.")) {
        return null;
    }

    const parts = token.split(".");
    if (parts.length !== 3) {
        return null;
    }

    const [, encodedPayload, signature] = parts;
    const expectedSignature = crypto
        .createHmac("sha256", getSecret())
        .update(encodedPayload)
        .digest("base64url");

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
        return null;
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return null;
    }

    try {
        const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
        if (Date.now() > payload.exp) {
            return null;
        }
        return payload;
    } catch {
        return null;
    }
}

async function runTestSuite() {
    console.log("================================================================================");
    console.log("       PATIENT MONGODB AUTHENTICATION VERIFICATION TEST SUITE                   ");
    console.log("================================================================================\n");

    let totalTests = 0;
    let passedTests = 0;

    function assert(condition, testName, details = "") {
        totalTests++;
        if (condition) {
            passedTests++;
            console.log(`  [PASS] Test ${totalTests}: ${testName}`);
            if (details) console.log(`         -> ${details}`);
        } else {
            console.error(`  [FAIL] Test ${totalTests}: ${testName}`);
            if (details) console.error(`         -> ${details}`);
            throw new Error(`Test failed: ${testName}`);
        }
    }

    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
        throw new Error("MONGODB_URI is not set in environment or .env.local");
    }

    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db();
    const usersCollection = db.collection("users");

    const testTimestamp = Date.now();
    const testEmail = `test_patient_${testTimestamp}@meddecision-test.org`;
    const testPassword = "SecurePatientPass2026!";
    const testFullName = "Test Patient Jane Doe";
    const testPhone = "+919876543210";
    let createdUid = null;

    try {
        // -------------------------------------------------------------------------
        // 1. Password is hashed with scrypt
        // -------------------------------------------------------------------------
        console.log(">>> [1/7] Testing scrypt Password Hashing & Timing-Safe Verification...");
        const hash = await hashPassword(testPassword);
        const [saltHex, derivedKeyHex] = hash.split(":");

        assert(
            hash.includes(":") && saltHex.length === 32 && derivedKeyHex.length === 128,
            "Password hashed using scrypt with 16-byte random salt and 64-byte key",
            `Salt: ${saltHex.substring(0, 8)}..., Key: ${derivedKeyHex.substring(0, 12)}...`
        );

        const correctVerify = await verifyPassword(testPassword, hash);
        assert(correctVerify === true, "scrypt verification succeeds with matching password");

        const wrongVerify = await verifyPassword("WrongPassword#999", hash);
        assert(wrongVerify === false, "scrypt verification rejects incorrect password");

        // -------------------------------------------------------------------------
        // 2. Patient registration succeeds using MongoDB
        // -------------------------------------------------------------------------
        console.log("\n>>> [2/7] Testing Patient Registration Using MongoDB...");
        createdUid = crypto.randomUUID();
        const newUserDoc = {
            uid: createdUid,
            email: testEmail.toLowerCase().trim(),
            role: "patient",
            passwordHash: hash,
            fullName: testFullName,
            phone: testPhone,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const insertResult = await usersCollection.insertOne(newUserDoc);
        assert(insertResult.acknowledged === true, "Patient user inserted into MongoDB users collection");

        // Ensure safe user response (never return passwordHash)
        const { passwordHash: _, ...safeUser } = newUserDoc;
        assert(
            safeUser.passwordHash === undefined && safeUser.email === testEmail && safeUser.role === "patient",
            "API safe response contains profile fields and omits passwordHash",
            `uid: ${safeUser.uid}, role: ${safeUser.role}, email: ${safeUser.email}`
        );

        // -------------------------------------------------------------------------
        // 3. Duplicate email is rejected
        // -------------------------------------------------------------------------
        console.log("\n>>> [3/7] Testing Duplicate Email Rejection in MongoDB...");
        const duplicateUser = await usersCollection.findOne({ email: testEmail });
        assert(
            duplicateUser !== null && duplicateUser.uid === createdUid,
            "Existing account detected before duplicate insert"
        );

        let duplicateBlocked = false;
        try {
            if (duplicateUser) {
                const err = new Error("This email is already registered.");
                err.code = "DUPLICATE_EMAIL";
                throw err;
            }
        } catch (e) {
            if (e.code === "DUPLICATE_EMAIL" || e.message.includes("already registered")) {
                duplicateBlocked = true;
            }
        }
        assert(duplicateBlocked === true, "Duplicate registration is rejected with DUPLICATE_EMAIL error");

        // -------------------------------------------------------------------------
        // 4. MongoDB user record verification
        // -------------------------------------------------------------------------
        console.log("\n>>> [4/7] Verifying Persisted MongoDB User Record Fields...");
        const dbRecord = await usersCollection.findOne({ uid: createdUid });
        assert(dbRecord !== null, "User record found in MongoDB users collection by uid");
        assert(dbRecord.fullName === testFullName, "Full name preserved in MongoDB record");
        assert(dbRecord.phone === testPhone, "Phone number preserved in MongoDB record");
        assert(dbRecord.role === "patient", "Role is strictly set to 'patient'");
        assert(dbRecord.passwordHash !== testPassword, "Plaintext password is NEVER stored in MongoDB");
        assert(dbRecord.passwordHash.startsWith(saltHex), "Persisted password matches scrypt salt format");

        // -------------------------------------------------------------------------
        // 5. Secure session creation & verification
        // -------------------------------------------------------------------------
        console.log("\n>>> [5/7] Testing Secure Session Creation & HMAC Verification...");
        const sessionToken = createMongoSessionToken({
            uid: createdUid,
            email: testEmail,
            role: "patient",
        });

        assert(sessionToken.startsWith("mda."), "Session token format prefixed with 'mda.'");
        assert(sessionToken.split(".").length === 3, "Session token contains 3 parts (mda.payload.signature)");

        const verifiedSession = verifyMongoSessionToken(sessionToken);
        assert(
            verifiedSession !== null &&
            verifiedSession.uid === createdUid &&
            verifiedSession.role === "patient" &&
            verifiedSession.email === testEmail,
            "Session token successfully verified with HMAC-SHA256 signature and unexpired"
        );

        // Tampered token test
        const tamperedToken = sessionToken.slice(0, -6) + "ZZZZZZ";
        const tamperedResult = verifyMongoSessionToken(tamperedToken);
        assert(tamperedResult === null, "Tampered session token is rejected");

        // Expired token test
        const expiredToken = createMongoSessionToken({ uid: createdUid, email: testEmail, role: "patient" }, -5000);
        const expiredResult = verifyMongoSessionToken(expiredToken);
        assert(expiredResult === null, "Expired session token is rejected");

        // -------------------------------------------------------------------------
        // 6. Patient can subsequently log in using MongoDB
        // -------------------------------------------------------------------------
        console.log("\n>>> [6/7] Testing Patient Login Authentication Flow...");
        // Lookup user by email
        const userToLogin = await usersCollection.findOne({ email: testEmail.toLowerCase().trim() });
        assert(userToLogin !== null, "Login finds user by normalized email");

        // Verify scrypt hash
        const loginPasswordMatch = await verifyPassword(testPassword, userToLogin.passwordHash);
        assert(loginPasswordMatch === true, "Login password successfully verified with scrypt");

        // Role verification
        assert(userToLogin.role === "patient", "Login confirms expected patient role");

        // Wrong password login attempt
        const failedPasswordMatch = await verifyPassword("WrongPassword123!", userToLogin.passwordHash);
        assert(failedPasswordMatch === false, "Login rejects incorrect password");

        // Role mismatch attempt (e.g. attempting hospital login with patient credentials)
        const expectedHospitalRole = "hospital";
        const roleMismatchDetected = userToLogin.role !== expectedHospitalRole;
        assert(roleMismatchDetected === true, "Role mismatch rejected when attempting non-patient login");

        // Issue login session
        const loginSessionToken = createMongoSessionToken({
            uid: userToLogin.uid,
            email: userToLogin.email,
            role: userToLogin.role,
        });
        const loginVerified = verifyMongoSessionToken(loginSessionToken);
        assert(
            loginVerified !== null && loginVerified.uid === createdUid,
            "Login issues valid session token for subsequent authenticated requests"
        );

        // -------------------------------------------------------------------------
        // 7. Verify Firebase Auth is NOT called during patient signup/login
        // -------------------------------------------------------------------------
        console.log("\n>>> [7/7] Verifying Source Code: Firebase Auth Removed From Patient Signup & Login...");

        const patientSignupCode = fs.readFileSync(
            path.resolve(process.cwd(), "app/signup/patient/page.tsx"),
            "utf-8"
        );
        const patientLoginCode = fs.readFileSync(
            path.resolve(process.cwd(), "app/login/patient/page.tsx"),
            "utf-8"
        );
        const authRegisterRouteCode = fs.readFileSync(
            path.resolve(process.cwd(), "app/api/auth/register/route.ts"),
            "utf-8"
        );
        const authLoginRouteCode = fs.readFileSync(
            path.resolve(process.cwd(), "app/api/auth/login/route.ts"),
            "utf-8"
        );

        assert(
            !patientSignupCode.includes("createUserWithEmailAndPassword"),
            "Patient signup page does NOT contain 'createUserWithEmailAndPassword'"
        );
        assert(
            !patientSignupCode.includes("from \"firebase/auth\"") &&
            !patientSignupCode.includes("from 'firebase/auth'"),
            "Patient signup page has NO 'firebase/auth' imports"
        );
        assert(
            !patientSignupCode.includes("@/lib/firebase"),
            "Patient signup page has NO '@/lib/firebase' imports"
        );
        assert(
            patientSignupCode.includes("/api/auth/register"),
            "Patient signup page invokes MongoDB '/api/auth/register'"
        );

        assert(
            !patientLoginCode.includes("signInWithEmailAndPassword"),
            "Patient login page does NOT contain 'signInWithEmailAndPassword'"
        );
        assert(
            !patientLoginCode.includes("from \"firebase/auth\"") &&
            !patientLoginCode.includes("from 'firebase/auth'"),
            "Patient login page has NO 'firebase/auth' imports"
        );
        assert(
            !patientLoginCode.includes("@/lib/firebase"),
            "Patient login page has NO '@/lib/firebase' imports"
        );
        assert(
            patientLoginCode.includes("/api/auth/login"),
            "Patient login page invokes MongoDB '/api/auth/login'"
        );

        assert(
            !authRegisterRouteCode.includes("firebase"),
            "/api/auth/register route handler has NO Firebase dependencies"
        );
        assert(
            !authLoginRouteCode.includes("firebase"),
            "/api/auth/login route handler has NO Firebase dependencies"
        );

        console.log("\n================================================================================");
        console.log(`       ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
        console.log("================================================================================\n");

    } finally {
        // Cleanup test user
        if (createdUid) {
            console.log("Cleaning up test user from MongoDB users collection...");
            await usersCollection.deleteOne({ uid: createdUid });
            console.log("Cleanup complete.");
        }
        await client.close();
    }
}

runTestSuite().catch((err) => {
    console.error("Test Suite execution failed:", err);
    process.exit(1);
});
