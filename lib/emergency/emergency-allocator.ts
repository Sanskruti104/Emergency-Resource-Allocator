/**
 * Real-Time Emergency Resource Allocator Engine
 * Deterministic, multi-criteria hospital matching and ranking for critical medical emergencies.
 * 
 * Conceptual Priority:
 * 1. Hard capability/resource compatibility (disqualifies unsuitable facilities)
 * 2. Resource match (40% weight)
 * 3. Travel time & ETA (35% weight)
 * 4. Data freshness (15% weight)
 * 5. Hospital load & capacity headroom (10% weight)
 */

import { calculateDistanceKm } from "@/utils/location_utils";
import {
    EmergencyRequest,
    EmergencyIntakeDTO,
    TriagePriority,
    ResourceType,
    EmergencyVitals,
    IncidentLocation
} from "./emergency-types";
import { classifyEmergencyTriage } from "./triage-intake";
import clientPromise from "@/lib/mongodb";

// ==========================================
// 1. Configurable Parameters (No Magic Numbers)
// ==========================================

export const ALLOCATOR_CONFIG = {
    // Travel model
    AMBULANCE_AVG_SPEED_KMH: 45.0,        // Deterministic urban/suburban ambulance speed
    DISPATCH_TURNOUT_MINUTES: 2.0,        // Chute / mobilization latency buffer
    GOLDEN_HOUR_MAX_MINUTES: 60.0,        // Golden hour critical transit threshold
    TRAVEL_SCORE_MAX_TIME_MINUTES: 5.0,   // Travel time <= 5m gets 100 pts
    TRAVEL_SCORE_PENALTY_PER_MIN: 1.5,    // Score penalty per minute over 5 min

    // Freshness model
    FRESH_MAX_MINUTES: 15.0,              // <= 15 mins: FRESH
    AGING_MAX_MINUTES: 60.0,              // 15 - 60 mins: AGING
    FRESH_BASE_SCORE: 100.0,
    AGING_BASE_SCORE: 75.0,
    STALE_PENALTY_SCORE: 20.0,            // > 60 mins: STALE

    // Scoring weights (sum = 1.0)
    WEIGHT_RESOURCE: 0.40,
    WEIGHT_TRAVEL: 0.35,
    WEIGHT_FRESHNESS: 0.15,
    WEIGHT_CAPACITY: 0.10
} as const;

export type FreshnessStatus = "FRESH" | "AGING" | "STALE";

// ==========================================
// 2. Evaluated Candidate Structure
// ==========================================

export interface EvaluatedCapacity {
    totalBeds: number;
    availableBeds: number;
    icuBeds: number;
    availableIcuBeds: number;
    operationTheatres: number;
    onDutySpecialist: number;
    emergencyAvailable: boolean;
    occupancy: number;
}

export interface CandidateEvaluation {
    hospitalId: string;
    hospitalName: string;
    suitability: boolean;
    overallScore: number;
    resourceMatchScore: number;
    travelScore: number;
    freshnessScore: number;
    capacityScore: number;
    distanceKm: number;
    estimatedTravelMinutes: number;
    eta: string;
    freshnessStatus: FreshnessStatus;
    lastUpdatedAt: string | null;
    availableCapacity: EvaluatedCapacity;
    matchedResources: string[];
    missingResources: string[];
    reasons: string[];
    city?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
}

export interface AllocationResult {
    success: boolean;
    timestamp: string;
    emergency: {
        condition: string;
        chiefComplaint: string;
        priority: TriagePriority;
        requiredSpecialty: string;
        requiredResources: ResourceType[];
        incidentLocation: IncidentLocation;
        vitals?: EmergencyVitals;
    };
    totalCandidatesEvaluated: number;
    suitableCount: number;
    results: CandidateEvaluation[];
    explanationSummary: string;
}

// ==========================================
// 3. Helper: Specialty and Instrument Normalization
// ==========================================

const SPECIALTY_KEYWORD_MAP: Record<string, string[]> = {
    cardiology: ["cardio", "cardiac", "heart", "cath", "interventional cardiology"],
    trauma: ["trauma", "ortho", "surgery", "emergency", "general surgery"],
    stroke: ["neuro", "stroke", "neurology", "neurosurgery", "brain"],
    pulmonology: ["pulmon", "respiratory", "chest", "critical care", "icu"],
    pediatric: ["pediatric", "child", "picu"],
    obstetric: ["obstetric", "gynec", "maternity", "nicu"],
    emergency: ["emergency", "critical care", "trauma"]
};

function matchesSpecialty(required: string, hospitalSpecialties: string[]): boolean {
    if (!required) return true;
    const reqLower = required.toLowerCase();

    // Check direct substring
    if (hospitalSpecialties.some(s => s.toLowerCase().includes(reqLower) || reqLower.includes(s.toLowerCase()))) {
        return true;
    }

    // Check mapped medical keywords
    for (const [key, keywords] of Object.entries(SPECIALTY_KEYWORD_MAP)) {
        if (reqLower.includes(key)) {
            const hasKeyword = hospitalSpecialties.some(s => {
                const sLower = s.toLowerCase();
                return keywords.some(k => sLower.includes(k));
            });
            if (hasKeyword) return true;
        }
    }

    return false;
}

const RESOURCE_INSTRUMENT_MAP: Record<ResourceType, string[]> = {
    VENTILATOR: ["ventilator", "respiratory_ventilator", "oxygen_supply"],
    CATH_LAB: ["cath_lab_system", "cath_lab", "angiography_system"],
    CT_SCAN: ["ct_scanner", "ct_scan", "imaging_suite", "mri"],
    TRAUMA_BAY: ["trauma_bay", "icu_monitor", "emergency_resuscitation"],
    ICU_BED: ["icu_monitor", "multipara_monitor"],
    GENERAL_BED: [],
    OPERATION_THEATRE: ["anesthesia_workstation", "surgical_suite"],
    SPECIALIST: []
};

function hasRequiredInstrument(resource: ResourceType, availableInstruments: string[]): boolean {
    const needed = RESOURCE_INSTRUMENT_MAP[resource];
    if (!needed || needed.length === 0) return true;
    const normAvailable = availableInstruments.map(i => i.toLowerCase().replace(/[\s-]/g, "_"));
    return needed.some(n => normAvailable.some(a => a.includes(n) || n.includes(a)));
}

// ==========================================
// 4. Component Scoring Functions
// ==========================================

export function calculateFreshness(updatedAtValue: string | Date | null | undefined): {
    status: FreshnessStatus;
    score: number;
    ageMinutes: number;
    lastUpdatedAt: string | null;
    reason: string;
} {
    if (!updatedAtValue) {
        return {
            status: "STALE",
            score: ALLOCATOR_CONFIG.STALE_PENALTY_SCORE,
            ageMinutes: Infinity,
            lastUpdatedAt: null,
            reason: "Telemetry timestamp missing; capacity assumed STALE (score 20/100)."
        };
    }

    const updatedDate = new Date(updatedAtValue);
    if (isNaN(updatedDate.getTime())) {
        return {
            status: "STALE",
            score: ALLOCATOR_CONFIG.STALE_PENALTY_SCORE,
            ageMinutes: Infinity,
            lastUpdatedAt: null,
            reason: "Invalid telemetry timestamp; capacity assumed STALE (score 20/100)."
        };
    }

    const ageMinutes = Math.max(0, (Date.now() - updatedDate.getTime()) / (60 * 1000));
    const lastUpdatedAt = updatedDate.toISOString();

    if (ageMinutes <= ALLOCATOR_CONFIG.FRESH_MAX_MINUTES) {
        const score = Math.max(85, Math.round(ALLOCATOR_CONFIG.FRESH_BASE_SCORE - ageMinutes));
        return {
            status: "FRESH",
            score,
            ageMinutes: Math.round(ageMinutes * 10) / 10,
            lastUpdatedAt,
            reason: `Telemetry FRESH (updated ${Math.round(ageMinutes)}m ago, score ${score}/100).`
        };
    }

    if (ageMinutes <= ALLOCATOR_CONFIG.AGING_MAX_MINUTES) {
        const score = Math.max(
            40,
            Math.round(ALLOCATOR_CONFIG.AGING_BASE_SCORE - (ageMinutes - ALLOCATOR_CONFIG.FRESH_MAX_MINUTES) * 0.75)
        );
        return {
            status: "AGING",
            score,
            ageMinutes: Math.round(ageMinutes * 10) / 10,
            lastUpdatedAt,
            reason: `Telemetry AGING (updated ${Math.round(ageMinutes)}m ago; recommended for verbal verification, score ${score}/100).`
        };
    }

    return {
        status: "STALE",
        score: ALLOCATOR_CONFIG.STALE_PENALTY_SCORE,
        ageMinutes: Math.round(ageMinutes * 10) / 10,
        lastUpdatedAt,
        reason: `Telemetry STALE (updated ${Math.round(ageMinutes)}m ago; high risk of capacity drift, score ${ALLOCATOR_CONFIG.STALE_PENALTY_SCORE}/100).`
    };
}

export function calculateTravel(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number
): {
    distanceKm: number;
    estimatedMinutes: number;
    travelScore: number;
    eta: string;
    reason: string;
} {
    const distanceKm = calculateDistanceKm(originLat, originLng, destLat, destLng);
    const speed = ALLOCATOR_CONFIG.AMBULANCE_AVG_SPEED_KMH;
    const turnout = ALLOCATOR_CONFIG.DISPATCH_TURNOUT_MINUTES;

    const transitMinutes = (distanceKm / speed) * 60;
    const estimatedMinutes = Math.round((transitMinutes + turnout) * 10) / 10;

    let travelScore = 100;
    if (estimatedMinutes > ALLOCATOR_CONFIG.TRAVEL_SCORE_MAX_TIME_MINUTES) {
        const penalty = (estimatedMinutes - ALLOCATOR_CONFIG.TRAVEL_SCORE_MAX_TIME_MINUTES) * ALLOCATOR_CONFIG.TRAVEL_SCORE_PENALTY_PER_MIN;
        travelScore = Math.max(0, Math.round((100 - penalty) * 10) / 10);
    }

    const etaDate = new Date(Date.now() + estimatedMinutes * 60 * 1000);

    return {
        distanceKm,
        estimatedMinutes,
        travelScore,
        eta: etaDate.toISOString(),
        reason: `${distanceKm.toFixed(1)} km away. Estimated ETA: ${estimatedMinutes} mins (Score: ${travelScore}/100).`
    };
}

export function calculateResourceScore(
    capacity: EvaluatedCapacity,
    requiredSpecialty: string,
    hospitalSpecialties: string[],
    requiredResources: ResourceType[],
    availableInstruments: string[]
): {
    score: number;
    matched: string[];
    missing: string[];
    reasons: string[];
} {
    let score = 0;
    const matched: string[] = [];
    const missing: string[] = [];
    const reasons: string[] = [];

    // 1. Emergency Availability (20 pts)
    if (capacity.emergencyAvailable) {
        score += 20;
        matched.push("EMERGENCY_DEPT_ACTIVE");
        reasons.push("Emergency Department confirmed online (+20 pts).");
    } else {
        missing.push("EMERGENCY_DEPT_INACTIVE");
        reasons.push("Emergency Department currently not accepting admissions (0/20 pts).");
    }

    // 2. ICU Headroom (25 pts)
    const requiresIcu = requiredResources.includes("ICU_BED");
    if (requiresIcu) {
        if (capacity.availableIcuBeds >= 3) {
            score += 25;
            matched.push(`ICU_HEADROOM_EXCELLENT (${capacity.availableIcuBeds} beds)`);
            reasons.push(`Strong ICU availability (${capacity.availableIcuBeds} open ICU beds, +25 pts).`);
        } else if (capacity.availableIcuBeds === 2) {
            score += 20;
            matched.push(`ICU_HEADROOM_MODERATE (2 beds)`);
            reasons.push("Moderate ICU availability (2 open ICU beds, +20 pts).");
        } else if (capacity.availableIcuBeds === 1) {
            score += 12;
            matched.push(`ICU_HEADROOM_TIGHT (1 bed)`);
            reasons.push("Critical single ICU bed remaining (+12 pts).");
        } else {
            missing.push("ICU_BED");
            reasons.push("Mandatory ICU required but 0 beds open (0/25 pts).");
        }
    } else {
        // Full baseline if ICU not explicitly required
        score += 25;
        matched.push("ICU_NOT_REQUIRED");
    }

    // 3. General Inpatient Bed Headroom (20 pts)
    if (capacity.availableBeds >= 10) {
        score += 20;
        matched.push(`INPATIENT_BEDS_AMPLE (${capacity.availableBeds} beds)`);
        reasons.push(`Ample general bed availability (${capacity.availableBeds} beds open, +20 pts).`);
    } else if (capacity.availableBeds > 0) {
        const bedScore = Math.round((capacity.availableBeds / 10) * 20);
        score += bedScore;
        matched.push(`INPATIENT_BEDS_LIMITED (${capacity.availableBeds} beds)`);
        reasons.push(`Limited general bed capacity (${capacity.availableBeds} beds open, +${bedScore} pts).`);
    } else {
        missing.push("GENERAL_BED");
        reasons.push("0 general inpatient beds available (0/20 pts).");
    }

    // 4. Specialty Coverage (20 pts)
    const specialtyMatch = matchesSpecialty(requiredSpecialty, hospitalSpecialties);
    if (specialtyMatch) {
        score += 15;
        matched.push(`SPECIALTY: ${requiredSpecialty}`);
        reasons.push(`Clinical specialty confirmed for ${requiredSpecialty} (+15 pts).`);
    } else {
        missing.push(`SPECIALTY: ${requiredSpecialty}`);
        reasons.push(`Facility lacks specialized department for ${requiredSpecialty} (0/15 pts).`);
    }

    if (capacity.onDutySpecialist > 0) {
        score += 5;
        matched.push(`ON_DUTY_SPECIALISTS (${capacity.onDutySpecialist})`);
        reasons.push(`Active on-duty clinical specialists on floor (+5 pts).`);
    }

    // 5. Equipment / Instrument Compatibility (15 pts)
    const instrumentNeeds = requiredResources.filter(r => r !== "GENERAL_BED" && r !== "ICU_BED" && r !== "SPECIALIST");
    if (instrumentNeeds.length > 0) {
        let matchedInstCount = 0;
        for (const req of instrumentNeeds) {
            if (hasRequiredInstrument(req, availableInstruments)) {
                matchedInstCount++;
                matched.push(`EQUIPMENT: ${req}`);
            } else {
                missing.push(`EQUIPMENT: ${req}`);
                reasons.push(`Required clinical equipment missing: ${req}.`);
            }
        }
        const instScore = Math.round((matchedInstCount / instrumentNeeds.length) * 15);
        score += instScore;
        reasons.push(`Equipment match: ${matchedInstCount}/${instrumentNeeds.length} verified (+${instScore}/15 pts).`);
    } else {
        score += 15;
        matched.push("STANDARD_EQUIPMENT_SATISFIED");
    }

    return {
        score: Math.min(100, score),
        matched,
        missing,
        reasons
    };
}

export function calculateCapacityResilience(capacity: EvaluatedCapacity): {
    score: number;
    reason: string;
} {
    let score = 50;

    // Evaluate occupancy rate
    if (capacity.occupancy < 0.60) {
        score = 100;
    } else if (capacity.occupancy <= 0.80) {
        score = 85;
    } else if (capacity.occupancy <= 0.90) {
        score = 60;
    } else if (capacity.occupancy <= 0.95) {
        score = 30;
    } else {
        score = 10;
    }

    // Surgical surge bonus
    if (capacity.operationTheatres >= 2) {
        score = Math.min(100, score + 10);
    }

    return {
        score,
        reason: `Operational occupancy at ${Math.round(capacity.occupancy * 100)}% with ${capacity.operationTheatres} OTs available (Score: ${score}/100).`
    };
}

// ==========================================
// 5. Candidate Evaluation Function
// ==========================================

export function evaluateHospitalCandidate(
    hospitalDoc: any,
    patientLocation: IncidentLocation,
    requiredSpecialty: string,
    requiredResources: ResourceType[],
    priority: TriagePriority
): CandidateEvaluation {
    const hospitalId = hospitalDoc.uid || hospitalDoc._id?.toString() || hospitalDoc.hospitalId || "UNKNOWN_HOSP";
    const hospitalName = hospitalDoc.hospitalName || hospitalDoc.name || "Hospital Facility";

    const lat = Number(hospitalDoc.latitude) || 18.5204;
    const lng = Number(hospitalDoc.longitude) || 73.8567;

    const rawCap = hospitalDoc.capacity || {};
    const totalBeds = Number(rawCap.totalBeds) || 0;
    const availableBeds = Number(rawCap.availableBeds) || 0;
    const icuBeds = Number(rawCap.icuBeds) || 0;
    const availableIcuBeds = Number(rawCap.availableIcuBeds !== undefined ? rawCap.availableIcuBeds : rawCap.icuBeds) || 0;
    const operationTheatres = Number(rawCap.operationTheatres) || 0;
    const onDutySpecialist = Number(rawCap.onDutySpecialist) || 0;
    const emergencyAvailable = rawCap.emergencyAvailable !== false;
    const occupancy = totalBeds > 0 ? Number(((totalBeds - availableBeds) / totalBeds).toFixed(2)) : 0.5;

    const evaluatedCapacity: EvaluatedCapacity = {
        totalBeds,
        availableBeds,
        icuBeds,
        availableIcuBeds,
        operationTheatres,
        onDutySpecialist,
        emergencyAvailable,
        occupancy
    };

    const hospitalSpecialties: string[] = Array.isArray(hospitalDoc.specialties) ? hospitalDoc.specialties : [];

    let availableInstruments: string[] = [];
    if (Array.isArray(hospitalDoc.instruments)) {
        availableInstruments = hospitalDoc.instruments;
    } else if (Array.isArray(hospitalDoc.instruments?.available)) {
        availableInstruments = hospitalDoc.instruments.available;
    }

    // 1. Evaluate Travel & Proximity
    const travel = calculateTravel(
        patientLocation.latitude,
        patientLocation.longitude,
        lat,
        lng
    );

    // 2. Evaluate Telemetry Freshness
    const updateTime = rawCap.updatedAt || hospitalDoc.updatedAt || null;
    const freshness = calculateFreshness(updateTime);

    // 3. Evaluate Resource Match
    const resourceEval = calculateResourceScore(
        evaluatedCapacity,
        requiredSpecialty,
        hospitalSpecialties,
        requiredResources,
        availableInstruments
    );

    // 4. Evaluate Capacity Resilience
    const resilience = calculateCapacityResilience(evaluatedCapacity);

    // ==========================================
    // 5. Hard Capability / Resource Compatibility
    // ==========================================
    const hardMissing: string[] = [];
    const hardDisqualifications: string[] = [];

    // Rule 1: Emergency Department active
    if (!evaluatedCapacity.emergencyAvailable) {
        hardMissing.push("EMERGENCY_DEPARTMENT_OFFLINE");
        hardDisqualifications.push("Facility Emergency Department is currently closed / offline.");
    }

    // Rule 2: Mandatory Specialty
    const hasSpecialty = matchesSpecialty(requiredSpecialty, hospitalSpecialties);
    if (!hasSpecialty) {
        hardMissing.push(`SPECIALTY: ${requiredSpecialty}`);
        hardDisqualifications.push(`Lacks required clinical specialty (${requiredSpecialty}).`);
    }

    // Rule 3: ICU Requirement
    const requiresIcu = requiredResources.includes("ICU_BED") || priority === "RED";
    if (requiresIcu && evaluatedCapacity.availableIcuBeds <= 0) {
        hardMissing.push("ICU_BED");
        hardDisqualifications.push("Mandatory critical care required, but 0 ICU beds are currently available.");
    }

    // Rule 4: Bed Requirement
    if (requiredResources.includes("GENERAL_BED") && evaluatedCapacity.availableBeds <= 0) {
        hardMissing.push("GENERAL_BED");
        hardDisqualifications.push("No general inpatient beds available (0 beds open).");
    }

    // Rule 5: Operating Theatre Requirement
    if (requiredResources.includes("OPERATION_THEATRE") && evaluatedCapacity.operationTheatres <= 0) {
        hardMissing.push("OPERATION_THEATRE");
        hardDisqualifications.push("Emergency surgical capability required, but no operation theatre is currently available.");
    }

    // Rule 6: Mandatory Specialized Equipment
    const mandatoryEquipment = requiredResources.filter(
        r => r === "VENTILATOR" || r === "CATH_LAB" || r === "CT_SCAN" || r === "TRAUMA_BAY"
    );
    for (const eq of mandatoryEquipment) {
        if (!hasRequiredInstrument(eq, availableInstruments)) {
            hardMissing.push(`EQUIPMENT: ${eq}`);
            hardDisqualifications.push(`Essential medical instrument missing: ${eq}.`);
        }
    }

    const suitability = hardMissing.length === 0;

    // ==========================================
    // 6. Overall Weighted Score Calculation
    // ==========================================
    let overallScore = 0;

    if (suitability) {
        const weightedScore =
            resourceEval.score * ALLOCATOR_CONFIG.WEIGHT_RESOURCE +
            travel.travelScore * ALLOCATOR_CONFIG.WEIGHT_TRAVEL +
            freshness.score * ALLOCATOR_CONFIG.WEIGHT_FRESHNESS +
            resilience.score * ALLOCATOR_CONFIG.WEIGHT_CAPACITY;

        overallScore = Math.round(weightedScore * 100) / 100;
    }

    // Explanatory reasons compilation
    const reasons: string[] = [];
    if (!suitability) {
        reasons.push(...hardDisqualifications);
    } else {
        reasons.push(travel.reason);
        reasons.push(freshness.reason);
        reasons.push(resilience.reason);
        reasons.push(...resourceEval.reasons.slice(0, 3));
    }

    return {
        hospitalId,
        hospitalName,
        suitability,
        overallScore,
        resourceMatchScore: resourceEval.score,
        travelScore: travel.travelScore,
        freshnessScore: freshness.score,
        capacityScore: resilience.score,
        distanceKm: travel.distanceKm,
        estimatedTravelMinutes: travel.estimatedMinutes,
        eta: travel.eta,
        freshnessStatus: freshness.status,
        lastUpdatedAt: freshness.lastUpdatedAt,
        availableCapacity: evaluatedCapacity,
        matchedResources: resourceEval.matched,
        missingResources: Array.from(new Set([...hardMissing, ...resourceEval.missing])),
        reasons,
        city: hospitalDoc.city,
        state: hospitalDoc.state,
        latitude: lat,
        longitude: lng
    };
}

// ==========================================
// 6. Ranking Engine
// ==========================================

export function rankHospitals(evaluations: CandidateEvaluation[]): CandidateEvaluation[] {
    return [...evaluations].sort((a, b) => {
        // 1. Hard suitability priority: suitable facilities ALWAYS precede unsuitable ones
        if (a.suitability !== b.suitability) {
            return a.suitability ? -1 : 1;
        }

        // 2. If both suitable, sort by overall deterministic score descending
        if (a.suitability && b.suitability) {
            if (b.overallScore !== a.overallScore) {
                return b.overallScore - a.overallScore;
            }
            // Tie-break: lowest travel time
            if (a.estimatedTravelMinutes !== b.estimatedTravelMinutes) {
                return a.estimatedTravelMinutes - b.estimatedTravelMinutes;
            }
            // Tie-break: highest telemetry freshness
            return b.freshnessScore - a.freshnessScore;
        }

        // 3. If both unsuitable, sort by closest distance for situational awareness
        return a.distanceKm - b.distanceKm;
    });
}

// ==========================================
// 7. High-Level Orchestrator Function
// ==========================================

export interface AllocatorInput {
    emergencyId?: string;
    intake?: EmergencyIntakeDTO;
    condition?: string;
    chiefComplaint?: string;
    priority?: TriagePriority;
    requiredSpecialty?: string;
    requiredResources?: ResourceType[];
    incidentLocation?: IncidentLocation;
    vitals?: EmergencyVitals;
    candidateHospitals?: any[]; // For testing or caller-provided candidates
}

export async function allocateEmergencyHospital(input: AllocatorInput): Promise<AllocationResult> {
    const timestamp = new Date().toISOString();

    // 1. Resolve Emergency Context
    let condition = input.condition || input.intake?.condition || "emergency";
    let chiefComplaint = input.chiefComplaint || input.intake?.chiefComplaint || "Acute medical distress";
    let priority: TriagePriority = input.priority || (input.intake?.triagePriority as TriagePriority) || "YELLOW";
    let vitals: EmergencyVitals | undefined = input.vitals || (input.intake ? {
        sbp: input.intake.sbp,
        heartRate: input.intake.heartRate,
        spo2: input.intake.spo2,
        gcs: input.intake.gcs
    } : undefined);

    let incidentLocation: IncidentLocation = input.incidentLocation || {
        latitude: input.intake?.latitude || 18.5204,
        longitude: input.intake?.longitude || 73.8567,
        address: input.intake?.address || "Incident Scene"
    };

    // If emergencyId is provided and we can load it from MongoDB, do so
    if (input.emergencyId && !input.intake) {
        try {
            const client = await clientPromise;
            const db = client.db();
            const stored = await db.collection<EmergencyRequest>("emergencyRequests").findOne({ emergencyId: input.emergencyId });
            if (stored) {
                condition = stored.condition;
                chiefComplaint = stored.chiefComplaint;
                priority = stored.priority;
                vitals = stored.vitals;
                incidentLocation = stored.incidentLocation;
            }
        } catch (err) {
            console.warn(`Could not load emergencyId ${input.emergencyId} from DB; proceeding with inline params.`, err);
        }
    }

    // 2. Perform Clinical Triage Analysis
    const triage = classifyEmergencyTriage(condition, chiefComplaint, vitals, priority);
    const requiredSpecialty = input.requiredSpecialty || triage.requiredSpecialty;
    const requiredResources = input.requiredResources || triage.requiredResources;
    const finalPriority = triage.priority;

    // 3. Load Candidate Hospitals
    let rawHospitals: any[] = [];
    if (Array.isArray(input.candidateHospitals) && input.candidateHospitals.length > 0) {
        rawHospitals = input.candidateHospitals;
    } else {
        try {
            const client = await clientPromise;
            const db = client.db();
            rawHospitals = await db.collection("hospitals").find({}).toArray();
        } catch (err: any) {
            console.error("MongoDB hospital query failed:", err?.message || err);
            rawHospitals = [];
        }
    }

    // 4. Evaluate Each Hospital
    const evaluations: CandidateEvaluation[] = rawHospitals.map(h =>
        evaluateHospitalCandidate(h, incidentLocation, requiredSpecialty, requiredResources, finalPriority)
    );

    // 5. Rank Candidates
    const rankedResults = rankHospitals(evaluations);
    const suitableCount = rankedResults.filter(r => r.suitability).length;

    // 6. Generate Explainability Summary
    let explanationSummary = "";
    if (rankedResults.length === 0) {
        explanationSummary = "No hospital candidates found in database to evaluate.";
    } else if (suitableCount === 0) {
        explanationSummary = `Evaluated ${rankedResults.length} facilities. No currently suitable hospital met all mandatory capabilities for ${finalPriority} ${condition.toUpperCase()} (Required Specialty: ${requiredSpecialty}, Resources: ${requiredResources.join(", ")}). Immediate regional diversion or clinical tele-consult required.`;
    } else {
        const top = rankedResults[0];
        explanationSummary = `Optimal match identified: ${top.hospitalName} (Overall Score: ${top.overallScore}/100, Travel: ${top.estimatedTravelMinutes} mins / ${top.distanceKm} km, Freshness: ${top.freshnessStatus}). ${suitableCount} of ${rankedResults.length} facilities verified suitable.`;
    }

    return {
        success: true,
        timestamp,
        emergency: {
            condition,
            chiefComplaint,
            priority: finalPriority,
            requiredSpecialty,
            requiredResources,
            incidentLocation,
            vitals
        },
        totalCandidatesEvaluated: rankedResults.length,
        suitableCount,
        results: rankedResults,
        explanationSummary
    };
}

/**
 * Standard alias for the emergency allocator matching engine
 */
export const evaluateHospitals = allocateEmergencyHospital;
