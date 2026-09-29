import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { runSimulation, advanceAmbulance, SimulationScenario } from "@/lib/emergency/ems-simulator";
import { z } from "zod";

export const dynamic = "force-dynamic";

const simulateSchema = z.object({
    scenario: z.enum([
        "NORMAL_CARDIAC",
        "TRAUMA",
        "STROKE",
        "ICU_SCARCITY",
        "NO_SUITABLE_HOSPITAL",
        "STALE_HOSPITAL_DATA"
    ]),
    ambulanceId: z.string().optional(),
    incidentLatitude: z.coerce.number().optional(),
    incidentLongitude: z.coerce.number().optional(),
    overrideAvailableIcuBeds: z.coerce.number().optional()
});

/**
 * POST /api/emergency/simulate
 *
 * Runs a full EMS simulation scenario through the real pipeline.
 * All MongoDB writes are real. GPS / ETA data is simulated.
 *
 * Body:
 *   scenario: "NORMAL_CARDIAC" | "TRAUMA" | "STROKE" | "ICU_SCARCITY" |
 *             "NO_SUITABLE_HOSPITAL" | "STALE_HOSPITAL_DATA"
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = simulateSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: parsed.error.format() },
                { status: 422 }
            );
        }

        const client = await clientPromise;
        const db = client.db();

        const result = await runSimulation(
            {
                scenario: parsed.data.scenario as SimulationScenario,
                ambulanceId: parsed.data.ambulanceId,
                incidentLatitude: parsed.data.incidentLatitude,
                incidentLongitude: parsed.data.incidentLongitude,
                overrideAvailableIcuBeds: parsed.data.overrideAvailableIcuBeds
            },
            db
        );

        const httpStatus = result.success ? 200 : 202; // 202 = simulation ran but no allocation
        return NextResponse.json(result, { status: httpStatus });

    } catch (err: any) {
        console.error("POST /api/emergency/simulate error:", err);
        return NextResponse.json(
            { success: false, error: "Internal server error", details: err?.message },
            { status: 500 }
        );
    }
}
