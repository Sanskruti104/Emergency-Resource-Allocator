import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * GET /api/emergency/active
 *
 * Realtime query endpoint for the Emergency Dispatcher Dashboard
 * and Hospital Emergency Board.
 * Returns live MongoDB records without mocks.
 */
export async function GET(request: Request) {
    try {
        const client = await clientPromise;
        const db = client.db();

        const { searchParams } = new URL(request.url);
        const hospitalId = searchParams.get("hospitalId");

        // 1. Fetch ALL Operational Hospitals (always return all operational hospitals for multi-hospital switching)
        const allHospitals = await db.collection("hospitals")
            .find({})
            .sort({ hospitalName: 1 })
            .toArray();

        // 2. Identify the target hospital if hospitalId is specified
        const targetHospital = hospitalId
            ? allHospitals.find(h => (h.uid && h.uid === hospitalId) || (h.hospitalId && h.hospitalId === hospitalId))
            : null;

        // Build alias set for matching
        const targetHospitalIds = new Set<string>();
        if (hospitalId) targetHospitalIds.add(hospitalId);
        if (targetHospital?.uid) targetHospitalIds.add(targetHospital.uid);
        if (targetHospital?.hospitalId) targetHospitalIds.add(targetHospital.hospitalId);
        const hospitalIdsArray = Array.from(targetHospitalIds);

        // 3. Fetch Reservations (filtered by selected hospital if provided)
        const resFilter = hospitalIdsArray.length > 0 ? { hospitalId: { $in: hospitalIdsArray } } : {};
        const reservations = await db.collection("reservations")
            .find(resFilter)
            .sort({ createdAt: -1 })
            .limit(20)
            .toArray();

        const resEmergencyIds = reservations.map(r => r.emergencyId).filter(Boolean);

        // 4. Fetch Recent Emergency Requests (filtered by selected hospital if provided)
        const emergencyFilter = hospitalIdsArray.length > 0 ? {
            $or: [
                { allocatedHospitalId: { $in: hospitalIdsArray } },
                { receivingHospitalId: { $in: hospitalIdsArray } },
                { emergencyId: { $in: resEmergencyIds } }
            ]
        } : {};
        const emergencies = await db.collection("emergencyRequests")
            .find(emergencyFilter)
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(20)
            .toArray();

        // 5. Fetch Ambulances (heading to or linked with selected hospital)
        const ambEmergencyIds = emergencies.map(e => e.emergencyId).filter(Boolean);
        const ambulanceFilter = hospitalIdsArray.length > 0 ? {
            $or: [
                { destinationHospitalId: { $in: hospitalIdsArray } },
                { currentEmergencyId: { $in: ambEmergencyIds } }
            ]
        } : {};
        const ambulances = await db.collection("ambulances")
            .find(ambulanceFilter)
            .sort({ updatedAt: -1 })
            .limit(20)
            .toArray();

        // 6. Fetch Handoffs
        const handoffFilter = hospitalIdsArray.length > 0 ? { hospitalId: { $in: hospitalIdsArray } } : {};
        const handoffs = await db.collection("handoffs")
            .find(handoffFilter)
            .sort({ createdAt: -1 })
            .limit(20)
            .toArray();

        // 7. Fetch Recent Events
        const eventFilter = hospitalIdsArray.length > 0 ? { hospitalId: { $in: hospitalIdsArray } } : {};
        const events = await db.collection("hospitalEvents")
            .find(eventFilter)
            .sort({ timestamp: -1 })
            .limit(25)
            .toArray();

        const responsePayload = {
            success: true,
            timestamp: new Date().toISOString(),
            hospitals: allHospitals,
            selectedHospitalId: targetHospital?.uid || targetHospital?.hospitalId || hospitalId || null,
            selectedHospital: targetHospital || null,
            emergencies,
            ambulances,
            reservations,
            handoffs,
            events,
            data: {
                timestamp: new Date().toISOString(),
                hospitals: allHospitals,
                selectedHospitalId: targetHospital?.uid || targetHospital?.hospitalId || hospitalId || null,
                selectedHospital: targetHospital || null,
                emergencies,
                ambulances,
                reservations,
                handoffs,
                events
            }
        };

        return NextResponse.json(responsePayload);

    } catch (err: any) {
        console.error("GET /api/emergency/active error:", err);
        return NextResponse.json(
            { success: false, error: "Failed to fetch active emergency data", details: err?.message },
            { status: 500 }
        );
    }
}
