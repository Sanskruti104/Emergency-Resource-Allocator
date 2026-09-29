import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ambulanceActionSchema = z.object({
    emergencyId: z.string().min(1, "emergencyId is required"),
    ambulanceId: z.string().min(1, "ambulanceId is required"),
    action: z.enum(["ACCEPT", "DECLINE", "ARRIVED_SCENE", "PICKUP", "START_TRANSPORT", "ARRIVED_HOSPITAL"]),
});

/**
 * POST /api/emergency/ambulance/action
 * Handles ambulance lifecycle actions:
 * - ACCEPT: Ambulance unit claims emergency and transitions to EN_ROUTE_SCENE
 * - DECLINE: Ambulance declines request; request remains PENDING for other units
 * - ARRIVED_SCENE: Ambulance touches down at scene; transitions to ON_SCENE
 * - PICKUP: Paramedics secure patient in ambulance; transitions to TRANSPORTING
 * - START_TRANSPORT: Ambulance departs scene with patient; transitions to EN_ROUTE
 * - ARRIVED_HOSPITAL: Ambulance arrives at receiving hospital ED; transitions to ARRIVED
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = ambulanceActionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: parsed.error.format() },
                { status: 400 }
            );
        }

        const { emergencyId, ambulanceId, action } = parsed.data;
        const client = await clientPromise;
        const db = client.db();

        const now = new Date();

        switch (action) {
            case "ACCEPT": {
                // Concurrency safe conditional assignment: only assign if still PENDING
                const updatedRequest = await db.collection("emergencyRequests").findOneAndUpdate(
                    { emergencyId, status: "PENDING" },
                    {
                        $set: {
                            status: "DISPATCHED",
                            ambulanceId,
                            updatedAt: now,
                        }
                    },
                    { returnDocument: "after" }
                );

                if (!updatedRequest) {
                    return NextResponse.json(
                        { success: false, error: "Emergency is no longer pending or has already been accepted by another unit." },
                        { status: 409 }
                    );
                }

                // Update ambulance to EN_ROUTE_SCENE
                await db.collection("ambulances").updateOne(
                    { ambulanceId },
                    {
                        $set: {
                            status: "EN_ROUTE_SCENE",
                            currentEmergencyId: emergencyId,
                            ETA: 8, // Realistic simulated ETA in minutes
                            telemetrySource: "SIMULATION",
                            updatedAt: now,
                        }
                    },
                    { upsert: true }
                );

                // Record audit event
                await db.collection("hospitalEvents").insertOne({
                    eventId: `EVT-${Date.now().toString(36).toUpperCase()}`,
                    hospitalId: "DISPATCH-CENTRAL",
                    eventType: "CAPACITY_OVERRIDE",
                    emergencyId,
                    actorId: ambulanceId,
                    details: {
                        action: "AMBULANCE_ACCEPTED",
                        ambulanceId,
                        status: "EN_ROUTE_SCENE",
                    },
                    timestamp: now,
                });

                return NextResponse.json({
                    success: true,
                    message: `Ambulance ${ambulanceId} accepted emergency ${emergencyId}. En route to scene.`,
                    emergency: updatedRequest,
                    ambulanceStatus: "EN_ROUTE_SCENE",
                });
            }

            case "DECLINE": {
                // Add ambulance to declined list so operator won't see it again
                await db.collection("emergencyRequests").updateOne(
                    { emergencyId },
                    {
                        $addToSet: { declinedAmbulanceIds: ambulanceId },
                        $set: { updatedAt: now }
                    }
                );

                // Check if other available ambulances exist
                const availableCount = await db.collection("ambulances").countDocuments({
                    status: "AVAILABLE",
                    ambulanceId: { $ne: ambulanceId }
                });

                return NextResponse.json({
                    success: true,
                    message: `Emergency ${emergencyId} declined by ${ambulanceId}. Request returned to dispatch pool.`,
                    otherAmbulancesAvailable: availableCount > 0,
                    availableFleetCount: availableCount,
                });
            }

            case "ARRIVED_SCENE": {
                // Transition both emergency and ambulance to ON_SCENE
                const updatedRequest = await db.collection("emergencyRequests").findOneAndUpdate(
                    { emergencyId },
                    {
                        $set: {
                            status: "ON_SCENE",
                            updatedAt: now,
                        }
                    },
                    { returnDocument: "after" }
                );

                await db.collection("ambulances").updateOne(
                    { ambulanceId },
                    {
                        $set: {
                            status: "ON_SCENE",
                            ETA: 0,
                            updatedAt: now,
                        }
                    }
                );

                return NextResponse.json({
                    success: true,
                    message: `Ambulance ${ambulanceId} arrived at patient scene.`,
                    emergency: updatedRequest,
                    ambulanceStatus: "ON_SCENE",
                });
            }

            case "PICKUP": {
                // Transition both emergency and ambulance to TRANSPORTING
                // Hospital allocation will begin after this step per architecture requirements.
                const updatedRequest = await db.collection("emergencyRequests").findOneAndUpdate(
                    { emergencyId },
                    {
                        $set: {
                            status: "TRANSPORTING",
                            patientPickedUpAt: now,
                            updatedAt: now,
                        }
                    },
                    { returnDocument: "after" }
                );

                await db.collection("ambulances").updateOne(
                    { ambulanceId },
                    {
                        $set: {
                            status: "TRANSPORTING",
                            updatedAt: now,
                        }
                    }
                );

                return NextResponse.json({
                    success: true,
                    message: `Patient safely secured in ambulance ${ambulanceId}. Transport active.`,
                    emergency: updatedRequest,
                    ambulanceStatus: "TRANSPORTING",
                });
            }

            case "START_TRANSPORT": {
                // 1. Fetch current emergency and ambulance
                const emergencyDoc = await db.collection("emergencyRequests").findOne({ emergencyId });
                if (!emergencyDoc) {
                    return NextResponse.json(
                        { success: false, error: `Emergency ${emergencyId} not found.` },
                        { status: 404 }
                    );
                }

                // Validate mission belongs to this ambulance
                if (emergencyDoc.ambulanceId !== ambulanceId) {
                    return NextResponse.json(
                        { success: false, error: `Emergency ${emergencyId} is not assigned to ambulance ${ambulanceId}.` },
                        { status: 403 }
                    );
                }

                // 2. Validate latest reservation exists and is CONFIRMED
                const latestReservation = await db.collection("reservations")
                    .find({ emergencyId })
                    .sort({ createdAt: -1 })
                    .limit(1)
                    .next();

                if (!latestReservation || latestReservation.status !== "CONFIRMED") {
                    return NextResponse.json(
                        {
                            success: false,
                            outcome: "INVALID_TRANSITION",
                            error: "Cannot start transport: a hospital reservation must be CONFIRMED before transport."
                        },
                        { status: 409 }
                    );
                }

                // Validate destination hospital exists
                const ambDoc = await db.collection("ambulances").findOne({ ambulanceId });
                const destinationHospitalId = emergencyDoc.receivingHospitalId || ambDoc?.destinationHospitalId || latestReservation.hospitalId;
                if (!destinationHospitalId) {
                    return NextResponse.json(
                        { success: false, error: "Cannot start transport: destination hospital has not been confirmed." },
                        { status: 400 }
                    );
                }

                // 3. Concurrency check: prevent duplicate start transport
                if (emergencyDoc.transportStatus === "EN_ROUTE") {
                    return NextResponse.json(
                        {
                            success: false,
                            outcome: "ALREADY_PROCESSED",
                            error: "Ambulance is already en route to destination hospital."
                        },
                        { status: 409 }
                    );
                }
                if (emergencyDoc.status === "ARRIVED" || emergencyDoc.transportStatus === "ARRIVED") {
                    return NextResponse.json(
                        {
                            success: false,
                            outcome: "INVALID_TRANSITION",
                            error: "Ambulance has already arrived at receiving hospital."
                        },
                        { status: 409 }
                    );
                }

                // 4. Atomically transition emergencyRequest to EN_ROUTE
                const updatedRequest = await db.collection("emergencyRequests").findOneAndUpdate(
                    {
                        emergencyId,
                        ambulanceId,
                        transportStatus: { $ne: "EN_ROUTE" },
                        status: { $nin: ["ARRIVED", "HANDED_OFF", "CANCELLED"] }
                    },
                    {
                        $set: {
                            status: "TRANSPORTING",
                            transportStatus: "EN_ROUTE",
                            transportStartedAt: now,
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
                            error: "Ambulance transport has already been started or state is invalid."
                        },
                        { status: 409 }
                    );
                }

                // 5. Update ambulance record
                await db.collection("ambulances").updateOne(
                    { ambulanceId },
                    {
                        $set: {
                            status: "TRANSPORTING",
                            transportStatus: "EN_ROUTE",
                            destinationHospitalId,
                            speedKmH: 52,
                            ETA: 12,
                            updatedAt: now
                        }
                    }
                );

                // 6. Record audit event in hospitalEvents
                await db.collection("hospitalEvents").insertOne({
                    eventId: `EVT-${Date.now().toString(36).toUpperCase()}`,
                    hospitalId: destinationHospitalId,
                    eventType: "AMBULANCE_EN_ROUTE",
                    emergencyId,
                    reservationId: latestReservation.reservationId,
                    actorId: ambulanceId,
                    details: {
                        action: "START_TRANSPORT",
                        ambulanceId,
                        destinationHospitalId,
                        reservationId: latestReservation.reservationId,
                        status: "EN_ROUTE"
                    },
                    timestamp: now
                });

                return NextResponse.json({
                    success: true,
                    message: "Ambulance transport initiated. En route to receiving hospital.",
                    transportStatus: "EN_ROUTE",
                    emergency: updatedRequest,
                    ambulanceStatus: "TRANSPORTING"
                });
            }

            case "ARRIVED_HOSPITAL": {
                // 1. Fetch current emergency
                const emergencyDoc = await db.collection("emergencyRequests").findOne({ emergencyId });
                if (!emergencyDoc) {
                    return NextResponse.json(
                        { success: false, error: `Emergency ${emergencyId} not found.` },
                        { status: 404 }
                    );
                }

                // Validate mission belongs to this ambulance
                if (emergencyDoc.ambulanceId !== ambulanceId) {
                    return NextResponse.json(
                        { success: false, error: `Emergency ${emergencyId} is not assigned to ambulance ${ambulanceId}.` },
                        { status: 403 }
                    );
                }

                // 2. Validate current state: must be EN_ROUTE to arrive!
                if (emergencyDoc.status === "ARRIVED" || emergencyDoc.transportStatus === "ARRIVED") {
                    return NextResponse.json(
                        {
                            success: false,
                            outcome: "ALREADY_PROCESSED",
                            error: "Ambulance has already arrived at receiving hospital."
                        },
                        { status: 409 }
                    );
                }

                if (emergencyDoc.transportStatus !== "EN_ROUTE") {
                    return NextResponse.json(
                        {
                            success: false,
                            outcome: "INVALID_TRANSITION",
                            error: "Cannot mark arrived at hospital: ambulance must start transport first (must be EN_ROUTE)."
                        },
                        { status: 409 }
                    );
                }

                // 3. Atomically transition emergencyRequest to ARRIVED
                const updatedRequest = await db.collection("emergencyRequests").findOneAndUpdate(
                    {
                        emergencyId,
                        ambulanceId,
                        transportStatus: "EN_ROUTE"
                    },
                    {
                        $set: {
                            status: "ARRIVED",
                            transportStatus: "ARRIVED",
                            arrivedHospitalAt: now,
                            updatedAt: now
                        }
                    },
                    { returnDocument: "after" }
                );

                if (!updatedRequest) {
                    return NextResponse.json(
                        {
                            success: false,
                            outcome: "INVALID_TRANSITION",
                            error: "Arrival could not be recorded: emergency was not in EN_ROUTE state or was already processed."
                        },
                        { status: 409 }
                    );
                }

                // 4. Update ambulance record
                await db.collection("ambulances").updateOne(
                    { ambulanceId },
                    {
                        $set: {
                            status: "AT_HOSPITAL",
                            transportStatus: "ARRIVED",
                            speedKmH: 0,
                            ETA: 0,
                            updatedAt: now
                        }
                    }
                );

                // 5. Fetch reservation for audit log
                const latestReservation = await db.collection("reservations")
                    .find({ emergencyId })
                    .sort({ createdAt: -1 })
                    .limit(1)
                    .next();

                const destinationHospitalId = updatedRequest.receivingHospitalId || emergencyDoc.receivingHospitalId || "DISPATCH-CENTRAL";

                // 6. Record audit event in hospitalEvents
                await db.collection("hospitalEvents").insertOne({
                    eventId: `EVT-${Date.now().toString(36).toUpperCase()}`,
                    hospitalId: destinationHospitalId,
                    eventType: "AMBULANCE_ARRIVED",
                    emergencyId,
                    reservationId: latestReservation?.reservationId || null,
                    actorId: ambulanceId,
                    details: {
                        action: "ARRIVED_HOSPITAL",
                        ambulanceId,
                        destinationHospitalId,
                        reservationId: latestReservation?.reservationId || null,
                        status: "ARRIVED"
                    },
                    timestamp: now
                });

                return NextResponse.json({
                    success: true,
                    message: "Ambulance arrived at receiving hospital Emergency Department.",
                    transportStatus: "ARRIVED",
                    emergency: updatedRequest,
                    ambulanceStatus: "AT_HOSPITAL"
                });
            }
        }

    } catch (error: any) {
        console.error("POST /api/emergency/ambulance/action error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to process ambulance action" },
            { status: 500 }
        );
    }
}
