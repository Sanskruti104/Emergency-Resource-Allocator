import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { classifyEmergencyTriage } from "@/lib/emergency/triage-intake";
import { EmergencyRequest, EmergencyType, TriagePriority } from "@/lib/emergency/emergency-types";
import { z } from "zod";

export const dynamic = "force-dynamic";

const VALID_EMERGENCY_TYPES: [EmergencyType, ...EmergencyType[]] = [
    "CARDIAC",
    "TRAUMA",
    "STROKE",
    "RESPIRATORY",
    "PEDIATRIC",
    "OBSTETRIC",
    "GENERAL"
];

const emergencyRequestSchema = z.object({
    emergencyType: z.enum(VALID_EMERGENCY_TYPES),
    chiefComplaint: z.string().min(2, "Chief complaint is required (at least 2 characters)"),
    incidentLocation: z.object({
        latitude: z.coerce.number().min(-90).max(90),
        longitude: z.coerce.number().min(-180).max(180),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        isSimulated: z.boolean().optional(),
    }),
    vitals: z.object({
        sbp: z.coerce.number().optional(),
        heartRate: z.coerce.number().optional(),
        spo2: z.coerce.number().optional(),
        gcs: z.coerce.number().optional(),
    }).optional(),
    patient: z.object({
        name: z.string().optional(),
        contactNumber: z.string().optional(),
        age: z.coerce.number().optional(),
        gender: z.enum(["male", "female", "other", "unknown"]).optional(),
    }).optional(),
});

/**
 * POST /api/emergency/request
 * Patient submits an emergency assistance request for ambulance dispatch.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = emergencyRequestSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Validation failed", details: parsed.error.format() },
                { status: 400 }
            );
        }

        const data = parsed.data;
        const client = await clientPromise;
        const db = client.db();

        // 1. Prevent accidental duplicate submissions (within last 15 seconds from same location/complaint)
        const fifteenSecAgo = new Date(Date.now() - 15000);
        const duplicate = await db.collection("emergencyRequests").findOne({
            chiefComplaint: data.chiefComplaint.trim(),
            "incidentLocation.latitude": Number(data.incidentLocation.latitude),
            "incidentLocation.longitude": Number(data.incidentLocation.longitude),
            createdAt: { $gte: fifteenSecAgo },
            status: { $in: ["PENDING", "DISPATCHED", "ON_SCENE"] }
        });

        if (duplicate) {
            return NextResponse.json({
                success: true,
                message: "Active emergency already in progress for this location.",
                emergencyId: duplicate.emergencyId,
                emergency: duplicate,
                isDuplicate: true
            }, { status: 200 });
        }

        // 2. Clinical triage evaluation using existing rules
        const triage = classifyEmergencyTriage(
            data.emergencyType,
            data.chiefComplaint,
            data.vitals
        );

        // 3. Generate unique Emergency Request ID
        const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomCode = Math.floor(1000 + Math.random() * 9000);
        const emergencyId = `EMG-${datePrefix}-${randomCode}`;

        const now = new Date();
        const newEmergency: EmergencyRequest & { isSimulatedLocation?: boolean } = {
            emergencyId,
            ambulanceId: null,
            emergencyType: data.emergencyType,
            priority: triage.priority,
            incidentLocation: {
                latitude: Number(data.incidentLocation.latitude),
                longitude: Number(data.incidentLocation.longitude),
                address: data.incidentLocation.address || "Patient Current Location",
                city: data.incidentLocation.city || "Pune",
                state: data.incidentLocation.state || "Maharashtra",
            },
            vitals: data.vitals,
            chiefComplaint: data.chiefComplaint.trim(),
            condition: data.emergencyType.toLowerCase(),
            requiredSpecialty: triage.requiredSpecialty,
            requiredResources: triage.requiredResources,
            allocatedHospitalId: null,
            reservationId: null,
            status: "PENDING",
            patient: {
                name: data.patient?.name,
                contactNumber: data.patient?.contactNumber,
                age: data.patient?.age,
                gender: data.patient?.gender || "unknown",
            },
            source: "MANUAL_INTAKE",
            notes: data.incidentLocation.isSimulated
                ? "[SIMULATED LOCATION] Coordinates provided via simulation preset."
                : (triage.criticalFlags.length > 0 ? `Clinical Alerts: ${triage.criticalFlags.join("; ")}` : undefined),
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection("emergencyRequests").insertOne(newEmergency);

        if (!result.acknowledged) {
            throw new Error("Failed to persist emergency request in database.");
        }

        // Record audit event
        await db.collection("hospitalEvents").insertOne({
            eventId: `EVT-${Date.now().toString(36).toUpperCase()}`,
            hospitalId: "DISPATCH-CENTRAL",
            eventType: "CAPACITY_OVERRIDE",
            emergencyId,
            details: {
                action: "PATIENT_REQUESTED_AMBULANCE",
                emergencyType: data.emergencyType,
                priority: triage.priority,
                isSimulatedLocation: !!data.incidentLocation.isSimulated,
            },
            timestamp: now,
        });

        return NextResponse.json({
            success: true,
            message: "Emergency request created successfully. Awaiting ambulance dispatch.",
            emergencyId,
            emergency: newEmergency
        }, { status: 201 });

    } catch (error: any) {
        console.error("POST /api/emergency/request error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/emergency/request
 * Query active emergency request status by emergencyId for real-time patient timeline updates.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const emergencyId = searchParams.get("emergencyId");

        if (!emergencyId) {
            return NextResponse.json(
                { success: false, error: "emergencyId query parameter is required" },
                { status: 400 }
            );
        }

        const client = await clientPromise;
        const db = client.db();

        const emergency = await db.collection("emergencyRequests").findOne({ emergencyId });

        if (!emergency) {
            return NextResponse.json(
                { success: false, error: `Emergency ${emergencyId} not found` },
                { status: 404 }
            );
        }

        // If an ambulance has been assigned, fetch live ambulance details
        let ambulance = null;
        if (emergency.ambulanceId) {
            ambulance = await db.collection("ambulances").findOne({ ambulanceId: emergency.ambulanceId });
        }

        // Determine timeline stage
        // REQUESTED → ASSIGNING AMBULANCE → AMBULANCE ACCEPTED → EN ROUTE → ARRIVED → PATIENT PICKED UP
        let timelineStep = "REQUESTED";
        if (emergency.status === "PENDING") {
            timelineStep = "ASSIGNING_AMBULANCE";
        } else if (emergency.status === "DISPATCHED") {
            if (ambulance && ambulance.status === "EN_ROUTE_SCENE") {
                timelineStep = "EN_ROUTE";
            } else {
                timelineStep = "AMBULANCE_ACCEPTED";
            }
        } else if (emergency.status === "ON_SCENE") {
            timelineStep = "ARRIVED";
        } else if (emergency.status === "TRANSPORTING" || emergency.status === "ARRIVED" || emergency.status === "HANDED_OFF" || emergency.status === "ADMITTED") {
            timelineStep = "PATIENT_PICKED_UP";
        }

        let receivingHospitalName = null;
        const targetHospId = emergency.receivingHospitalId || emergency.allocatedHospitalId;
        if (targetHospId) {
            const h = await db.collection("hospitals").findOne(
                { $or: [{ uid: targetHospId }, { hospitalId: targetHospId }] },
                { projection: { hospitalName: 1 } }
            );
            if (h) receivingHospitalName = h.hospitalName;
        }

        return NextResponse.json({
            success: true,
            emergency: {
                ...emergency,
                receivingHospitalName,
            },
            ambulance: ambulance ? {
                ambulanceId: ambulance.ambulanceId,
                callSign: ambulance.callSign,
                vehicleType: ambulance.vehicleType,
                status: ambulance.status,
                transportStatus: ambulance.transportStatus,
                handoffStatus: ambulance.handoffStatus,
                currentLocation: ambulance.currentLocation,
                ETA: ambulance.ETA,
                assignedCrew: ambulance.assignedCrew,
                telemetrySource: ambulance.telemetrySource || "SIMULATION",
            } : null,
            timelineStep,
        });

    } catch (error: any) {
        console.error("GET /api/emergency/request error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
