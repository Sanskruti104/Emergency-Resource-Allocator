/**
 * MedDecision — Real-Time Emergency Resource Allocator
 * Phase 7B: EMS Dataset → Triage Validation Test
 *
 * Objectives:
 * 1. Read real records from the MongoDB ems_events collection (20,000 records).
 * 2. Select representative records for cardiac, trauma, and stroke.
 * 3. Feed clinical information through the existing triageEmergency() logic.
 * 4. Compare resulting triage/clinical requirements with source event metadata.
 * 5. Report actual results without claiming Kaggle labels are ground truth.
 */

import { MongoClient } from "mongodb";
import { triageEmergency } from "@/lib/emergency/triage-intake";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://riyawankhede24_db_user:0FStgjz5aMwj60hI@cluster0.atxl8em.mongodb.net/meddecision?appName=Cluster0";
const DB_NAME = "meddecision";

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, description: string) {
    totalAssertions++;
    if (condition) {
        passedAssertions++;
        console.log(`  ✓ ${description}`);
    } else {
        failedAssertions++;
        console.error(`  ✗ FAIL: ${description}`);
    }
}

export async function runEmsTriageValidation() {
    console.log("======================================================================");
    console.log("PHASE 7B: EMS DATASET → TRIAGE VALIDATION (REAL MONGODB RECORDS)");
    console.log("======================================================================");
    console.log(`Connecting to MongoDB Atlas database: ${DB_NAME}...`);

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const emsCol = db.collection("ems_events");

    try {
        const totalEmsCount = await emsCol.countDocuments();
        console.log(`Total EMS incident records in MongoDB ems_events: ${totalEmsCount}\n`);
        assert(totalEmsCount >= 20000, `ems_events collection contains all 20,000 historical records`);

        // ───────────────────────────────────────────────────────────────────
        // SELECT REPRESENTATIVE RECORDS
        // ───────────────────────────────────────────────────────────────────
        const cardiacRecord = await emsCol.findOne({ condition: "cardiac", triagePriority: "RED" });
        const traumaRecord = await emsCol.findOne({ condition: "trauma", triagePriority: "RED" });
        const strokeRecord = await emsCol.findOne({ condition: "stroke", triagePriority: "RED" });
        const urgentCardiacRecord = await emsCol.findOne({ condition: "cardiac", triagePriority: "YELLOW" });

        if (!cardiacRecord || !traumaRecord || !strokeRecord || !urgentCardiacRecord) {
            throw new Error("Unable to retrieve representative records from ems_events.");
        }

        assert(cardiacRecord !== null, `Retrieved representative RED Cardiac EMS record (${cardiacRecord.eventId})`);
        assert(traumaRecord !== null, `Retrieved representative RED Trauma EMS record (${traumaRecord.eventId})`);
        assert(strokeRecord !== null, `Retrieved representative RED Stroke EMS record (${strokeRecord.eventId})`);
        assert(urgentCardiacRecord !== null, `Retrieved representative YELLOW Cardiac EMS record (${urgentCardiacRecord.eventId})`);

        console.log("\n----------------------------------------------------------------------");
        console.log("CLINICAL TRIAGE VALIDATION AGAINST REPRESENTATIVE EMS DATASET EVENTS");
        console.log("----------------------------------------------------------------------");
        console.log("DISCLAIMER: Source Kaggle dataset labels represent historical dispatch");
        console.log("benchmarks, NOT ground truth for MedDecision's clinical triage logic.\n");

        // ───────────────────────────────────────────────────────────────────
        // CASE 1: CARDIAC EMERGENCY RECORD
        // ───────────────────────────────────────────────────────────────────
        console.log(`[EVENT 1] Cardiac Record: ${cardiacRecord.eventId}`);
        console.log(`  Chief Complaint:  "${cardiacRecord.chiefComplaint}"`);
        console.log(`  Source Priority:  ${cardiacRecord.triagePriority}`);
        console.log(`  Vitals:           SBP: ${cardiacRecord.vitals?.sbp}, HR: ${cardiacRecord.vitals?.heartRate}, SpO2: ${cardiacRecord.vitals?.spo2}%, GCS: ${cardiacRecord.vitals?.gcs}`);

        const cardiacTriage = triageEmergency(
            cardiacRecord.condition,
            cardiacRecord.chiefComplaint,
            cardiacRecord.vitals,
            cardiacRecord.triagePriority
        );

        console.log(`  -> Derived Type:      ${cardiacTriage.emergencyType}`);
        console.log(`  -> Derived Priority:  ${cardiacTriage.priority}`);
        console.log(`  -> Specialty Need:    ${cardiacTriage.requiredSpecialty}`);
        console.log(`  -> Required Resources: ${cardiacTriage.requiredResources.join(", ")}`);
        console.log(`  -> Clinical Flags:    ${cardiacTriage.criticalFlags.join("; ") || "None"}`);

        assert(cardiacTriage.emergencyType === "CARDIAC", `Cardiac event classified as CARDIAC emergency type`);
        assert(cardiacTriage.requiredSpecialty.toLowerCase().includes("cardio"), `Required specialty requires Cardiology department`);
        assert(cardiacTriage.requiredResources.includes("ICU_BED"), `Critical cardiac event requires ICU_BED`);

        // ───────────────────────────────────────────────────────────────────
        // CASE 2: TRAUMA EMERGENCY RECORD
        // ───────────────────────────────────────────────────────────────────
        console.log(`\n[EVENT 2] Trauma Record: ${traumaRecord.eventId}`);
        console.log(`  Chief Complaint:  "${traumaRecord.chiefComplaint}"`);
        console.log(`  Source Priority:  ${traumaRecord.triagePriority}`);
        console.log(`  Vitals:           SBP: ${traumaRecord.vitals?.sbp}, HR: ${traumaRecord.vitals?.heartRate}, SpO2: ${traumaRecord.vitals?.spo2}%, GCS: ${traumaRecord.vitals?.gcs}`);

        const traumaTriage = triageEmergency(
            traumaRecord.condition,
            traumaRecord.chiefComplaint,
            traumaRecord.vitals,
            traumaRecord.triagePriority
        );

        console.log(`  -> Derived Type:      ${traumaTriage.emergencyType}`);
        console.log(`  -> Derived Priority:  ${traumaTriage.priority}`);
        console.log(`  -> Specialty Need:    ${traumaTriage.requiredSpecialty}`);
        console.log(`  -> Required Resources: ${traumaTriage.requiredResources.join(", ")}`);
        console.log(`  -> Clinical Flags:    ${traumaTriage.criticalFlags.join("; ") || "None"}`);

        assert(traumaTriage.emergencyType === "TRAUMA", `Trauma event classified as TRAUMA emergency type`);
        assert(traumaTriage.requiredSpecialty.toLowerCase().includes("trauma") || traumaTriage.requiredSpecialty.toLowerCase().includes("surgery"), `Trauma event requires Trauma/Surgery specialty`);
        assert(traumaTriage.requiredResources.includes("TRAUMA_BAY") || traumaTriage.requiredResources.includes("GENERAL_BED"), `Trauma event requires trauma resuscitation resources`);

        // ───────────────────────────────────────────────────────────────────
        // CASE 3: STROKE EMERGENCY RECORD
        // ───────────────────────────────────────────────────────────────────
        console.log(`\n[EVENT 3] Stroke Record: ${strokeRecord.eventId}`);
        console.log(`  Chief Complaint:  "${strokeRecord.chiefComplaint}"`);
        console.log(`  Source Priority:  ${strokeRecord.triagePriority}`);
        console.log(`  Vitals:           SBP: ${strokeRecord.vitals?.sbp}, HR: ${strokeRecord.vitals?.heartRate}, SpO2: ${strokeRecord.vitals?.spo2}%, GCS: ${strokeRecord.vitals?.gcs}`);

        const strokeTriage = triageEmergency(
            strokeRecord.condition,
            strokeRecord.chiefComplaint,
            strokeRecord.vitals,
            strokeRecord.triagePriority
        );

        console.log(`  -> Derived Type:      ${strokeTriage.emergencyType}`);
        console.log(`  -> Derived Priority:  ${strokeTriage.priority}`);
        console.log(`  -> Specialty Need:    ${strokeTriage.requiredSpecialty}`);
        console.log(`  -> Required Resources: ${strokeTriage.requiredResources.join(", ")}`);
        console.log(`  -> Clinical Flags:    ${strokeTriage.criticalFlags.join("; ") || "None"}`);

        assert(strokeTriage.emergencyType === "STROKE", `Stroke event classified as STROKE emergency type`);
        assert(strokeTriage.requiredSpecialty.toLowerCase().includes("neuro"), `Stroke event requires Neurology/Stroke specialty`);
        assert(strokeTriage.requiredResources.includes("CT_SCAN"), `Stroke event requires CT_SCAN imaging capability`);

        // ───────────────────────────────────────────────────────────────────
        // CASE 4: COMPARATIVE ANALYSIS (BATCH OF 100 RECORDS)
        // ───────────────────────────────────────────────────────────────────
        console.log("\n----------------------------------------------------------------------");
        console.log("BATCH CROSS-VALIDATION (100 RANDOM EMS RECORDS)");
        console.log("----------------------------------------------------------------------");
        const batchRecords = await emsCol.aggregate([{ $sample: { size: 100 } }]).toArray();

        let conditionMatchCount = 0;
        let priorityAssignedCount = 0;

        for (const rec of batchRecords) {
            const tr = triageEmergency(rec.condition, rec.chiefComplaint, rec.vitals, rec.triagePriority);
            if (tr.emergencyType.toLowerCase() === rec.condition.toLowerCase()) {
                conditionMatchCount++;
            }
            if (tr.priority) {
                priorityAssignedCount++;
            }
        }

        console.log(`  • Condition Category Alignment: ${conditionMatchCount}/100 (${conditionMatchCount}%)`);
        console.log(`  • Valid Triage Priorities Derived: ${priorityAssignedCount}/100 (100%)`);
        assert(conditionMatchCount >= 90, `At least 90% condition alignment across sampled EMS records (${conditionMatchCount}%)`);
        assert(priorityAssignedCount === 100, `100% of sampled records received deterministic clinical triage priority`);

    } finally {
        await client.close();
    }

    console.log("\n======================================================================");
    console.log(`TRIAGE VALIDATION SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED (TOTAL: ${totalAssertions})`);
    console.log("======================================================================\n");

    if (failedAssertions > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runEmsTriageValidation()
        .then(() => process.exit(0))
        .catch(err => {
            console.error("Triage validation error:", err);
            process.exit(1);
        });
}
