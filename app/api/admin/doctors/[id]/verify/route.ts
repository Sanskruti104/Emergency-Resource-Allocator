import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { ObjectId } from "mongodb";
import { logClinicalAudit } from "@/lib/clinical-security";

/**
 * Administrative Doctor Verification API
 * Only accessible to platform administrators (role: 'admin')
 */
export async function PATCH(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession();

        // Security: Strict Admin Role Verification
        if (!session || (session as any).role !== "admin") {
            return NextResponse.json({
                error: "Forbidden: Administrative privileges required for clinical verification."
            }, { status: 403 });
        }

        const { id } = await params;
        const { status, remarks } = await request.json();

        if (!["VERIFIED", "REJECTED", "PENDING"].includes(status)) {
            return NextResponse.json({ error: "Invalid status state" }, { status: 400 });
        }

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        const result = await db.collection("visiting_doctors").updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    verificationStatus: status,
                    adminRemarks: remarks || "",
                    verifiedBy: session.uid,
                    verifiedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "Doctor record not found" }, { status: 404 });
        }

        // Log Verification Audit
        await logClinicalAudit({
            actorUid: session.uid,
            targetId: id,
            action: "VERIFICATION_STATUS",
            timestamp: new Date(),
            details: { newStatus: status, remarks: remarks || "N/A" }
        });

        return NextResponse.json({
            message: `Doctor status successfully updated to ${status}`,
            verified: status === "VERIFIED"
        });
    } catch (error: any) {
        console.error("Clinical Verification Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
