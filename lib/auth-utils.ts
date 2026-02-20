import { cookies } from "next/headers";
import { adminAuth } from "./firebase-admin";

export async function getServerSession() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get("session")?.value;

        if (!sessionCookie) return null;

        const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
        return decodedClaims;
    } catch (error) {
        console.error("getServerSession error:", error);
        return null;
    }
}
