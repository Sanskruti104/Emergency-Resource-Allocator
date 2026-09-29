import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { z } from "zod";
import {
    SCENARIO_CONFIGS,
    SimulationScenario,
    runSimulation
} from "@/lib/emergency/ems-simulator";
import { classifyEmergencyTriage } from "@/lib/emergency/triage-intake";
import { EmergencyRequest } from "@/lib/emergency/emergency-types";

export const dynamic = "force-dynamic";

const scenarioSchema = z.object({
    scenario: z.enum([
        "JUDGE_DEMO_CARDIAC",
        "NORMAL_CARDIAC",
        "TRAUMA",
        "STROKE",
        "ICU_SCARCITY",
        "STALE_HOSPITAL_DATA",
        "NO_SUITABLE_HOSPITAL"
    ])
});

const SCENARIO_LABELS: Record<SimulationScenario, { name: string; description: string; expectedFlow: string }> = {
    JUDGE_DEMO_CARDIAC: {
        name: "Primary Judge Demo — Cardiac Emergency",
        description: "Emergency requiring cardiology, Cath Lab, ICU & Ventilator. Demonstrates nearest-unsuitable rejection vs. farther-suitable selection.",
        expectedFlow: "Nearest unsuitable facility rejected → Farther equipped hospital selected → Reservation → Acceptance → Transport → Arrival → Handoff → Admission"
    },
    NORMAL_CARDIAC: {
        name: "Cardiac Emergency",
        description: "Emergency requiring cardiology, ICU capacity and cardiac resources.",
        expectedFlow: "Emergency → Allocation → Reservation → Acceptance → Transport → Arrival → Handoff → Admission"
    },
    TRAUMA: {
        name: "Trauma Emergency",
        description: "Trauma patient requiring trauma care and critical-care resources.",
        expectedFlow: "Emergency → Allocation → Reservation → Acceptance → Transport → Arrival → Handoff → Admission"
    },
    STROKE: {
        name: "Stroke Emergency",
        description: "Stroke patient requiring neurology and imaging capabilities.",
        expectedFlow: "Emergency → Allocation → Reservation → Acceptance → Transport → Arrival → Handoff → Admission"
    },
    ICU_SCARCITY: {
        name: "ICU Scarcity",
        description: "Demonstrates what happens when required ICU capacity is unavailable.",
        expectedFlow: "No suitable hospital · No reservation · No transport · Capacity unchanged"
    },
    STALE_HOSPITAL_DATA: {
        name: "Stale Hospital Data",
        description: "Demonstrates how stale hospital telemetry affects allocation.",
        expectedFlow: "Fresh facility preferred by allocator over stale facility"
    },
    NO_SUITABLE_HOSPITAL: {
        name: "No Suitable Hospital",
        description: "Demonstrates safe clinical diversion when no facility satisfies mandatory requirements.",
        expectedFlow: "Safe clinical diversion · Zero false assignments · Capacity unchanged"
    }
};

/**
 * GET /api/demo/scenario
 * Fetches the currently active demo scenario, if any.
 */
export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db();

        const latest = await db.collection("emergencyRequests")
            .find({
                $or: [
                    { isDemo: true },
                    { source: "EMS_SIMULATION" },
                    { emergencyId: { $regex: "^DEMO-" } }
                ]
            })
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(1)
            .next();

        if (!latest) {
            return NextResponse.json({ success: true, activeScenario: null });
        }

        // Fetch associated reservation if any
        const reservation = await db.collection("reservations")
            .find({ emergencyId: latest.emergencyId })
            .sort({ createdAt: -1 })
            .limit(1)
            .next();

        // Fetch receiving hospital details if assigned
        let hospital = null;
        const hospId = latest.receivingHospitalId || latest.allocatedHospitalId || reservation?.hospitalId;
        if (hospId) {
            hospital = await db.collection("hospitals").findOne(
                { $or: [{ uid: hospId }, { hospitalId: hospId }] },
                { projection: { hospitalName: 1, uid: 1, hospitalId: 1, address: 1 } }
            );
        }

        // Fetch ambulance details
        let ambulance = null;
        if (latest.ambulanceId) {
            ambulance = await db.collection("ambulances").findOne(
                { ambulanceId: latest.ambulanceId },
                { projection: { ambulanceId: 1, status: 1, transportStatus: 1, handoffStatus: 1 } }
            );
        }

        const scenarioKey = (latest.notes?.match(/\[(?:DEMO|SIMULATION):([A-Z_]+)\]/)?.[1] as SimulationScenario) || "NORMAL_CARDIAC";
        const meta = SCENARIO_LABELS[scenarioKey] || {
            name: latest.emergencyType + " Emergency",
            description: latest.chiefComplaint || "Emergency demo",
            expectedFlow: "Full operational lifecycle"
        };

        const activeScenario = {
            emergencyId: latest.emergencyId,
            scenario: scenarioKey,
            scenarioName: meta.name,
            scenarioDescription: meta.description,
            expectedFlow: meta.expectedFlow,
            emergencyType: latest.emergencyType,
            priority: latest.priority,
            status: latest.status,
            transportStatus: latest.transportStatus || ambulance?.transportStatus || null,
            handoffStatus: latest.handoffStatus || ambulance?.handoffStatus || null,
            ambulanceId: latest.ambulanceId || "AMB-PUNE-01",
            hospitalId: hospId || null,
            hospitalName: hospital?.hospitalName || null,
            reservationId: reservation?.reservationId || null,
            reservationStatus: reservation?.status || null,
            isCompleted: latest.status === "ADMITTED",
            isDiversion: latest.status === "CANCELLED" || latest.status === "REJECTED",
            createdAt: latest.createdAt,
            updatedAt: latest.updatedAt
        };

        return NextResponse.json({
            success: true,
            activeScenario
        });
    } catch (err: any) {
        console.error("GET /api/demo/scenario error:", err);
        return NextResponse.json(
            { success: false, error: "Unable to retrieve demo scenario status." },
            { status: 500 }
        );
    }
}

/**
 * POST /api/demo/scenario
 * Starts a selected demo scenario.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsed = scenarioSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { success: false, error: "Unable to start demo scenario. Invalid scenario type." },
                { status: 400 }
            );
        }

        const { scenario } = parsed.data;
        const client = await clientPromise;
        const db = client.db();

        // 1. Guard against duplicate active emergencies
        const existingActive = await db.collection("emergencyRequests").findOne({
            $or: [
                { isDemo: true },
                { emergencyId: { $regex: "^DEMO-" } }
            ],
            status: { $nin: ["ADMITTED", "CANCELLED", "REJECTED"] }
        });

        if (existingActive) {
            return NextResponse.json(
                {
                    success: false,
                    alreadyActive: true,
                    message: "Demo scenario already active",
                    activeScenarioId: existingActive.emergencyId
                },
                { status: 409 }
            );
        }

        const cfg = SCENARIO_CONFIGS[scenario];
        const now = new Date();
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const ambulanceId = "AMB-PUNE-01";

        // 2A. Negative Path & Telemetry Scenarios: Delegate to validated ems-simulator
        if (scenario === "ICU_SCARCITY" || scenario === "NO_SUITABLE_HOSPITAL" || scenario === "STALE_HOSPITAL_DATA") {
            const simResult = await runSimulation(
                {
                    scenario,
                    ambulanceId,
                    overrideAvailableIcuBeds: scenario === "ICU_SCARCITY" ? 0 : undefined
                },
                db
            );

            // Tag document with isDemo for tracking
            await db.collection("emergencyRequests").updateOne(
                { emergencyId: simResult.emergencyId },
                { $set: { isDemo: true, updatedAt: new Date() } }
            );

            const meta = SCENARIO_LABELS[scenario];
            return NextResponse.json({
                success: true,
                message: `Demo scenario "${meta.name}" started successfully.`,
                activeScenario: {
                    emergencyId: simResult.emergencyId,
                    scenario,
                    scenarioName: meta.name,
                    scenarioDescription: meta.description,
                    expectedFlow: meta.expectedFlow,
                    emergencyType: simResult.emergencyRequest.emergencyType,
                    priority: simResult.emergencyRequest.priority,
                    status: simResult.emergencyRequest.status,
                    ambulanceId,
                    hospitalId: simResult.selectedHospitalId,
                    reservationId: simResult.reservationId,
                    reservationOutcome: simResult.reservationOutcome,
                    isCompleted: false,
                    isDiversion: !simResult.selectedHospitalId,
                    createdAt: now,
                    updatedAt: now
                }
            });
        }

        // 2B. Operational Full-Lifecycle Scenarios: NORMAL_CARDIAC, TRAUMA, STROKE
        // Initialize at Stage 1: PENDING dispatch alert so judge can follow complete flow
        const emergencyId = `DEMO-EMG-${scenario.substring(0, 4)}-${ts}-${rand}`;
        const vitals = { sbp: cfg.sbp, heartRate: cfg.heartRate, spo2: cfg.spo2, gcs: cfg.gcs };
        const triage = classifyEmergencyTriage(cfg.condition, cfg.chiefComplaint, vitals);

        const newEmergency: EmergencyRequest = {
            emergencyId,
            ambulanceId,
            emergencyType: triage.emergencyType,
            priority: triage.priority,
            incidentLocation: {
                latitude: cfg.latitude,
                longitude: cfg.longitude,
                address: cfg.address,
                city: "Pune",
                state: "Maharashtra"
            },
            vitals,
            chiefComplaint: cfg.chiefComplaint,
            condition: cfg.condition,
            requiredSpecialty: triage.requiredSpecialty,
            requiredResources: triage.requiredResources,
            allocatedHospitalId: null,
            reservationId: null,
            status: "PENDING",
            patient: { age: cfg.age, gender: cfg.gender },
            source: "EMS_SIMULATION",
            notes: `[DEMO:${scenario}] ${cfg.description}`,
            createdAt: now,
            updatedAt: now
        };

        await db.collection("emergencyRequests").insertOne({
            ...newEmergency,
            isDemo: true
        });

        // Ensure canonical ambulance is in AVAILABLE state with no active mission
        await db.collection("ambulances").updateOne(
            { ambulanceId },
            {
                $set: {
                    status: "AVAILABLE",
                    currentEmergencyId: null,
                    transportStatus: null,
                    handoffStatus: null,
                    destinationHospitalId: null,
                    ETA: null,
                    telemetrySource: "SIMULATED_GPS",
                    updatedAt: now
                }
            },
            { upsert: true }
        );

        const meta = SCENARIO_LABELS[scenario];
        return NextResponse.json({
            success: true,
            message: `Demo scenario "${meta.name}" started successfully.`,
            activeScenario: {
                emergencyId,
                scenario,
                scenarioName: meta.name,
                scenarioDescription: meta.description,
                expectedFlow: meta.expectedFlow,
                emergencyType: triage.emergencyType,
                priority: triage.priority,
                status: "PENDING",
                transportStatus: null,
                handoffStatus: null,
                ambulanceId,
                hospitalId: null,
                hospitalName: null,
                reservationId: null,
                reservationStatus: null,
                isCompleted: false,
                isDiversion: false,
                createdAt: now,
                updatedAt: now
            }
        });

    } catch (err: any) {
        console.error("POST /api/demo/scenario error:", err);
        return NextResponse.json(
            { success: false, error: "Unable to start demo scenario." },
            { status: 500 }
        );
    }
}
