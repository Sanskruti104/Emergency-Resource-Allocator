import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { reserveResource } from "@/lib/emergency/emergency-reservation";
import { ResourceType } from "@/lib/emergency/emergency-types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reserveSchema = z.object({
    hospitalId:    z.string().min(1),
    emergencyId:   z.string().min(1),
    resourceType:  z.enum(["ICU_BED","GENERAL_BED","VENTILATOR","OPERATION_THEATRE","TRAUMA_BAY","CT_SCAN","CATH_LAB","SPECIALIST"]),
    quantity:      z.coerce.number().int().min(1).max(20).default(1),
    ttlMinutes:    z.coerce.number().min(5).max(120).default(30),
    allocatedBy:   z.enum(["AUTO_ALLOCATOR","MANUAL_DISPATCH"]).default("AUTO_ALLOCATOR")
});

/**
 * POST /api/emergency/reserve
 * Atomically reserves a hospital resource for an emergency.
 * Returns RESOURCE_UNAVAILABLE if capacity is insufficient (no race possible).
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = reserveSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: parsed.error.format() },
                { status: 422 }
            );
        }

        const client = await clientPromise;
        const db = client.db();

        const result = await reserveResource({
            hospitalId:  parsed.data.hospitalId,
            emergencyId: parsed.data.emergencyId,
            resourceType: parsed.data.resourceType as ResourceType,
            quantity:    parsed.data.quantity,
            ttlMinutes:  parsed.data.ttlMinutes,
            allocatedBy: parsed.data.allocatedBy
        }, db);

        if (result.outcome === "SUCCESS" && result.reservationId) {
            await db.collection("emergencyRequests").updateOne(
                { emergencyId: parsed.data.emergencyId },
                {
                    $set: {
                        reservationId: result.reservationId,
                        allocatedHospitalId: parsed.data.hospitalId,
                        updatedAt: new Date()
                    }
                }
            );
        }

        const status =
            result.outcome === "SUCCESS"           ? 201 :
            result.outcome === "RESOURCE_UNAVAILABLE" ? 409 :
            result.outcome === "HOSPITAL_NOT_FOUND" ? 404 : 500;

        return NextResponse.json({ success: result.outcome === "SUCCESS", ...result }, { status });

    } catch (err: any) {
        console.error("POST /api/emergency/reserve error:", err);
        return NextResponse.json(
            { success: false, error: "Internal server error", details: err?.message },
            { status: 500 }
        );
    }
}
