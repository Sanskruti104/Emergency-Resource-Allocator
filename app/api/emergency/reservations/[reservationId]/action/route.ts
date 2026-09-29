import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import {
    releaseReservation,
    confirmReservation,
    admitPatient,
    dischargePatient,
    rejectReservation,
    expireReservation
} from "@/lib/emergency/emergency-reservation";
import { z } from "zod";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
    action: z.enum(["release", "confirm", "admit", "discharge", "reject", "expire"])
});

/**
 * POST /api/emergency/reservations/[reservationId]/action
 *
 * Body: { action: "release" | "confirm" | "admit" | "discharge" | "reject" | "expire" }
 *
 * Enforces the state machine — invalid transitions are rejected.
 * - confirm: PENDING → CONFIRMED (en-route confirmation)
 * - admit: CONFIRMED/PENDING → ADMITTED (moves reserved → occupied)
 * - discharge: ADMITTED → DISCHARGED (moves occupied → available)
 * - release/expire: restores capacity to available
 * - reject: cancels and restores capacity
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ reservationId: string }> }
) {
    try {
        const { reservationId } = await params;

        if (!reservationId) {
            return NextResponse.json(
                { success: false, error: "reservationId is required" },
                { status: 400 }
            );
        }

        const body = await request.json();
        const parsed = actionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Invalid action", details: parsed.error.format() },
                { status: 422 }
            );
        }

        const client = await clientPromise;
        const db = client.db();
        const rParams = { reservationId };

        let result;
        switch (parsed.data.action) {
            case "release":
                result = await releaseReservation(rParams, db);
                break;
            case "confirm":
                result = await confirmReservation(rParams, db);
                if (result.outcome === "SUCCESS") {
                    const resv = await db.collection("reservations").findOne({ reservationId });
                    if (resv) {
                        const emg = await db.collection("emergencyRequests").findOne({ emergencyId: resv.emergencyId });
                        await db.collection("emergencyRequests").updateOne(
                            { emergencyId: resv.emergencyId },
                            {
                                $set: {
                                    receivingHospitalId: resv.hospitalId,
                                    allocatedHospitalId: resv.hospitalId,
                                    reservationId,
                                    updatedAt: new Date()
                                }
                            }
                        );
                        await db.collection("ambulances").updateMany(
                            {
                                $or: [
                                    { currentEmergencyId: resv.emergencyId },
                                    ...(emg?.ambulanceId ? [{ ambulanceId: emg.ambulanceId }] : [])
                                ]
                            },
                            {
                                $set: {
                                    destinationHospitalId: resv.hospitalId,
                                    updatedAt: new Date()
                                }
                            }
                        );
                    }
                }
                break;
            case "admit":
                result = await admitPatient(rParams, db);
                if (result.outcome === "SUCCESS") {
                    const resv = await db.collection("reservations").findOne({ reservationId });
                    if (resv) {
                        const now = new Date();
                        await db.collection("emergencyRequests").updateOne(
                            { emergencyId: resv.emergencyId },
                            {
                                $set: {
                                    status: "ADMITTED",
                                    handoffStatus: "COMPLETED",
                                    admittedAt: now,
                                    updatedAt: now
                                }
                            }
                        );
                        await db.collection("handoffs").updateMany(
                            { emergencyId: resv.emergencyId, status: { $ne: "COMPLETED" } },
                            {
                                $set: {
                                    status: "COMPLETED",
                                    handoffTime: now,
                                    updatedAt: now
                                }
                            }
                        );
                        const emg = await db.collection("emergencyRequests").findOne({ emergencyId: resv.emergencyId });
                        await db.collection("ambulances").updateMany(
                            {
                                $or: [
                                    { currentEmergencyId: resv.emergencyId },
                                    ...(emg?.ambulanceId ? [{ ambulanceId: emg.ambulanceId }] : [])
                                ]
                            },
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
                }
                break;
            case "discharge":
                result = await dischargePatient(rParams, db);
                break;
            case "reject":
                result = await rejectReservation(rParams, db);
                if (result.outcome === "SUCCESS") {
                    const resv = await db.collection("reservations").findOne({ reservationId });
                    if (resv) {
                        const emg = await db.collection("emergencyRequests").findOne({ emergencyId: resv.emergencyId });
                        await db.collection("emergencyRequests").updateOne(
                            { emergencyId: resv.emergencyId },
                            {
                                $set: {
                                    receivingHospitalId: null,
                                    allocatedHospitalId: null,
                                    updatedAt: new Date()
                                }
                            }
                        );
                        await db.collection("ambulances").updateMany(
                            {
                                $or: [
                                    { currentEmergencyId: resv.emergencyId },
                                    ...(emg?.ambulanceId ? [{ ambulanceId: emg.ambulanceId }] : [])
                                ]
                            },
                            {
                                $set: {
                                    destinationHospitalId: null,
                                    updatedAt: new Date()
                                }
                            }
                        );
                    }
                }
                break;
            case "expire":
                result = await expireReservation(rParams, db);
                break;
        }

        const status =
            result.outcome === "SUCCESS"          ? 200 :
            result.outcome === "INVALID_TRANSITION" ? 409 :
            result.outcome === "ALREADY_PROCESSED"  ? 409 :
            result.outcome === "RESERVATION_NOT_FOUND" ? 404 : 500;

        return NextResponse.json(
            { success: result.outcome === "SUCCESS", ...result },
            { status }
        );

    } catch (err: any) {
        console.error("POST /api/emergency/reservations/[id]/action error:", err);
        return NextResponse.json(
            { success: false, error: "Internal server error", details: err?.message },
            { status: 500 }
        );
    }
}
