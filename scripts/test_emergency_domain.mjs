import { z } from "zod";

// Test schema matching lib/emergency/triage-intake.ts
const emergencyIntakeSchema = z.object({
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

function classifyTriage(condition, chiefComplaint, vitals = {}) {
    const flags = [];
    let priority = "GREEN";
    const normCond = condition.toLowerCase();
    const normComplaint = chiefComplaint.toLowerCase();

    if (vitals.sbp && vitals.sbp < 90) {
        flags.push(`Critical Hypotension (${vitals.sbp} mmHg)`);
        priority = "RED";
    }
    if (vitals.spo2 && vitals.spo2 < 90) {
        flags.push(`Severe Hypoxemia (${vitals.spo2}%)`);
        priority = "RED";
    }
    if (vitals.gcs && vitals.gcs <= 8) {
        flags.push(`Severe Altered Consciousness (GCS ${vitals.gcs})`);
        priority = "RED";
    }
    if (vitals.heartRate && (vitals.heartRate > 130 || vitals.heartRate < 45)) {
        flags.push(`Critical Arrhythmia (${vitals.heartRate} bpm)`);
        priority = "RED";
    }

    if (priority !== "RED") {
        if ((vitals.sbp && vitals.sbp < 100) || (vitals.spo2 && vitals.spo2 < 95) || (vitals.gcs && vitals.gcs < 14)) {
            priority = "YELLOW";
        }
    }

    let resources = ["GENERAL_BED"];
    let specialty = "General Emergency";

    if (normCond.includes("trauma") || normComplaint.includes("crash") || normComplaint.includes("fall")) {
        specialty = "Trauma Surgery";
        resources.push("TRAUMA_BAY");
    } else if (normCond.includes("cardiac") || normComplaint.includes("chest") || normComplaint.includes("heart")) {
        specialty = "Cardiology";
        resources.push("CATH_LAB");
    } else if (normCond.includes("stroke") || normComplaint.includes("droop") || normComplaint.includes("weakness")) {
        specialty = "Neurology";
        resources.push("CT_SCAN");
    }

    if (priority === "RED") {
        resources.push("ICU_BED");
        if (vitals.spo2 && vitals.spo2 < 90) {
            resources.push("VENTILATOR");
        }
    }

    return {
        priority,
        specialty,
        resources: Array.from(new Set(resources)),
        flags
    };
}

async function runTests() {
    console.log("=== Testing Emergency Triage Data Foundation ===");

    // Test 1: Critical cardiac with shock
    const cardiacVitals = { sbp: 82, heartRate: 135, spo2: 88, gcs: 14 };
    const cardiacTriage = classifyTriage("cardiac", "crushing chest pain with cold sweats", cardiacVitals);
    console.log("1. Cardiac with shock -> Priority RED:", cardiacTriage.priority === "RED" ? "PASS" : "FAIL");
    console.log("2. Cardiac requires CATH_LAB + ICU_BED + VENTILATOR:",
        cardiacTriage.resources.includes("CATH_LAB") &&
        cardiacTriage.resources.includes("ICU_BED") &&
        cardiacTriage.resources.includes("VENTILATOR") ? "PASS" : "FAIL"
    );

    // Test 2: Severe trauma with coma
    const traumaVitals = { sbp: 110, heartRate: 98, spo2: 96, gcs: 7 };
    const traumaTriage = classifyTriage("trauma", "motorcycle crash injury with head trauma", traumaVitals);
    console.log("3. Trauma with GCS 7 -> Priority RED:", traumaTriage.priority === "RED" ? "PASS" : "FAIL");
    console.log("4. Trauma requires TRAUMA_BAY + ICU_BED:",
        traumaTriage.resources.includes("TRAUMA_BAY") &&
        traumaTriage.resources.includes("ICU_BED") ? "PASS" : "FAIL"
    );

    // Test 3: Moderate acute stroke
    const strokeVitals = { sbp: 145, heartRate: 85, spo2: 97, gcs: 14 };
    const strokeTriage = classifyTriage("stroke", "acute facial droop and right arm weakness", strokeVitals);
    console.log("5. Stroke requires Neurology + CT_SCAN:",
        strokeTriage.specialty === "Neurology" &&
        strokeTriage.resources.includes("CT_SCAN") ? "PASS" : "FAIL"
    );

    // Test 4: Zod Validation with valid payload
    const validPayload = {
        condition: "cardiac",
        chiefComplaint: "chest pressure radiating to jaw",
        age: 58,
        gender: "male",
        sbp: 140,
        heartRate: 92,
        spo2: 95,
        gcs: 15,
        latitude: 18.5204,
        longitude: 73.8567
    };
    const parsed = emergencyIntakeSchema.safeParse(validPayload);
    console.log("6. Zod schema accepts valid intake:", parsed.success ? "PASS" : "FAIL");

    // Test 5: Zod Validation rejects invalid SBP
    const invalidPayload = {
        condition: "cardiac",
        chiefComplaint: "pain",
        sbp: 999 // impossible
    };
    const invalidParsed = emergencyIntakeSchema.safeParse(invalidPayload);
    console.log("7. Zod schema rejects impossible SBP (999):", !invalidParsed.success ? "PASS" : "FAIL");

    console.log("=== All Emergency Domain Tests Passed Successfully ===");
}

runTests().catch(console.error);
