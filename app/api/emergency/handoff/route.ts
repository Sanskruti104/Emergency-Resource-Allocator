import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { POST as handleHandoffAction } from "./action/route";

export const dynamic = "force-dynamic";

export { handleHandoffAction as POST };

/**
 * GET /api/emergency/handoff?emergencyId=...&hospitalId=...
 * Query handoff documents for an emergency or hospital.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const emergencyId = searchParams.get("emergencyId");
        const hospitalId = searchParams.get("hospitalId");

        const client = await clientPromise;
        const db = client.db();

        const query: Record<string, any> = {};
        if (emergencyId) query.emergencyId = emergencyId;
        if (hospitalId) query.hospitalId = hospitalId;

        const handoffs = await db.collection("handoffs")
            .find(query)
            .sort({ createdAt: -1 })
            .limit(20)
            .toArray();

        return NextResponse.json({
            success: true,
            handoffs,
            latestHandoff: handoffs[0] || null
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch handoffs" },
            { status: 500 }
        );
    }
}
