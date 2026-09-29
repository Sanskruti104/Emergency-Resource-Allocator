import { z } from "zod";
import {
    EmergencyRequest,
    EmergencyIntakeDTO,
    TriagePriority,
    EmergencyType,
    ResourceType,
    EmergencyVitals
} from "./emergency-types";

// ==========================================
// 1. Zod Validation Schema for Emergency Intake
// ==========================================

export const emergencyIntakeSchema = z.object({
    condition: z.string().min(1, "Condition is required"),
    chiefComplaint: z.string().min(2, "Chief complaint is required"),
    age: z.coerce.number().min(0).max(125).optional(),
    gender: z.enum(["male", "female", "other", "unknown"]).default("unknown"),
    sbp: z.coerce.number().min(30).max(300).optional(),
    heartRate: z.coerce.number().min(20).max(260).optional(),
    spo2: z.coerce.number().min(30).max(100).optional(),
    gcs: z.coerce.number().min(3).max(15).optional(),
    triagePriority: z.enum(["RED", "YELLOW", "GREEN"]).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    address: z.string().optional(),
    source: z.enum(["MANUAL_INTAKE", "EMS_SIMULATION", "VOICE_NLP"]).default("MANUAL_INTAKE"),
    notes: z.string().optional()
});

export type ValidatedEmergencyIntake = z.infer<typeof emergencyIntakeSchema>;

// ==========================================
// 2. Clinical Triage Classifier
// Evaluates vitals and chief complaint against clinical EMS thresholds
// ==========================================

export interface TriageEvaluation {
    priority: TriagePriority;
    emergencyType: EmergencyType;
    requiredSpecialty: string;
    requiredResources: ResourceType[];
    criticalFlags: string[];
}

export function classifyEmergencyTriage(
    condition: string,
    chiefComplaint: string,
    vitals?: EmergencyVitals,
    explicitPriority?: TriagePriority
): TriageEvaluation {
    const criticalFlags: string[] = [];
    const normCond = condition.toLowerCase().trim();
    const normComplaint = chiefComplaint.toLowerCase().trim();

    // 1. Evaluate Hemodynamic and Neurologic Vitals
    let computedPriority: TriagePriority = "GREEN";

    if (vitals) {
        if (vitals.sbp !== undefined && vitals.sbp < 90) {
            criticalFlags.push(`Critical Hypotension / Shock (SBP ${vitals.sbp} mmHg)`);
            computedPriority = "RED";
        }
        if (vitals.spo2 !== undefined && vitals.spo2 < 90) {
            criticalFlags.push(`Severe Hypoxemia (SpO2 ${vitals.spo2}%)`);
            computedPriority = "RED";
        }
        if (vitals.gcs !== undefined && vitals.gcs <= 8) {
            criticalFlags.push(`Severe Altered Consciousness / Coma (GCS ${vitals.gcs}/15)`);
            computedPriority = "RED";
        }
        if (vitals.heartRate !== undefined && (vitals.heartRate > 130 || vitals.heartRate < 45)) {
            criticalFlags.push(`Severe Arrhythmia (Heart Rate ${vitals.heartRate} bpm)`);
            computedPriority = "RED";
        }

        // Secondary / Urgent flags (Yellow) if not already Red
        if (computedPriority !== "RED") {
            if (vitals.sbp !== undefined && (vitals.sbp < 100 || vitals.sbp > 190)) {
                computedPriority = "YELLOW";
            }
            if (vitals.spo2 !== undefined && vitals.spo2 < 95) {
                computedPriority = "YELLOW";
            }
            if (vitals.gcs !== undefined && vitals.gcs < 14) {
                computedPriority = "YELLOW";
            }
            if (vitals.heartRate !== undefined && (vitals.heartRate > 105 || vitals.heartRate < 55)) {
                computedPriority = "YELLOW";
            }
        }
    }

    // 2. Condition-based evaluation
    let emergencyType: EmergencyType = "GENERAL";
    let requiredSpecialty = "Emergency Medicine & Trauma";
    const requiredResources: ResourceType[] = ["GENERAL_BED"];

    if (normCond.includes("trauma") || normComplaint.includes("crash") || normComplaint.includes("fall") || normComplaint.includes("fracture") || normComplaint.includes("bleeding")) {
        emergencyType = "TRAUMA";
        requiredSpecialty = "Trauma Surgery & Critical Care";
        requiredResources.push("TRAUMA_BAY");
        if (normComplaint.includes("severe") || normComplaint.includes("crash")) {
            if (computedPriority !== "RED") computedPriority = "YELLOW";
        }
    } else if (normCond.includes("cardiac") || normComplaint.includes("chest") || normComplaint.includes("heart") || normComplaint.includes("arm pain") || normComplaint.includes("sweating")) {
        emergencyType = "CARDIAC";
        requiredSpecialty = "Cardiology & Interventional Cath Lab";
        requiredResources.push("CATH_LAB");
        if (normComplaint.includes("pressure") || normComplaint.includes("crushing")) {
            if (computedPriority !== "RED") computedPriority = "YELLOW";
        }
    } else if (normCond.includes("stroke") || normComplaint.includes("droop") || normComplaint.includes("weakness") || normComplaint.includes("confusion") || normComplaint.includes("speech")) {
        emergencyType = "STROKE";
        requiredSpecialty = "Neurology & Comprehensive Stroke Center";
        requiredResources.push("CT_SCAN");
        if (computedPriority !== "RED") computedPriority = "YELLOW";
    } else if (normCond.includes("respiratory") || normComplaint.includes("breathing") || normComplaint.includes("shortness of breath") || normComplaint.includes("asthma")) {
        emergencyType = "RESPIRATORY";
        requiredSpecialty = "Pulmonology & Critical Care";
    }

    // If patient is in critical condition, upgrade required resources to ICU / Ventilator
    if (computedPriority === "RED") {
        requiredResources.push("ICU_BED");
        if (vitals?.spo2 !== undefined && vitals.spo2 < 90) {
            requiredResources.push("VENTILATOR");
        }
    }

    // If explicit priority was supplied (e.g. from EMS paramedic on scene), give it precedence unless vitals flag Red
    const finalPriority: TriagePriority = explicitPriority || computedPriority;

    return {
        priority: finalPriority,
        emergencyType,
        requiredSpecialty,
        requiredResources: Array.from(new Set(requiredResources)),
        criticalFlags
    };
}

// ==========================================
// 3. Factory: Create EmergencyRequest from Intake DTO
// ==========================================

export function createEmergencyRequestFromIntake(data: EmergencyIntakeDTO): EmergencyRequest {
    const vitals: EmergencyVitals = {
        sbp: data.sbp,
        heartRate: data.heartRate,
        spo2: data.spo2,
        gcs: data.gcs
    };

    const triage = classifyEmergencyTriage(
        data.condition,
        data.chiefComplaint,
        vitals,
        data.triagePriority
    );

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const emergencyId = `EMG-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomSuffix}`;

    const now = new Date();

    const request: EmergencyRequest = {
        emergencyId,
        ambulanceId: null,
        emergencyType: triage.emergencyType,
        priority: triage.priority,
        incidentLocation: {
            latitude: data.latitude || 18.5204, // Default to Pune center if not geolocated
            longitude: data.longitude || 73.8567,
            address: data.address || "Live Incident Scene"
        },
        vitals,
        chiefComplaint: data.chiefComplaint,
        condition: data.condition.toLowerCase(),
        requiredSpecialty: triage.requiredSpecialty,
        requiredResources: triage.requiredResources,
        allocatedHospitalId: null,
        reservationId: null,
        status: "PENDING",
        patient: {
            age: data.age,
            gender: data.gender || "unknown"
        },
        source: data.source || "MANUAL_INTAKE",
        notes: data.notes || (triage.criticalFlags.length > 0 ? `Clinical Alerts: ${triage.criticalFlags.join("; ")}` : undefined),
        createdAt: now,
        updatedAt: now
    };

    return request;
}

// ==========================================
// 4. Factory: Create EmergencyRequest from Kaggle EMS Event Record
// Directly powers the live simulation engine
// ==========================================

export function createEmergencyRequestFromEMSEvent(emsRecord: {
    event_id?: string;
    eventId?: string;
    timestamp?: string | Date;
    condition: string;
    chief_complaint?: string;
    chiefComplaint?: string;
    age?: number;
    gender?: string;
    sbp?: number;
    heart_rate?: number;
    heartRate?: number;
    spo2?: number;
    gcs?: number;
    triage_priority?: string;
    triagePriority?: string;
    latitude?: number;
    longitude?: number;
}): EmergencyRequest {
    const chiefComplaint = emsRecord.chief_complaint || emsRecord.chiefComplaint || "Emergency assistance requested";
    const condition = emsRecord.condition || "general";
    const sbp = emsRecord.sbp;
    const hr = emsRecord.heart_rate || emsRecord.heartRate;
    const spo2 = emsRecord.spo2;
    const gcs = emsRecord.gcs;

    const rawPriority = (emsRecord.triage_priority || emsRecord.triagePriority || "YELLOW").toUpperCase() as TriagePriority;
    const priority: TriagePriority = ["RED", "YELLOW", "GREEN"].includes(rawPriority) ? rawPriority : "YELLOW";

    const vitals: EmergencyVitals = { sbp, heartRate: hr, spo2, gcs };
    const triage = classifyEmergencyTriage(condition, chiefComplaint, vitals, priority);

    const eventId = emsRecord.event_id || emsRecord.eventId || `EMS-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date();

    return {
        emergencyId: eventId,
        ambulanceId: null,
        emergencyType: triage.emergencyType,
        priority: triage.priority,
        incidentLocation: {
            latitude: emsRecord.latitude || 18.5204 + (Math.random() - 0.5) * 0.15, // realistic cluster around metro coordinates
            longitude: emsRecord.longitude || 73.8567 + (Math.random() - 0.5) * 0.15,
            address: "EMS Dispatched Location"
        },
        vitals,
        chiefComplaint,
        condition: condition.toLowerCase(),
        requiredSpecialty: triage.requiredSpecialty,
        requiredResources: triage.requiredResources,
        allocatedHospitalId: null,
        reservationId: null,
        status: "PENDING",
        patient: {
            age: emsRecord.age,
            gender: (emsRecord.gender?.toLowerCase() as any) || "unknown"
        },
        source: "EMS_SIMULATION",
        notes: triage.criticalFlags.length > 0 ? `Triage Warning: ${triage.criticalFlags.join("; ")}` : undefined,
        createdAt: now,
        updatedAt: now
    };
}

/**
 * Standard alias for the clinical emergency triage classifier
 */
export const triageEmergency = classifyEmergencyTriage;
