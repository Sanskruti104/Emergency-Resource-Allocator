import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";

export async function GET() {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const client = await clientPromise;
        const db = client.db();
        const treatments = await db.collection("treatments")
            .find({ hospitalUid: session.uid })
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json(treatments);
    } catch (error: any) {
        console.error("GET Treatments error:", error);
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

        const newTreatment = {
            ...data,
            hospitalUid: session.uid,
            createdAt: new Date(),
        };

        const result = await db.collection("treatments").insertOne(newTreatment);

        return NextResponse.json({ ...newTreatment, _id: result.insertedId }, { status: 201 });
    } catch (error: any) {
        console.error("POST Treatment error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
