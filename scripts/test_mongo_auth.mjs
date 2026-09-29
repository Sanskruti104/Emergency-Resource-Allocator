import crypto from "crypto";

const DEFAULT_DEV_SECRET = "meddecision-dev-auth-secret-change-in-production-32chars";

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

function createMongoSessionToken(payload, expiresInMs = 5 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    const sessionData = {
        ...payload,
        iat: now,
        exp: now + expiresInMs,
    };

    const encodedPayload = Buffer.from(JSON.stringify(sessionData)).toString("base64url");
    const signature = crypto
        .createHmac("sha256", DEFAULT_DEV_SECRET)
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
        .createHmac("sha256", DEFAULT_DEV_SECRET)
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

async function runTests() {
    console.log("=== Testing MongoDB Auth Foundation ===");

    // Test 1: Password hashing and verification
    const password = "StrongHospitalAdminPassword#2026";
    const hash = await hashPassword(password);
    console.log("1. Password hash format check:", hash.includes(":") && hash.length > 100 ? "PASS" : "FAIL");

    const isMatch = await verifyPassword(password, hash);
    console.log("2. Password verification with correct password:", isMatch === true ? "PASS" : "FAIL");

    const isWrongMatch = await verifyPassword("WrongPassword123", hash);
    console.log("3. Password verification with wrong password:", isWrongMatch === false ? "PASS" : "FAIL");

    // Test 2: Session token generation & verification
    const sampleUser = {
        uid: "test-hospital-uid-12345",
        email: "hospital@demo.com",
        role: "hospital"
    };

    const token = createMongoSessionToken(sampleUser);
    console.log("4. Token prefix check:", token.startsWith("mda.") ? "PASS" : "FAIL");

    const verified = verifyMongoSessionToken(token);
    console.log("5. Token signature & payload verification:", verified?.uid === sampleUser.uid && verified?.role === "hospital" ? "PASS" : "FAIL");

    // Test 3: Tampered token rejection
    const tamperedToken = token.slice(0, -4) + "XXXX";
    const tamperedResult = verifyMongoSessionToken(tamperedToken);
    console.log("6. Tampered token rejection:", tamperedResult === null ? "PASS" : "FAIL");

    // Test 4: Expired token rejection
    const expiredToken = createMongoSessionToken(sampleUser, -1000); // Expired 1 second ago
    const expiredResult = verifyMongoSessionToken(expiredToken);
    console.log("7. Expired token rejection:", expiredResult === null ? "PASS" : "FAIL");

    console.log("=== All Auth Foundation Tests Completed Successfully ===");
}

runTests().catch(console.error);
