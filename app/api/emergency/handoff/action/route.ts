import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { admitPatient } from "@/lib/emergency/emergency-reservation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const handoffActionSchema = z.object({
    emergencyId: z.string().min(1, "emergencyId is required"),
    action: z.enum(["START_HANDOFF", "COMPLETE_HANDOFF"]),
    hospitalId: z.string().min(1, "hospitalId is required"),
    ambulanceId: z.string().optional(),
    reservationId: z.string().optional(),
    notes: z.string().optional(),
    receivingStaffId: z.string().optional(),
    receivingDoctorName: z.string().optional(),
});

/**
 * POST /api/emergency/handoff/action
 *
 * Implements Phase 3B lifecycle:
 * - START_HANDOFF:
 *   Validates ARRIVED state, CONFIRMED reservation, destination hospital match,
 *   sets handoff to IN_PROGRESS, preserves hospital capacity untouched,
 *   records HANDOFF_STARTED audit event.
 *
 * - COMPLETE_HANDOFF:
 *   Validates IN_PROGRESS handoff, CONFIRMED reservation, atomically transitions
 *   hospital capacity (reserved -= quantity, occupied += quantity, available unchanged),
 *   sets emergency to ADMITTED, handoff to COMPLETED, releases ambulance to AVAILABLE,
 *   records HANDOFF_COMPLETED and PATIENT_ADMITTED audit events.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = handoffActionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: parsed.error.format() },
                { status: 400 }
            );
        }

        const {
            emergencyId,
            action,
            hospitalId,
            ambulanceId,
            reservationId,
            notes,
            receivingStaffId,
            receivingDoctorName,
        } = parsed.data;

        const client = await clientPromise;
        const db = client.db();
        const now = new Date();

        // 1. Fetch current emergency request
        const emergencyDoc = await db.collection("emergencyRequests").findOne({ emergencyId });
        if (!emergencyDoc) {
            return NextResponse.json(
                { success: false, error: `Emergency ${emergencyId} not found.` },
                { status: 404 }
            );
        }

        // 2. Resolve active reservation
        let latestReservation: any = null;
        if (reservationId) {
            latestReservation = await db.collection("reservations").findOne({ reservationId });
        }
        if (!latestReservation) {
            latestReservation = await db.collection("reservations")
                .find({ emergencyId })
                .sort({ createdAt: -1 })
                .limit(1)
                .next();
        }

        // 3. Hospital authorization / association check
        const targetHospitalId = emergencyDoc.receivingHospitalId || emergencyDoc.allocatedHospitalId || latestReservation?.hospitalId;
        const hospitalMatches =
            hospitalId === targetHospitalId ||
            (latestReservation && hospitalId === latestReservation.hospitalId);

        if (!hospitalMatches) {
            return NextResponse.json(
                {
                    success: false,
                    outcome: "FORBIDDEN",
                    error: `Hospital ${hospitalId} is not authorized for emergency ${emergencyId} (assigned to ${targetHospitalId}).`
                },
                { status: 403 }
            );
        }

        // 4. Ambulance association check (if ambulanceId provided)
        if (ambulanceId && emergencyDoc.ambulanceId !== ambulanceId) {
            return NextResponse.json(
                {
                    success: false,
                    outcome: "FORBIDDEN",
                    error: `Ambulance ${ambulanceId} is not assigned to emergency ${emergencyId} (assigned: ${emergencyDoc.ambulanceId || "NONE"}).`
                },
                { status: 403 }
            );
        }

        // ---------------------------------------------------------------------
        // ACTION: START_HANDOFF
        // ---------------------------------------------------------------------
        if (action === "START_HANDOFF") {
            // Must be ARRIVED
            const isArrived =
                emergencyDoc.status === "ARRIVED" ||
                emergencyDoc.transportStatus === "ARRIVED";

            if (!isArrived) {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "INVALID_TRANSITION",
                        error: `Cannot start handoff: emergency status must be ARRIVED (current status: ${emergencyDoc.status}, transportStatus: ${emergencyDoc.transportStatus}).`
                    },
                    { status: 409 }
                );
            }

            // Check if already in terminal / admitted state
            if (emergencyDoc.status === "ADMITTED" || emergencyDoc.status === "HANDED_OFF" || emergencyDoc.status === "CANCELLED") {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "ALREADY_PROCESSED",
                        error: `Cannot start handoff: emergency is already in terminal state: ${emergencyDoc.status}.`
                    },
                    { status: 409 }
                );
            }

            // Duplicate protection: handoff already in progress
            if (emergencyDoc.handoffStatus === "IN_PROGRESS") {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "ALREADY_PROCESSED",
                        error: "Handoff is already in progress for this emergency."
                    },
                    { status: 409 }
                );
            }

            // Reservation must be CONFIRMED
            if (!latestReservation || latestReservation.status !== "CONFIRMED") {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "INVALID_TRANSITION",
                        error: `Cannot start handoff: hospital reservation must be CONFIRMED (current status: ${latestReservation?.status || "NONE"}).`
                    },
                    { status: 409 }
                );
            }

            // Atomic update on emergencyRequests: guard against concurrent duplicate start handoff
            const updatedRequest = await db.collection("emergencyRequests").findOneAndUpdate(
                {
                    emergencyId,
                    status: "ARRIVED",
                    handoffStatus: { $ne: "IN_PROGRESS" }
                },
                {
                    $set: {
                        handoffStatus: "IN_PROGRESS",
                        updatedAt: now
                    }
                },
                { returnDocument: "after" }
            );

            if (!updatedRequest) {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "ALREADY_PROCESSED",
                        error: "Handoff is already in progress or emergency is no longer in ARRIVED state."
                    },
                    { status: 409 }
                );
            }

            // Persist handoff document in handoffs collection
            const handoffId = `HND-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            await db.collection("handoffs").insertOne({
                handoffId,
                emergencyId,
                ambulanceId: emergencyDoc.ambulanceId || ambulanceId || "UNKNOWN",
                hospitalId,
                reservationId: latestReservation.reservationId,
                arrivalTime: emergencyDoc.arrivedHospitalAt || now,
                handoffStartTime: now,
                status: "IN_PROGRESS",
                clinicalNotes: notes || "Patient handoff initiated at emergency department.",
                createdAt: now,
                updatedAt: now
            });

            // Update ambulance: keeps status AT_HOSPITAL, reflects handoffStatus IN_PROGRESS
            if (emergencyDoc.ambulanceId) {
                await db.collection("ambulances").updateOne(
                    { ambulanceId: emergencyDoc.ambulanceId },
                    {
                        $set: {
                            status: "AT_HOSPITAL",
                            transportStatus: "ARRIVED",
                            handoffStatus: "IN_PROGRESS",
                            updatedAt: now
                        }
                    }
                );
            }

            // Audit event in hospitalEvents
            await db.collection("hospitalEvents").insertOne({
                eventId: `EVT-${Date.now().toString(36).toUpperCase()}`,
                hospitalId,
                eventType: "HANDOFF_STARTED",
                emergencyId,
                reservationId: latestReservation.reservationId,
                actorId: hospitalId,
                details: {
                    action: "START_HANDOFF",
                    handoffId,
                    emergencyId,
                    ambulanceId: emergencyDoc.ambulanceId,
                    reservationId: latestReservation.reservationId,
                    status: "IN_PROGRESS"
                },
                timestamp: now
            });

            return NextResponse.json({
                success: true,
                message: "Handoff initiated. Patient handoff is in progress.",
                handoffStatus: "IN_PROGRESS",
                handoffId,
                emergency: updatedRequest,
                reservation: latestReservation
            });
        }

        // ---------------------------------------------------------------------
        // ACTION: COMPLETE_HANDOFF
        // ---------------------------------------------------------------------
        if (action === "COMPLETE_HANDOFF") {
            // Must have arrived
            const isArrived =
                emergencyDoc.status === "ARRIVED" ||
                emergencyDoc.transportStatus === "ARRIVED" ||
                emergencyDoc.status === "ADMITTED";

            if (!isArrived) {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "INVALID_TRANSITION",
                        error: `Cannot complete handoff: emergency status must be ARRIVED (current status: ${emergencyDoc.status}).`
                    },
                    { status: 409 }
                );
            }

            // Check if already completed / admitted
            if (emergencyDoc.status === "ADMITTED" || emergencyDoc.handoffStatus === "COMPLETED") {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "ALREADY_PROCESSED",
                        error: "Handoff has already been completed and patient admitted."
                    },
                    { status: 409 }
                );
            }

            // Must be IN_PROGRESS (cannot complete before starting handoff)
            if (emergencyDoc.handoffStatus !== "IN_PROGRESS") {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "INVALID_TRANSITION",
                        error: "Cannot complete handoff: handoff must be in progress (START HANDOFF must be executed first)."
                    },
                    { status: 409 }
                );
            }

            // Must have a valid reservation
            if (!latestReservation) {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "INVALID_TRANSITION",
                        error: "No active reservation found for this emergency."
                    },
                    { status: 404 }
                );
            }

            if (latestReservation.status === "ADMITTED") {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "ALREADY_PROCESSED",
                        error: `Reservation ${latestReservation.reservationId} is already admitted.`
                    },
                    { status: 409 }
                );
            }

            if (latestReservation.status !== "CONFIRMED") {
                return NextResponse.json(
                    {
                        success: false,
                        outcome: "INVALID_TRANSITION",
                        error: `Cannot complete handoff: reservation must be CONFIRMED (current status: ${latestReservation.status}).`
                    },
                    { status: 409 }
                );
            }

            // ATOMIC STEP: Admit patient and mutate capacity
            // Transfers reserved -> occupied atomically. Available remains unchanged!
            const admitResult = await admitPatient({ reservationId: latestReservation.reservationId }, db);

            if (admitResult.outcome !== "SUCCESS") {
                const status =
                    admitResult.outcome === "ALREADY_PROCESSED" ? 409 :
                    admitResult.outcome === "INVALID_TRANSITION" ? 409 :
                    admitResult.outcome === "RESERVATION_NOT_FOUND" ? 404 : 500;

                return NextResponse.json(
                    {
                        success: false,
                        outcome: admitResult.outcome,
                        error: admitResult.message
                    },
                    { status }
                );
            }

            // 1. Update emergency request to ADMITTED
            const updatedEmergency = await db.collection("emergencyRequests").findOneAndUpdate(
                { emergencyId },
                {
                    $set: {
                        status: "ADMITTED",
                        handoffStatus: "COMPLETED",
                        admittedAt: now,
                        updatedAt: now
                    }
                },
                { returnDocument: "after" }
            );

            // 2. Update handoff document to COMPLETED
            await db.collection("handoffs").updateMany(
                { emergencyId, status: { $ne: "COMPLETED" } },
                {
                    $set: {
                        status: "COMPLETED",
                        handoffTime: now,
                        receivingDoctorName: receivingDoctorName || "ED Attending Physician",
                        receivingStaffId: receivingStaffId || null,
                        clinicalNotes: notes || "Patient admitted to receiving department. Handoff completed.",
                        updatedAt: now
                    }
                }
            );

            // 3. Release Ambulance ONLY after successful admission (Requirement 6)
            if (emergencyDoc.ambulanceId) {
                await db.collection("ambulances").updateOne(
                    { ambulanceId: emergencyDoc.ambulanceId },
                    {
                        $set: {
                            status: "AVAILABLE",
                            transportStatus: null,
                            handoffStatus: null,
                            currentEmergencyId: null,
                            destinationHospitalId: null,
                            speedKmH: 0,
                            ETA: null,
                            updatedAt: now
                        }
                    }
                );
            }

            // 4. Audit event in hospitalEvents
            await db.collection("hospitalEvents").insertOne({
                eventId: `EVT-${Date.now().toString(36).toUpperCase()}`,
                hospitalId,
                eventType: "HANDOFF_COMPLETED",
                emergencyId,
                reservationId: latestReservation.reservationId,
                actorId: hospitalId,
                details: {
                    action: "COMPLETE_HANDOFF",
                    emergencyId,
                    ambulanceId: emergencyDoc.ambulanceId,
                    reservationId: latestReservation.reservationId,
                    resourceType: latestReservation.resourceType,
                    quantity: latestReservation.quantity,
                    status: "COMPLETED"
                },
                timestamp: now
            });

            return NextResponse.json({
                success: true,
                message: "Handoff completed and patient successfully admitted to receiving hospital.",
                status: "ADMITTED",
                handoffStatus: "COMPLETED",
                emergency: updatedEmergency,
                ambulanceReleased: Boolean(emergencyDoc.ambulanceId)
            });
        }

        return NextResponse.json(
            { success: false, error: `Unsupported action: ${action}` },
            { status: 400 }
        );

    } catch (error: any) {
        console.error("POST /api/emergency/handoff/action error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to process handoff action" },
            { status: 500 }
        );
    }
}
