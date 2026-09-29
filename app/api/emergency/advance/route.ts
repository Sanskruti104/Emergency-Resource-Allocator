import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { advanceAmbulance, AmbulanceMoveStep } from "@/lib/emergency/ems-simulator";
import { z } from "zod";

export const dynamic = "force-dynamic";

const advanceSchema = z.object({
    ambulanceId: z.string(),
    step: z.enum(["DISPATCHED", "EN_ROUTE", "ARRIVED", "HANDOFF"]).optional(),
    targetStatus: z.enum(["DISPATCHED", "EN_ROUTE", "ARRIVED", "HANDOFF"]).optional()
}).refine(data => data.step || data.targetStatus, {
    message: "Either 'step' or 'targetStatus' must be provided"
});

/**
 * POST /api/emergency/advance
 *
 * Advances ambulance through the simulated movement lifecycle:
 * DISPATCHED → EN_ROUTE → ARRIVED → HANDOFF
 *
 * On ARRIVED: creates handoff document and marks emergency ARRIVED.
 * On HANDOFF: auto-admits patient, shifts capacity to occupied, marks handoff COMPLETED.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = advanceSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: parsed.error.format() },
                { status: 422 }
            );
        }

        const client = await clientPromise;
        const db = client.db();

        const stepToRun = (parsed.data.step || parsed.data.targetStatus) as AmbulanceMoveStep;

        const result = await advanceAmbulance(
            parsed.data.ambulanceId,
            stepToRun,
            db
        );

        return NextResponse.json({
            success: true,
            ...result
        });

    } catch (err: any) {
        console.error("POST /api/emergency/advance error:", err);
        return NextResponse.json(
            { success: false, error: err?.message || "Failed to advance ambulance" },
            { status: 500 }
        );
    }
}
