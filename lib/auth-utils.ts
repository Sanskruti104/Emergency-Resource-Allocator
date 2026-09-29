import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";
import { verifyMongoSessionToken } from "./mongodb-auth";

export async function getServerSession() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) return null;

        // 1. Check for native MongoDB signed session token
        if (sessionCookie.startsWith("mda.")) {
            const mongoSession = verifyMongoSessionToken(sessionCookie);
            if (mongoSession) {
                return {
                    uid: mongoSession.uid,
                    email: mongoSession.email,
                    role: mongoSession.role,
                };
            }
            return null;
        }

        // 2. Fallback to Firebase Admin session cookie verification for backwards compatibility
        if (!adminAuth) {
            console.error("Firebase Admin Auth not initialized");
            return null;
        }
        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, false);
        return decodedClaims;
    } catch (error) {
        console.error("getServerSession error:", error);
        return null;
    }
}
