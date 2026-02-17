import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";

// Calculate reliability score based on performance metrics
function calculateReliabilityScore(
    rejectionRatePercentage: number,
    averageApprovalTimeDays: number,
    deductionTrendLevel: string
): number {
    // Base score from rejection rate (0-50 points)
    const rejectionScore = Math.max(0, (100 - rejectionRatePercentage) * 0.5);

    // Approval time score (0-50 points, faster is better)
    const approvalScore = Math.max(0, (30 - Math.min(averageApprovalTimeDays, 30)) / 30 * 50);

    // Deduction trend adjustment
    const deductionAdjustment =
        deductionTrendLevel === "low" ? 5 :
            deductionTrendLevel === "medium" ? 0 :
                -5; // high

    const totalScore = Math.min(100, Math.max(0, rejectionScore + approvalScore + deductionAdjustment));
    return Math.round(totalScore * 10) / 10; // Round to 1 decimal
}

export async function GET() {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const client = await clientPromise;
        const db = client.db();
        const metrics = await db.collection("claim_performance_metrics")
            .find({ hospitalUid: session.uid })
            .sort({ updatedAt: -1 })
            .toArray();

        return NextResponse.json(metrics);
    } catch (error: any) {
        console.error("GET Claim Metrics error:", error);
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

        if (!data.insuranceCompanyName) {
            return NextResponse.json({ error: "Insurance Company Name is required" }, { status: 400 });
        }

        const averageApprovalTimeDays = Number(data.averageApprovalTimeDays) || 0;
        const rejectionRatePercentage = Number(data.rejectionRatePercentage) || 0;
        const deductionTrendLevel = (data.deductionTrendLevel || "medium").toLowerCase();

        // Calculate reliability score
        const reliabilityScore = calculateReliabilityScore(
            rejectionRatePercentage,
            averageApprovalTimeDays,
            deductionTrendLevel
        );

        const client = await clientPromise;
        const db = client.db();

        const metricData = {
            hospitalUid: session.uid,
            insuranceCompanyName: data.insuranceCompanyName,
            averageApprovalTimeDays,
            rejectionRatePercentage,
            deductionTrendLevel,
            reliabilityScore,
            updatedAt: new Date(),
        };

        // Upsert: update if exists, insert if not
        const result = await db.collection("claim_performance_metrics").updateOne(
            { hospitalUid: session.uid, insuranceCompanyName: data.insuranceCompanyName },
            { $set: metricData, $setOnInsert: { createdAt: new Date() } },
            { upsert: true }
        );

        return NextResponse.json({
            success: true,
            message: result.upsertedCount > 0 ? "Created successfully" : "Updated successfully",
            reliabilityScore
        });
    } catch (error: any) {
        console.error("PUT Claim Metrics error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
