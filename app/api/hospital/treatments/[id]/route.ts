import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { ObjectId } from "mongodb";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const data = await request.json();
        const client = await clientPromise;
        const db = client.db();

        const { _id, ...updateData } = data;

        const result = await db.collection("treatments").findOneAndUpdate(
            { _id: new ObjectId(id), hospitalUid: session.uid },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("PUT Treatment error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const client = await clientPromise;
        const db = client.db();

        const result = await db.collection("treatments").deleteOne({
            _id: new ObjectId(id),
            hospitalUid: session.uid
        });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE Treatment error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
