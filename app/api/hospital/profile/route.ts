import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { calculateHospitalRating } from "@/hospital_rating_engine/hospital_rating_engine";

export async function GET() {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const client = await clientPromise;
        const db = client.db();
        const hospital = await db.collection("hospitals").findOne({ uid: session.uid });

        if (!hospital) {
            return NextResponse.json({
                hospitalName: "",
                uid: session.uid,
                isNew: true
            });
        }

        return NextResponse.json({
            ...hospital,
            rating: calculateHospitalRating(hospital)
        });
    } catch (error: any) {
        console.error("GET Hospital Profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        const client = await clientPromise;
        const db = client.db();

        // 1. Check if profile already exists
        const existing = await db.collection("hospitals").findOne({ uid: session.uid });
        if (existing) {
            return NextResponse.json({ error: "Profile already exists" }, { status: 400 });
        }

        // 2. Insert new profile
        const newHospital = {
            ...data,
            uid: session.uid,
            isVerified: true, // Defaulting to true as per requirements (verification badge)
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await db.collection("hospitals").insertOne(newHospital);

        return NextResponse.json(newHospital, { status: 201 });
    } catch (error: any) {
        console.error("POST Hospital Profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        const client = await clientPromise;
        const db = client.db();

        // Remove immutable fields from payload if they exist
        const { _id, uid, createdAt, ...updateData } = data;

        const result = await db.collection("hospitals").findOneAndUpdate(
            { uid: session.uid },
            {
                $set: {
                    ...updateData,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("PUT Hospital Profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
