import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { ObjectId } from "mongodb";

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        const client = await clientPromise;
        const db = client.db();

        const updateData = {
            schemeName: data.schemeName,
            empanelmentId: data.empanelmentId || "",
            activeStatus: Boolean(data.activeStatus),
            lastAuditDate: data.lastAuditDate ? new Date(data.lastAuditDate) : null,
            updatedAt: new Date(),
        };

        const result = await db.collection("government_scheme_empanelment").updateOne(
            { _id: new ObjectId(params.id), hospitalUid: session.uid },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Updated successfully" });
    } catch (error: any) {
        console.error("PUT Gov Scheme error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const client = await clientPromise;
        const db = client.db();

        const result = await db.collection("government_scheme_empanelment").deleteOne({
            _id: new ObjectId(params.id),
            hospitalUid: session.uid
        });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: "Scheme not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Deleted successfully" });
    } catch (error: any) {
        console.error("DELETE Gov Scheme error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
