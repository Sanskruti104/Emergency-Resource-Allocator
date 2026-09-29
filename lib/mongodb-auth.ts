import crypto from "crypto";
import clientPromise from "./mongodb";

export type UserRole = "patient" | "hospital" | "admin";

export interface MongoUser {
    _id?: any;
    uid: string;
    email: string;
    role: UserRole;
    passwordHash?: string;
    fullName?: string;
    hospitalName?: string;
    adminName?: string;
    contactNumber?: string;
    phone?: string;
    createdAt: Date;
    updatedAt?: Date;
}

export interface MongoSessionPayload {
    uid: string;
    email: string;
    role: UserRole;
    iat: number;
    exp: number;
}

const DEFAULT_DEV_SECRET = "meddecision-dev-auth-secret-change-in-production-32chars";

function getSecret(): string {
    return process.env.AUTH_SECRET || process.env.SESSION_SECRET || DEFAULT_DEV_SECRET;
}

/**
 * Hashes a plaintext password using standard scrypt with a cryptographically secure random salt.
 * Stored format: "<salt_hex>:<derived_key_hex>"
 */
export async function hashPassword(password: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString("hex");
        crypto.scrypt(password, salt, 64, (err, derivedKey) => {
            if (err) return reject(err);
            resolve(`${salt}:${derivedKey.toString("hex")}`);
        });
    });
}

/**
 * Verifies a plaintext password against a stored scrypt hash using timing-safe comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
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

/**
 * Creates an HMAC-SHA256 signed session token for MongoDB-authenticated users.
 * Token structure: "mda.<base64url_payload>.<base64url_signature>"
 */
export function createMongoSessionToken(
    payload: { uid: string; email: string; role: UserRole },
    expiresInMs: number = 5 * 24 * 60 * 60 * 1000 // 5 days default
): string {
    const now = Date.now();
    const sessionData: MongoSessionPayload = {
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

/**
 * Verifies and decodes a MongoDB session token.
 * Returns the payload if valid and unexpired, otherwise null.
 */
export function verifyMongoSessionToken(token: string): MongoSessionPayload | null {
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

    // Timing-safe signature check
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
        return null;
    }

    if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        return null;
    }

    try {
        const payload: MongoSessionPayload = JSON.parse(
            Buffer.from(encodedPayload, "base64url").toString("utf-8")
        );

        if (Date.now() > payload.exp) {
            return null; // Expired token
        }

        return payload;
    } catch {
        return null;
    }
}

/**
 * Repository Helper: Find user by email in MongoDB users collection
 */
export async function findUserByEmail(email: string): Promise<MongoUser | null> {
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne({ email: email.toLowerCase().trim() });
    return user as MongoUser | null;
}

/**
 * Repository Helper: Find user by UID in MongoDB users collection
 */
export async function findUserByUid(uid: string): Promise<MongoUser | null> {
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne({ uid });
    return user as MongoUser | null;
}

export interface CreateUserData {
    email: string;
    password: string;
    role?: UserRole;
    fullName?: string;
    phone?: string;
    contactNumber?: string;
    hospitalName?: string;
}

export const AUTH_COOKIE_NAME = "session";
export const ROLE_COOKIE_NAME = "user-role";
export const SESSION_EXPIRY_MS = 5 * 24 * 60 * 60 * 1000; // 5 days
export const SESSION_EXPIRY_SECONDS = 5 * 24 * 60 * 60; // 5 days in seconds

/**
 * Creates a new user in MongoDB users collection with scrypt password hash.
 * Throws an error if email already exists or required fields are missing.
 */
export async function createMongoUser(data: CreateUserData): Promise<Omit<MongoUser, "passwordHash">> {
    const email = data.email?.toLowerCase().trim();
    if (!email) {
        throw new Error("Email is required");
    }
    if (!data.password || data.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
        const error = new Error("This email is already registered.");
        (error as any).code = "DUPLICATE_EMAIL";
        throw error;
    }

    const passwordHash = await hashPassword(data.password);
    const uid = crypto.randomUUID();
    const role: UserRole = data.role || "patient";

    const client = await clientPromise;
    const db = client.db();

    const newUser: MongoUser = {
        uid,
        email,
        role,
        passwordHash,
        fullName: data.fullName?.trim() || "",
        phone: data.phone?.trim() || "",
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    if (data.hospitalName) {
        newUser.hospitalName = data.hospitalName.trim();
    }
    if (data.contactNumber) {
        newUser.contactNumber = data.contactNumber.trim();
    }

    const result = await db.collection("users").insertOne(newUser);
    if (!result.acknowledged) {
        throw new Error("Failed to insert user into database");
    }

    const { passwordHash: _, ...safeUser } = newUser;
    return safeUser;
}

/**
 * Authenticates a user against MongoDB users collection using scrypt verification.
 */
export async function authenticateMongoUser(
    email: string,
    password: string,
    expectedRole?: UserRole
): Promise<Omit<MongoUser, "passwordHash">> {
    const normalizedEmail = email?.toLowerCase().trim();
    if (!normalizedEmail || !password) {
        throw new Error("Email and password are required");
    }

    const user = await findUserByEmail(normalizedEmail);
    if (!user || !user.passwordHash) {
        throw new Error("Invalid email or password.");
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
        throw new Error("Invalid email or password.");
    }

    if (expectedRole && user.role !== expectedRole) {
        const roleError = new Error(`This account is not registered as a ${expectedRole}.`);
        (roleError as any).code = "ROLE_MISMATCH";
        throw roleError;
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
}

