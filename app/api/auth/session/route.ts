import { adminAuth } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(request: Request) {
    try {
        const { idToken } = await request.json();

        if (!idToken) {
            return NextResponse.json({ error: "ID Token is required" }, { status: 400 });
        }

        // 1. Verify the ID token
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // 2. Fetch user role from MongoDB
        const client = await clientPromise;
        const db = client.db();
        const user = await db.collection("users").findOne({ uid });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const role = user.role;

        // 3. Create a session cookie (Nex.js recommended way is to use cookies() from next/headers but in Route Handlers we can also just return a header)
        // However, for Middleware to read it easily, we'll set it here.
        const response = NextResponse.json({ success: true, role });

        // Set the session cookie
        // expires in 5 days
        const expiresIn = 60 * 60 * 24 * 5 * 1000;
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

        response.cookies.set("session", sessionCookie, {
            maxAge: expiresIn / 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax",
        });

        response.cookies.set("user-role", role, {
            maxAge: expiresIn / 1000,
            httpOnly: false, // Accessible by client for UI logic
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax",
        });

        return response;

    } catch (error: any) {
        console.error("Session API error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.delete("session");
    response.cookies.delete("user-role");
    return response;
}
