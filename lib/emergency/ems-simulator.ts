/**
 * EMS Simulation Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Simulates emergency dispatch events and feeds them through the REAL pipeline:
 *   EMS event → EmergencyRequest (MongoDB) → Triage → Allocator → Reservation
 *               → Ambulance (MongoDB) → Handoff
 *
 * ARCHITECTURE PRINCIPLE:
 *   ┌────────────────────────────────┬────────────────────────────────────┐
 *   │           REAL                 │           SIMULATED                 │
 *   ├────────────────────────────────┼────────────────────────────────────┤
 *   │ MongoDB write operations        │ EMS dispatch feed                  │
 *   │ EmergencyRequest documents      │ Ambulance GPS coordinates          │
 *   │ Reservation atomic updates      │ Simulated capacity decay           │
 *   │ Hospital capacity accounting    │ Simulated external telemetry       │
 *   │ HospitalEvent audit records     │ Traffic/ETA computation            │
 *   │ Handoff documents               │                                    │
 *   │ Triage classifier               │                                    │
 *   │ Allocation scoring engine       │                                    │
 *   └────────────────────────────────┴────────────────────────────────────┘
 *
 * Simulated fields are annotated with telemetrySource: "SIMULATION"
 */

import { Db } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { classifyEmergencyTriage } from "./triage-intake";
import { allocateEmergencyHospital, ALLOCATOR_CONFIG } from "./emergency-allocator";
import { reserveResource, admitPatient } from "./emergency-reservation";
import {
    EmergencyRequest,
    Ambulance,
    Handoff,
    EmergencyType,
    ResourceType,
    AmbulanceStatus
} from "./emergency-types";

// ─── Scenario Definitions ────────────────────────────────────────────────────

export type SimulationScenario =
    | "JUDGE_DEMO_CARDIAC"
    | "NORMAL_CARDIAC"
    | "TRAUMA"
    | "STROKE"
    | "ICU_SCARCITY"
    | "NO_SUITABLE_HOSPITAL"
    | "STALE_HOSPITAL_DATA";

export interface SimulationOptions {
    scenario: SimulationScenario;
    ambulanceId?: string;
    forceHospitalId?: string;          // Pin destination (for STALE test)
    incidentLatitude?: number;
    incidentLongitude?: number;
    overrideAvailableIcuBeds?: number; // For ICU_SCARCITY scenario
}

// ─── Result Types ─────────────────────────────────────────────────────────────

export interface AmbulanceState {
    ambulanceId: string;
    status: AmbulanceStatus;
    currentLocation: { latitude: number; longitude: number };
    destinationHospitalId: string | null;
    ETA: number | null;
    telemetrySource: "SIMULATION";
}

export interface SimulationResult {
    success: boolean;
    scenario: SimulationScenario;
    emergencyId: string;
    emergencyRequest: EmergencyRequest;
    allocationResult: any;
    selectedHospitalId: string | null;
    reservationOutcome: string | null;
    reservationId: string | null;
    ambulanceState: AmbulanceState;
    handoffId: string | null;
    message: string;
    simulationMetadata: {
        telemetrySource: "SIMULATION";
        scenarioDescription: string;
        dataIsSimulated: string[];
        dataIsReal: string[];
    };
}

// ─── ID Generators ────────────────────────────────────────────────────────────

function genEmergencyId(): string {
    return `SIM-EMG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
}

function genAmbulanceId(scenario: SimulationScenario): string {
    return `SIM-AMB-${scenario.substring(0, 4)}-${Math.floor(Math.random() * 900 + 100)}`;
}

function genHandoffId(): string {
    return `HND-SIM-${Date.now().toString(36).toUpperCase()}`;
}

// ─── Scenario → Intake DTO Mapping ───────────────────────────────────────────

export interface ScenarioConfig {
    condition: string;
    chiefComplaint: string;
    age: number;
    gender: "male" | "female" | "other" | "unknown";
    sbp: number;
    heartRate: number;
    spo2: number;
    gcs: number;
    latitude: number;
    longitude: number;
    address: string;
    description: string;
}

export const SCENARIO_CONFIGS: Record<SimulationScenario, ScenarioConfig> = {
    JUDGE_DEMO_CARDIAC: {
        condition: "cardiac",
        chiefComplaint: "Acute STEMI with cardiogenic shock, crushing retrosternal chest pain, diaphoresis, SBP 85",
        age: 62,
        gender: "male",
        sbp: 85,
        heartRate: 118,
        spo2: 88,
        gcs: 14,
        latitude: 18.5204,
        longitude: 73.8567,
        address: "Shivajinagar Central Corridor, Pune",
        description: "Primary judge demo: STEMI cardiogenic shock requiring Cath Lab, Cardiology, and ICU bed. Demonstrates nearest-unsuitable rejection vs. farther-suitable selection."
    },
    NORMAL_CARDIAC: {
        condition: "cardiac",
        chiefComplaint: "Severe chest pain radiating to left arm, diaphoresis, 20-minute onset",
        age: 58,
        gender: "male",
        sbp: 85,
        heartRate: 115,
        spo2: 89,
        gcs: 15,
        latitude: 18.5204,
        longitude: 73.8567,
        address: "Pune Railway Station Area",
        description: "STEMI-pattern cardiac emergency requiring Cath Lab and Cardiology"
    },
    TRAUMA: {
        condition: "trauma",
        chiefComplaint: "High-speed MVA, multiple extremity fractures, GCS 10, suspected internal bleeding",
        age: 32,
        gender: "male",
        sbp: 82,
        heartRate: 130,
        spo2: 91,
        gcs: 10,
        latitude: 18.5452,
        longitude: 73.8742,
        address: "Ahmednagar Road, Wagholi",
        description: "Poly-trauma with haemodynamic instability requiring Trauma Bay + OT"
    },
    STROKE: {
        condition: "stroke",
        chiefComplaint: "Sudden right-sided weakness, facial drooping, speech slurring — onset 45 minutes ago",
        age: 67,
        gender: "female",
        sbp: 190,
        heartRate: 88,
        spo2: 96,
        gcs: 13,
        latitude: 18.5310,
        longitude: 73.8478,
        address: "Deccan Gymkhana, Pune",
        description: "Acute ischaemic stroke within tPA window requiring Neurology + CT"
    },
    ICU_SCARCITY: {
        condition: "respiratory failure",
        chiefComplaint: "Acute respiratory distress, SpO2 78% on room air, altered sensorium",
        age: 72,
        gender: "male",
        sbp: 100,
        heartRate: 125,
        spo2: 78,
        gcs: 9,
        latitude: 18.5080,
        longitude: 73.8120,
        address: "Sinhagad Road, Pune",
        description: "Severe ARDS requiring ICU admission and ventilator — tests scarcity conditions"
    },
    NO_SUITABLE_HOSPITAL: {
        condition: "decompression sickness",
        chiefComplaint: "Severe arterial gas embolism following deep dive requiring specialized Hyperbaric Chamber Decompression Unit",
        age: 34,
        gender: "male",
        sbp: 85,
        heartRate: 110,
        spo2: 90,
        gcs: 11,
        latitude: 18.5700,
        longitude: 73.7800,
        address: "Pimpri Lake Recreation Area",
        description: "Severe diving decompression requiring Hyperbaric Decompression Unit — tests NO_SUITABLE_HOSPITAL scenario"
    },
    STALE_HOSPITAL_DATA: {
        condition: "cardiac",
        chiefComplaint: "Chest pain, palpitations, sweating — 15-minute onset",
        age: 54,
        gender: "female",
        sbp: 95,
        heartRate: 105,
        spo2: 94,
        gcs: 15,
        latitude: 18.5204,
        longitude: 73.8567,
        address: "Near Pune Cantonment",
        description: "Standard cardiac — but one hospital has stale telemetry (>60 min old updatedAt)"
    }
};

// ─── Main Simulator ───────────────────────────────────────────────────────────

export async function runSimulation(
    options: SimulationOptions,
    db?: Db
): Promise<SimulationResult> {
    const resolvedDb = db ?? (await (await clientPromise).db());
    const { scenario } = options;
    const cfg = SCENARIO_CONFIGS[scenario];
    const emergencyId = genEmergencyId();
    const ambulanceId = options.ambulanceId ?? genAmbulanceId(scenario);

    const lat = options.incidentLatitude ?? cfg.latitude;
    const lng = options.incidentLongitude ?? cfg.longitude;

    // ─── STEP 1: Triage Classification (REAL) ────────────────────────────────
    const vitals = { sbp: cfg.sbp, heartRate: cfg.heartRate, spo2: cfg.spo2, gcs: cfg.gcs };
    const triage = classifyEmergencyTriage(cfg.condition, cfg.chiefComplaint, vitals);

    // ─── STEP 2: Persist EmergencyRequest (REAL MongoDB write) ───────────────
    const now = new Date();
    const emergencyRequest: EmergencyRequest = {
        emergencyId,
        ambulanceId,
        emergencyType: triage.emergencyType,
        priority: triage.priority,
        incidentLocation: { latitude: lat, longitude: lng, address: cfg.address, city: "Pune", state: "Maharashtra" },
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
        notes: `[SIMULATION:${scenario}] ${cfg.description}`,
        createdAt: now,
        updatedAt: now
    };
    await resolvedDb.collection("emergencyRequests").insertOne({ ...emergencyRequest });

    // ─── STEP 3: Persist Ambulance (REAL MongoDB write, SIMULATED GPS) ───────
    // Ambulance GPS coordinates are SIMULATED — labelled accordingly
    const ambulance: Ambulance = {
        ambulanceId,
        callSign: `SIM-${ambulanceId.split("-").pop()}`,
        vehicleType: triage.priority === "RED" ? "MICU" : "ALS",
        status: "DISPATCHED",
        currentLocation: {
            latitude: lat + (Math.random() * 0.01 - 0.005),  // SIMULATED start position
            longitude: lng + (Math.random() * 0.01 - 0.005),
            heading: Math.floor(Math.random() * 360),
            speedKmH: 60,                                      // SIMULATED speed
            updatedAt: now
        },
        currentEmergencyId: emergencyId,
        destinationHospitalId: null,
        ETA: null,
        assignedCrew: { leadParamedic: "SIM-PARAMEDIC", contactPhone: "+91-SIMULATION" },
        createdAt: now,
        updatedAt: now
    };
    await resolvedDb.collection("ambulances").replaceOne(
        { ambulanceId },
        { ...ambulance, telemetrySource: "SIMULATION" },
        { upsert: true }
    );

    // ─── STEP 4: ICU_SCARCITY — Temporarily cap ICU at constrained hospital ──
    let stalePatch: { hospitalId: string; originalUpdatedAt: Date } | null = null;
    let scarcityPatched = false;

    if (scenario === "ICU_SCARCITY" && options.overrideAvailableIcuBeds !== undefined) {
        // Only patch the constrained hospital so other hospitals still compete
        await resolvedDb.collection("hospitals").updateMany(
            { uid: "DEMO-HOSP-CONSTRAINED-005" },
            { $set: { "capacity.availableIcuBeds": options.overrideAvailableIcuBeds, "capacity.updatedAt": new Date() } }
        );
        scarcityPatched = true;
    }

    if (scenario === "STALE_HOSPITAL_DATA") {
        // Make one hospital's data intentionally stale (>60 min old)
        const staleHospital = await resolvedDb.collection("hospitals").findOne({ uid: "DEMO-HOSP-GENERAL-004" });
        if (staleHospital) {
            stalePatch = { hospitalId: "DEMO-HOSP-GENERAL-004", originalUpdatedAt: staleHospital.updatedAt };
            const staleTime = new Date(Date.now() - 90 * 60 * 1000); // 90 min ago
            await resolvedDb.collection("hospitals").updateOne(
                { uid: "DEMO-HOSP-GENERAL-004" },
                { $set: { "capacity.updatedAt": staleTime, updatedAt: staleTime } }
            );
        }
    }

    // ─── STEP 5: Allocate (REAL allocator, REAL hospital data) ───────────────
    // If scenario is ICU_SCARCITY, simulate regional ICU exhaustion
    let candidateHospitals: any[] | undefined;
    if (scenario === "ICU_SCARCITY") {
        const rawHospitals = await resolvedDb.collection("hospitals").find({}).toArray();
        candidateHospitals = rawHospitals.map(h => ({
            ...h,
            capacity: {
                ...h.capacity,
                availableIcuBeds: 0
            }
        }));
    } else if (db) {
        candidateHospitals = await resolvedDb.collection("hospitals").find({}).toArray();
    }

    const allocationResult = await allocateEmergencyHospital({
        intake: {
            condition: cfg.condition,
            chiefComplaint: cfg.chiefComplaint,
            age: cfg.age,
            gender: cfg.gender,
            sbp: cfg.sbp,
            heartRate: cfg.heartRate,
            spo2: cfg.spo2,
            gcs: cfg.gcs,
            latitude: lat,
            longitude: lng,
            address: cfg.address,
            source: "EMS_SIMULATION"
        },
        requiredSpecialty: scenario === "NO_SUITABLE_HOSPITAL" ? "Hyperbaric Diving Decompression & Aerospace Medicine" : undefined,
        candidateHospitals
    });

    // ─── STEP 6: Restore patched data ────────────────────────────────────────
    if (stalePatch) {
        await resolvedDb.collection("hospitals").updateOne(
            { uid: stalePatch.hospitalId },
            { $set: { "capacity.updatedAt": stalePatch.originalUpdatedAt, updatedAt: stalePatch.originalUpdatedAt } }
        );
    }

    // ─── STEP 7: Attempt reservation at top-ranked suitable hospital ─────────
    const suitableHospitals = allocationResult.results.filter((r: any) => r.suitability);
    const topHospital = options.forceHospitalId
        ? allocationResult.results.find((r: any) => r.hospitalId === options.forceHospitalId)
        : suitableHospitals[0];

    let selectedHospitalId: string | null = null;
    let reservationOutcome: string | null = null;
    let reservationId: string | null = null;

    if (!allocationResult.success || !topHospital) {
        // NO_SUITABLE_HOSPITAL scenario — no reservation attempted
        reservationOutcome = "NO_SUITABLE_HOSPITAL";

        await resolvedDb.collection("emergencyRequests").updateOne(
            { emergencyId },
            { $set: { status: "CANCELLED", updatedAt: new Date() } }
        );
    } else {
        selectedHospitalId = topHospital.hospitalId;

        // Determine primary resource type to reserve
        const primaryResource: ResourceType =
            triage.requiredResources.includes("ICU_BED") ? "ICU_BED" :
            triage.requiredResources.includes("GENERAL_BED") ? "GENERAL_BED" :
            "GENERAL_BED";

        const reservationResult = await reserveResource({
            hospitalId: selectedHospitalId,
            emergencyId,
            resourceType: primaryResource,
            quantity: 1,
            ttlMinutes: 45,
            allocatedBy: "AUTO_ALLOCATOR"
        }, resolvedDb);

        reservationOutcome = reservationResult.outcome;
        reservationId = reservationResult.reservationId ?? null;

        // Update EmergencyRequest with allocation results (REAL)
        const newStatus = reservationResult.outcome === "SUCCESS" ? "ALLOCATED" : "PENDING";
        await resolvedDb.collection("emergencyRequests").updateOne(
            { emergencyId },
            {
                $set: {
                    allocatedHospitalId: selectedHospitalId,
                    reservationId,
                    status: newStatus,
                    updatedAt: new Date()
                }
            }
        );

        // Update Ambulance with destination + ETA (SIMULATED ETA, REAL doc update)
        const eta = topHospital.estimatedTravelMinutes ?? 12;
        await resolvedDb.collection("ambulances").updateOne(
            { ambulanceId },
            {
                $set: {
                    destinationHospitalId: selectedHospitalId,
                    ETA: Math.round(eta),
                    status: "TRANSPORTING",
                    updatedAt: new Date()
                }
            }
        );
        ambulance.destinationHospitalId = selectedHospitalId;
        ambulance.ETA = Math.round(eta);
        ambulance.status = "TRANSPORTING";
    }

    // ─── STEP 8: Return final state ───────────────────────────────────────────
    return {
        success: reservationOutcome === "SUCCESS" || reservationOutcome === null,
        scenario,
        emergencyId,
        emergencyRequest: { ...emergencyRequest, status: selectedHospitalId ? "ALLOCATED" : "CANCELLED" },
        allocationResult,
        selectedHospitalId,
        reservationOutcome,
        reservationId,
        ambulanceState: {
            ambulanceId,
            status: ambulance.status,
            currentLocation: ambulance.currentLocation,
            destinationHospitalId: ambulance.destinationHospitalId ?? null,
            ETA: ambulance.ETA ?? null,
            telemetrySource: "SIMULATION"
        },
        handoffId: null,
        message: reservationOutcome === "SUCCESS"
            ? `[SIMULATION:${scenario}] Emergency ${emergencyId} allocated to ${selectedHospitalId}. Reservation ${reservationId} active.`
            : `[SIMULATION:${scenario}] Emergency ${emergencyId} — outcome: ${reservationOutcome ?? "NO_HOSPITAL"}.`,
        simulationMetadata: {
            telemetrySource: "SIMULATION",
            scenarioDescription: cfg.description,
            dataIsSimulated: [
                "EMS dispatch trigger",
                "Ambulance GPS coordinates",
                "Ambulance speed / heading",
                "ETA calculation (deterministic model, not real traffic)",
                "Paramedic crew assignment"
            ],
            dataIsReal: [
                "MongoDB EmergencyRequest document",
                "MongoDB Ambulance document",
                "Triage classification engine",
                "Hospital allocation scoring",
                "Atomic reservation (MongoDB conditional update)",
                "HospitalEvent audit records",
                "Hospital capacity accounting (four-bucket invariant)"
            ]
        }
    };
}

// ─── Ambulance Movement Simulator ─────────────────────────────────────────────

export type AmbulanceMoveStep = "DISPATCHED" | "EN_ROUTE" | "ARRIVED" | "HANDOFF";

export interface AmbulanceMoveResult {
    ambulanceId: string;
    previousStatus: AmbulanceStatus;
    newStatus: AmbulanceStatus;
    handoffId?: string;
    message: string;
    telemetrySource: "SIMULATION";
}

export async function advanceAmbulance(
    ambulanceId: string,
    step: AmbulanceMoveStep,
    db?: Db
): Promise<AmbulanceMoveResult> {
    const resolvedDb = db ?? (await (await clientPromise).db());

    const ambDoc = await resolvedDb.collection("ambulances").findOne({ ambulanceId });
    if (!ambDoc) {
        throw new Error(`Ambulance ${ambulanceId} not found`);
    }

    const previousStatus = ambDoc.status as AmbulanceStatus;
    let newStatus: AmbulanceStatus;
    let handoffId: string | undefined;

    switch (step) {
        case "DISPATCHED":
            newStatus = "DISPATCHED";
            break;
        case "EN_ROUTE":
            newStatus = "TRANSPORTING";
            break;
        case "ARRIVED":
            newStatus = "AT_HOSPITAL";
            // Create handoff document (REAL)
            handoffId = genHandoffId();
            const handoff: Handoff = {
                handoffId,
                emergencyId: ambDoc.currentEmergencyId,
                ambulanceId,
                hospitalId: ambDoc.destinationHospitalId,
                arrivalTime: new Date(),
                handoffTime: undefined,
                receivingStaffId: undefined,
                receivingDoctorName: undefined,
                triageCategoryConfirmed: undefined,
                status: "ARRIVED",
                clinicalNotes: "[SIMULATION] Ambulance arrived at Emergency Department.",
                createdAt: new Date()
            };
            await resolvedDb.collection("handoffs").insertOne({ ...handoff, telemetrySource: "SIMULATION" });

            // Update emergencyRequest status
            await resolvedDb.collection("emergencyRequests").updateOne(
                { emergencyId: ambDoc.currentEmergencyId },
                { $set: { status: "ARRIVED", updatedAt: new Date() } }
            );
            break;
        case "HANDOFF":
            newStatus = "AVAILABLE";
            // Complete the handoff (REAL)
            const completedHandoff = await resolvedDb.collection("handoffs").findOneAndUpdate(
                { ambulanceId, status: "ARRIVED" },
                {
                    $set: {
                        status: "COMPLETED",
                        handoffTime: new Date(),
                        receivingDoctorName: "[SIMULATION] ED Physician",
                        triageCategoryConfirmed: ambDoc.triagePriority ?? "RED",
                        clinicalNotes: "[SIMULATION] Patient transferred to ED team. Handoff complete."
                    }
                },
                { returnDocument: "after" }
            );
            if (completedHandoff) {
                handoffId = completedHandoff.handoffId;
            }
            await resolvedDb.collection("emergencyRequests").updateOne(
                { emergencyId: ambDoc.currentEmergencyId },
                { $set: { status: "HANDED_OFF", updatedAt: new Date() } }
            );
            // AUTO-ADMIT ON HANDOFF: Atomically transition reservation to ADMITTED
            // Moves capacity from reserved → occupied, preserving the invariant
            if (ambDoc.currentEmergencyId) {
                const activeRes = await resolvedDb.collection("reservations").findOne({
                    emergencyId: ambDoc.currentEmergencyId,
                    status: { $in: ["PENDING", "CONFIRMED"] }
                });
                if (activeRes) {
                    await admitPatient({ reservationId: activeRes.reservationId }, resolvedDb);
                } else {
                    // Fallback audit event if reservation wasn't tracked
                    await resolvedDb.collection("hospitalEvents").insertOne({
                        eventId: `EVT-SIM-${Date.now().toString(36).toUpperCase()}`,
                        hospitalId: ambDoc.destinationHospitalId,
                        eventType: "PATIENT_ADMITTED",
                        emergencyId: ambDoc.currentEmergencyId,
                        reservationId: null,
                        details: { source: "SIMULATION", ambulanceId, step: "HANDOFF" },
                        actorId: "SIM_SYSTEM",
                        timestamp: new Date()
                    });
                }
            }
            break;
        default:
            throw new Error(`Unknown step: ${step}`);
    }

    // Update ambulance status in MongoDB (REAL write, SIMULATED GPS delta)
    await resolvedDb.collection("ambulances").updateOne(
        { ambulanceId },
        {
            $set: {
                status: newStatus,
                "currentLocation.updatedAt": new Date(),
                updatedAt: new Date(),
                ...(newStatus === "AT_HOSPITAL" ? { ETA: 0 } : {}),
                ...(newStatus === "AVAILABLE" ? { currentEmergencyId: null, destinationHospitalId: null } : {})
            }
        }
    );

    return {
        ambulanceId,
        previousStatus,
        newStatus,
        handoffId,
        message: `[SIMULATION] Ambulance ${ambulanceId}: ${previousStatus} → ${newStatus}`,
        telemetrySource: "SIMULATION"
    };
}

// ─── Scenario Reset (DEMO Records Only) ───────────────────────────────────────

export async function resetDemoScenario(db?: Db) {
    const resolvedDb = db ?? (await (await clientPromise).db());
    const now = new Date();

    // 1. Delete all demo & simulated emergencies
    await resolvedDb.collection("emergencyRequests").deleteMany({
        $or: [
            { source: { $in: ["DEMO_SCENARIO", "EMS_SIMULATION"] } },
            { isDemo: true },
            { emergencyId: { $regex: "^(DEMO-|SIM-)" } }
        ]
    });

    // 2. Delete demo reservations
    await resolvedDb.collection("reservations").deleteMany({
        $or: [
            { emergencyId: { $regex: "^(DEMO-|SIM-)" } },
            { reservationId: { $regex: "^(RES-DEMO|RES-SIM)" } }
        ]
    });

    // 3. Delete demo handoffs
    await resolvedDb.collection("handoffs").deleteMany({
        $or: [
            { telemetrySource: "SIMULATION" },
            { emergencyId: { $regex: "^(DEMO-|SIM-)" } }
        ]
    });

    // 4. Delete demo hospital events
    await resolvedDb.collection("hospitalEvents").deleteMany({
        $or: [
            { "details.source": "SIMULATION" },
            { emergencyId: { $regex: "^(DEMO-|SIM-)" } }
        ]
    });

    // 5. Clean up simulated temporary ambulances
    await resolvedDb.collection("ambulances").deleteMany({
        ambulanceId: { $regex: "^SIM-AMB-" }
    });

    // 6. Reset canonical demo ambulance AMB-PUNE-01 to AVAILABLE
    await resolvedDb.collection("ambulances").updateOne(
        { ambulanceId: "AMB-PUNE-01" },
        {
            $set: {
                status: "AVAILABLE",
                currentEmergencyId: null,
                transportStatus: null,
                handoffStatus: null,
                destinationHospitalId: null,
                ETA: null,
                updatedAt: now
            }
        },
        { upsert: true }
    );

    // 7. Ensure demo hospital capacities are sane and fresh with invariant-compliant baselines
    const DEMO_HOSPITAL_BASELINES: Record<string, any> = {
        "DEMO-HOSP-CARDIAC-001": {
            totalBeds: 180, availableBeds: 42, occupiedBeds: 138, reservedBeds: 0,
            icuBeds: 24, availableIcuBeds: 8, occupiedIcuBeds: 16, reservedIcuBeds: 0,
            availableOTs: 2, reservedOTs: 0, totalVentilators: 18, availableVentilators: 6, occupiedVentilators: 12, reservedVentilators: 0
        },
        "DEMO-HOSP-TRAUMA-002": {
            totalBeds: 250, availableBeds: 68, occupiedBeds: 182, reservedBeds: 0,
            icuBeds: 30, availableIcuBeds: 10, occupiedIcuBeds: 20, reservedIcuBeds: 0,
            availableOTs: 3, reservedOTs: 0, totalVentilators: 22, availableVentilators: 8, occupiedVentilators: 14, reservedVentilators: 0
        },
        "DEMO-HOSP-NEURO-003": {
            totalBeds: 150, availableBeds: 35, occupiedBeds: 115, reservedBeds: 0,
            icuBeds: 20, availableIcuBeds: 7, occupiedIcuBeds: 13, reservedIcuBeds: 0,
            availableOTs: 1, reservedOTs: 0, totalVentilators: 14, availableVentilators: 5, occupiedVentilators: 9, reservedVentilators: 0
        },
        "DEMO-HOSP-GENERAL-004": {
            totalBeds: 300, availableBeds: 90, occupiedBeds: 210, reservedBeds: 0,
            icuBeds: 25, availableIcuBeds: 9, occupiedIcuBeds: 16, reservedIcuBeds: 0,
            availableOTs: 2, reservedOTs: 0, totalVentilators: 20, availableVentilators: 7, occupiedVentilators: 13, reservedVentilators: 0
        },
        "DEMO-HOSP-CONSTRAINED-005": {
            totalBeds: 80, availableBeds: 12, occupiedBeds: 68, reservedBeds: 0,
            icuBeds: 4, availableIcuBeds: 1, occupiedIcuBeds: 3, reservedIcuBeds: 0,
            availableOTs: 1, reservedOTs: 0, totalVentilators: 3, availableVentilators: 1, occupiedVentilators: 2, reservedVentilators: 0
        }
    };

    for (const [uid, cap] of Object.entries(DEMO_HOSPITAL_BASELINES)) {
        await resolvedDb.collection("hospitals").updateOne(
            { uid },
            {
                $set: {
                    capacity: { ...cap, updatedAt: now },
                    operationalCapacity: { ...cap, updatedAt: now },
                    telemetryLastUpdated: now,
                    updatedAt: now
                }
            }
        );
    }

    return {
        success: true,
        message: "Demo scenario records reset successfully."
    };
}
