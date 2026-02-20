import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { ObjectId } from "mongodb";

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        const client = await clientPromise;
        const db = client.db();

        const updateData = {
            treatmentName: data.treatmentName,
            insuranceCompanyName: data.insuranceCompanyName,
            coverageLikelihoodPercentage: Number(data.coverageLikelihoodPercentage) || 0,
            documentationRequired: Array.isArray(data.documentationRequired) ? data.documentationRequired : [],
            commonRejectionReasons: Array.isArray(data.commonRejectionReasons) ? data.commonRejectionReasons : [],
            preExistingClauseRisk: data.preExistingClauseRisk || "Low",
            updatedAt: new Date(),
        };

        const result = await db.collection("insurance_treatment_rules").updateOne(
            { _id: new ObjectId(id), hospitalUid: session.uid },
            { $set: updateData }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Updated successfully" });
    } catch (error: any) {
        console.error("PUT Eligibility Rule error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const client = await clientPromise;
        const db = client.db();

        const result = await db.collection("insurance_treatment_rules").deleteOne({
            _id: new ObjectId(id),
            hospitalUid: session.uid
        });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: "Rule not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: "Deleted successfully" });
    } catch (error: any) {
        console.error("DELETE Eligibility Rule error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
