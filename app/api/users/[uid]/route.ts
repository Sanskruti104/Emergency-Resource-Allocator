import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ uid: string }> }
) {
    try {
        const { uid } = await params;

        if (!uid) {
            return NextResponse.json({ error: "UID is required" }, { status: 400 });
        }

        // 1. Connect to MongoDB
        const client = await clientPromise;
        const db = client.db();
        const usersCollection = db.collection("users");

        // 2. Find user by UID
        const user = await usersCollection.findOne({ uid });

        // 3. Handle not found
        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 4. Return uid and role
        return NextResponse.json({
            uid: user.uid,
            role: user.role
        }, { status: 200 });

    } catch (error: any) {
        console.error("GET User API error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
