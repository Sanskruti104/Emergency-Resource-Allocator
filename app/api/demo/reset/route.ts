import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { resetDemoScenario } from "@/lib/emergency/ems-simulator";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/reset
 * Safely resets ONLY demo / simulated scenario records in MongoDB.
 * Never touches production hospitals, non-demo users, or core configuration.
 */
export async function POST() {
    try {
        const client = await clientPromise;
        const db = client.db();

        const result = await resetDemoScenario(db);

        return NextResponse.json({
            success: true,
            message: result.message || "Demo scenario records reset successfully."
        });
    } catch (err: any) {
        console.error("POST /api/demo/reset error:", err);
        return NextResponse.json(
            { success: false, error: "Unable to reset demo records." },
            { status: 500 }
        );
    }
}
