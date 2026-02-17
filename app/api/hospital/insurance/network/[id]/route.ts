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
            insuranceCompanyName: data.insuranceCompanyName,
            tpaName: data.tpaName || "",
            cashlessAvailable: Boolean(data.cashlessAvailable),
            reimbursementAvailable: Boolean(data.reimbursementAvailable),
            preAuthRequired: Boolean(data.preAuthRequired),
            averageApprovalTimeDays: Number(data.averageApprovalTimeDays) || 0,
            updatedAt: new Date(),
        };

        const result = await db.collection("insurance_networks").updateOne(
            { _id: new ObjectId(params.id), hospitalUid: session.uid },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "Network profile not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Updated successfully" });
    } catch (error: any) {
        console.error("PUT Insurance Network error:", error);
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

        const result = await db.collection("insurance_networks").deleteOne({
            _id: new ObjectId(params.id),
            hospitalUid: session.uid
        });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: "Network profile not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Deleted successfully" });
    } catch (error: any) {
        console.error("DELETE Insurance Network error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
