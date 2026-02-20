import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";

export async function PUT(request: Request) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const capacityData = await request.json();
        const client = await clientPromise;
        const db = client.db();

        const result = await db.collection("hospitals").findOneAndUpdate(
            { uid: session.uid },
            {
                $set: {
                    capacity: {
                        ...capacityData,
                        updatedAt: new Date()
                    },
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return NextResponse.json({ error: "Hospital profile not found. Please create profile first." }, { status: 404 });
        }

        return NextResponse.json(result.capacity);
    } catch (error: any) {
        console.error("PUT Capacity error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
