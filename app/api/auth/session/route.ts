import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { cookies } from "next/headers";
import clientPromise from "@/lib/mongodb";

export async function POST(request: Request) {
    try {
        if (!adminAuth) {
            return NextResponse.json({
                error: "Firebase Admin not configured properly"
            }, { status: 500 });
        }

        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json({ error: "ID token is required" }, { status: 400 });
        }

        // 1. Verify the ID token and get the UID
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 2. Fetch user role from MongoDB
        const client = await clientPromise;
        const db = client.db();
        const user = await db.collection("users").findOne({ uid });

        if (!user) {
            console.error(`Session failure: UID ${uid} not found in users collection.`);
            return NextResponse.json({ error: "User record not found in database." }, { status: 404 });
        }
        console.log(`Session success: UID ${uid} identified as Role: ${user.role}`);

        // 3. Create the session cookie
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

        // 4. Set the cookies
        const cookieStore = await cookies();
        cookieStore.set("session", sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
        });

        cookieStore.set("user-role", user.role, {
            maxAge: expiresIn,
            httpOnly: false, // Accessible by client if needed, but primarily for middleware
            secure: process.env.NODE_ENV === "production",
            path: "/",
        });

        // 5. Return success and the user role
        console.log(`Session created for UID: ${uid}, Role: ${user.role}`);
        return NextResponse.json({
            success: true,
            message: "Session created",
            role: user.role
        });

    } catch (error: any) {
        console.error("Session creation error:", error);
        return NextResponse.json({
            error: "Internal server error",
            details: error.message
        }, { status: 500 });
    }
}
