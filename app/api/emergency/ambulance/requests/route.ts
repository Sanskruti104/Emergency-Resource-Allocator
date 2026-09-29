import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * GET /api/emergency/ambulance/requests
 * Returns pending emergency requests awaiting ambulance assignment,
 * along with the active mission for the specified ambulance.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const ambulanceId = searchParams.get("ambulanceId");

        const client = await clientPromise;
        const db = client.db();

        // 1. Fetch all pending emergency requests (newest first)
        const pendingRequests = await db.collection("emergencyRequests")
            .find({
                status: "PENDING",
                ...(ambulanceId ? { declinedAmbulanceIds: { $ne: ambulanceId } } : {})
            })
            .sort({ createdAt: -1 })
            .limit(20)
            .toArray();

        // 2. Fetch active mission for the operator's ambulance (if provided)
        let activeMission = null;
        let ambulanceDoc = null;

        if (ambulanceId) {
            ambulanceDoc = await db.collection("ambulances").findOne({ ambulanceId });

            if (ambulanceDoc && ambulanceDoc.currentEmergencyId) {
                activeMission = await db.collection("emergencyRequests").findOne({
                    emergencyId: ambulanceDoc.currentEmergencyId,
                    status: { $in: ["DISPATCHED", "ON_SCENE", "TRANSPORTING", "ARRIVED"] }
                });
            } else {
                // Also check if any emergency is assigned to this ambulance
                activeMission = await db.collection("emergencyRequests").findOne({
                    ambulanceId,
                    status: { $in: ["DISPATCHED", "ON_SCENE", "TRANSPORTING", "ARRIVED"] }
                });
            }
        }

        // 3. Fetch active reservation for the mission if one exists
        let activeReservation = null;
        let reservedHospital = null;

        if (activeMission) {
            activeReservation = await db.collection("reservations")
                .find({ emergencyId: activeMission.emergencyId })
                .sort({ createdAt: -1 })
                .limit(1)
                .next();

            if (activeReservation?.hospitalId) {
                reservedHospital = await db.collection("hospitals").findOne(
                    { $or: [{ hospitalId: activeReservation.hospitalId }, { uid: activeReservation.hospitalId }] },
                    { projection: { hospitalName: 1, hospitalId: 1, uid: 1, address: 1, contactNumber: 1, latitude: 1, longitude: 1, capacity: 1 } }
                );
            }
        }

        // 4. Fetch list of ambulances to allow operator to select their unit
        const ambulances = await db.collection("ambulances")
            .find({})
            .project({ ambulanceId: 1, callSign: 1, vehicleType: 1, status: 1, currentLocation: 1 })
            .sort({ ambulanceId: 1 })
            .toArray();

        return NextResponse.json({
            success: true,
            pendingRequests: pendingRequests.map(req => ({
                emergencyId: req.emergencyId,
                emergencyType: req.emergencyType,
                priority: req.priority,
                incidentLocation: req.incidentLocation,
                chiefComplaint: req.chiefComplaint,
                createdAt: req.createdAt,
                patient: {
                    age: req.patient?.age,
                    gender: req.patient?.gender,
                    name: req.patient?.name ? `${req.patient.name.charAt(0)}. Patient` : "Anonymous Patient", // Authorized HIPAA redaction
                },
                notes: req.notes,
            })),
            activeMission,
            activeReservation,
            reservedHospital,
            ambulance: ambulanceDoc,
            availableAmbulances: ambulances,
        });

    } catch (error: any) {
        console.error("GET /api/emergency/ambulance/requests error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to fetch ambulance requests" },
            { status: 500 }
        );
    }
}
