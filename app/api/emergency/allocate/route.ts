import { NextResponse } from "next/server";
import { allocateEmergencyHospital, AllocatorInput } from "@/lib/emergency/emergency-allocator";
import { emergencyIntakeSchema } from "@/lib/emergency/triage-intake";

export const dynamic = "force-dynamic";

/**
 * POST /api/emergency/allocate
 * Evaluates candidate hospitals against real-time emergency clinical intake,
 * computing capability fit, travel ETA, telemetry freshness, and resilience.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();

        // 1. If payload contains an inline intake object or flat intake fields, optionally validate with schema
        const hasDirectIntake = body.condition && body.chiefComplaint;
        const hasNestedIntake = body.intake && body.intake.condition;

        if (!body.emergencyId && !hasDirectIntake && !hasNestedIntake) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Invalid request payload. Must provide either 'emergencyId' or emergency intake details ('condition', 'chiefComplaint', 'incidentLocation')."
                },
                { status: 400 }
            );
        }

        // Validate intake if provided directly
        if (hasDirectIntake) {
            const validation = emergencyIntakeSchema.safeParse({
                condition: body.condition,
                chiefComplaint: body.chiefComplaint,
                age: body.age,
                gender: body.gender,
                sbp: body.vitals?.sbp ?? body.sbp,
                heartRate: body.vitals?.heartRate ?? body.heartRate,
                spo2: body.vitals?.spo2 ?? body.spo2,
                gcs: body.vitals?.gcs ?? body.gcs,
                triagePriority: body.priority ?? body.triagePriority,
                latitude: body.incidentLocation?.latitude ?? body.latitude,
                longitude: body.incidentLocation?.longitude ?? body.longitude,
                address: body.incidentLocation?.address ?? body.address,
                notes: body.notes
            });

            if (!validation.success) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Validation failed on emergency intake",
                        details: validation.error.format()
                    },
                    { status: 422 }
                );
            }
        }

        // 2. Prepare allocator input
        const allocatorInput: AllocatorInput = {
            emergencyId: body.emergencyId,
            intake: body.intake,
            condition: body.condition,
            chiefComplaint: body.chiefComplaint,
            priority: body.priority,
            requiredSpecialty: body.requiredSpecialty,
            requiredResources: body.requiredResources,
            incidentLocation: body.incidentLocation || (body.latitude && body.longitude ? {
                latitude: Number(body.latitude),
                longitude: Number(body.longitude),
                address: body.address
            } : undefined),
            vitals: body.vitals || (body.sbp || body.spo2 || body.heartRate || body.gcs ? {
                sbp: body.sbp,
                heartRate: body.heartRate,
                spo2: body.spo2,
                gcs: body.gcs
            } : undefined),
            candidateHospitals: body.candidateHospitals
        };

        // 3. Execute matching and ranking engine
        const result = await allocateEmergencyHospital(allocatorInput);

        // 4. Return explainable response
        return NextResponse.json(result, { status: 200 });

    } catch (error: any) {
        console.error("POST /api/emergency/allocate error:", error);
        return NextResponse.json(
            {
                success: false,
                error: "Emergency allocation engine encountered an unhandled error.",
                details: error?.message || String(error)
            },
            { status: 500 }
        );
    }
}
