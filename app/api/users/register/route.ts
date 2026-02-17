import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { uid, role, fullName, email, phone } = body;

        // 1. Validate required fields
        if (!uid) {
            return NextResponse.json({ error: "UID is required" }, { status: 400 });
        }
        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }
        if (!role || !["patient", "hospital"].includes(role)) {
            return NextResponse.json(
                { error: 'Role must be either "patient" or "hospital"' },
                { status: 400 }
            );
        }

        // 2. Connect to MongoDB
        const client = await clientPromise;
        const db = client.db(); // Uses DB from URI or default
        const usersCollection = db.collection("users");

        // 3. Prevent duplicate UID entries
        const existingUser = await usersCollection.findOne({ uid });
        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        // 4. Insert new user document
        const newUser = {
            ...body,
            createdAt: new Date(),
        };

        const result = await usersCollection.insertOne(newUser);

        if (!result.acknowledged) {
            throw new Error("Failed to insert user into database");
        }

        return NextResponse.json(
            { message: "User registered successfully", userId: result.insertedId },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("Registration API error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
