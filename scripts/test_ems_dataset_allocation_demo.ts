/**
 * MedDecision — Real-Time Emergency Resource Allocator
 * Phase 7B: EMS Dataset → Operational Allocation Demonstration & Nearest Suitable Rule
 *
 * Objectives:
 * 1. Read real EMS incident event from MongoDB ems_events collection.
 * 2. Convert to intake format without inventing GPS coordinates (explicit disclaimer).
 * 3. Run through existing triageEmergency() logic.
 * 4. Run through existing evaluateHospitals() / allocateEmergencyHospital().
 * 5. Display detailed candidate breakdown, resource availability, distance/ETA, and rejection reasons.
 * 6. Verify Task 5: "nearest unsuitable hospital !== selected hospital".
 */

import { MongoClient, ObjectId } from "mongodb";
import { triageEmergency } from "@/lib/emergency/triage-intake";
import { evaluateHospitals } from "@/lib/emergency/emergency-allocator";
import { IncidentLocation } from "@/lib/emergency/emergency-types";

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

export async function runEmsAllocationDemo() {
    console.log("======================================================================");
    console.log("PHASE 7B: EMS DATASET → LIVE ALLOCATION DEMONSTRATION");
    console.log("======================================================================");
    console.log(`Connecting to MongoDB Atlas database: ${DB_NAME}...`);

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    const emsCol = db.collection("ems_events");
    const hospitalsCol = db.collection("hospitals");

    const TEST_RUN_ID = `P7B-${Date.now().toString(36).toUpperCase()}`;

    try {
        // ───────────────────────────────────────────────────────────────────
        // STEP 1: QUERY REAL EMS EVENT FROM MONGODB
        // ───────────────────────────────────────────────────────────────────
        console.log("--- STEP 1: RETRIEVING REAL EMS EVENT FROM MONGODB ---");
        const emsEvent = await emsCol.findOne({
            condition: "cardiac",
            triagePriority: "RED",
            "vitals.sbp": { $lte: 90 } // Hemodynamic shock
        });

        assert(emsEvent !== null, `Retrieved real critical cardiac EMS event from ems_events collection`);
        if (!emsEvent) throw new Error("No matching EMS event found in database.");

        console.log("\n======================================================================");
        console.log("SOURCE EMS INCIDENT RECORD (KAGGLE DATASET IN MONGODB)");
        console.log("======================================================================");
        console.log(`Event ID:               ${emsEvent.eventId}`);
        console.log(`Condition:              ${emsEvent.condition}`);
        console.log(`Chief Complaint:        ${emsEvent.chiefComplaint}`);
        console.log(`Source Triage Priority: ${emsEvent.triagePriority}`);
        console.log(`Patient Demographics:   Age ${emsEvent.patient?.age}, Gender: ${emsEvent.patient?.gender}`);
        console.log(`Clinical Vitals:        SBP ${emsEvent.vitals?.sbp} mmHg, Heart Rate: ${emsEvent.vitals?.heartRate} bpm, SpO2: ${emsEvent.vitals?.spo2}%, GCS: ${emsEvent.vitals?.gcs}`);
        console.log(`Historical Target Type: ${emsEvent.targetHospitalType} (Benchmark ID: ${emsEvent.benchmarkHospitalId})`);
        console.log(`Source File:            ${emsEvent.metadata?.sourceFile} (Imported: ${new Date(emsEvent.metadata?.importedAt).toISOString()})`);
        console.log("\n[LOCATION TRANSPARENCY NOTICE]");
        console.log("Dataset event does not contain GPS coordinates; allocation demonstration uses the application's emergency location input.");

        // ───────────────────────────────────────────────────────────────────
        // STEP 2: RUN CLINICAL TRIAGE WITH EXISTING ENGINE
        // ───────────────────────────────────────────────────────────────────
        console.log("\n--- STEP 2: CLINICAL TRIAGE INTAKE (triageEmergency) ---");
        const triage = triageEmergency(
            emsEvent.condition,
            emsEvent.chiefComplaint,
            emsEvent.vitals,
            emsEvent.triagePriority
        );

        console.log(`Derived Emergency Type:     ${triage.emergencyType}`);
        console.log(`Assigned Triage Priority:   ${triage.priority}`);
        console.log(`Required Medical Specialty: ${triage.requiredSpecialty}`);
        console.log(`Mandatory Resources:        ${triage.requiredResources.join(", ")}`);
        console.log(`Clinical Risk Flags:        ${triage.criticalFlags.join("; ") || "Standard acute alert"}`);

        assert(triage.priority === "RED", `Clinical priority correctly assigned as RED`);
        assert(triage.requiredResources.includes("ICU_BED"), `Critical cardiac event mandates ICU_BED`);

        // ───────────────────────────────────────────────────────────────────
        // STEP 3: RUN ALLOCATOR AGAINST REAL OPERATIONAL HOSPITALS
        // ───────────────────────────────────────────────────────────────────
        console.log("\n--- STEP 3: ALLOCATOR EVALUATION (evaluateHospitals) ---");
        const incidentLocation: IncidentLocation = {
            latitude: 18.5204,
            longitude: 73.8567,
            address: "Shivajinagar Central Corridor, Pune"
        };

        const allocResult = await evaluateHospitals({
            condition: triage.emergencyType.toLowerCase(),
            chiefComplaint: emsEvent.chiefComplaint,
            priority: triage.priority,
            requiredSpecialty: triage.requiredSpecialty,
            requiredResources: triage.requiredResources,
            incidentLocation,
            vitals: emsEvent.vitals
        });

        assert(allocResult.success === true, `evaluateHospitals returned success`);
        assert(allocResult.totalCandidatesEvaluated > 0, `Evaluated operational hospitals from database (count: ${allocResult.totalCandidatesEvaluated})`);

        console.log(`\nEvaluated Candidates Count: ${allocResult.totalCandidatesEvaluated}`);
        console.log(`Verified Suitable Facilities: ${allocResult.suitableCount}\n`);

        console.log("----------------------------------------------------------------------------------------------------------------");
        console.log("HOSPITAL EVALUATION BREAKDOWN");
        console.log("----------------------------------------------------------------------------------------------------------------");
        for (const cand of allocResult.results) {
            console.log(`\nFacility: ${cand.hospitalName} [ID: ${cand.hospitalId}]`);
            console.log(`  Distance / ETA:       ${cand.distanceKm.toFixed(2)} km  |  ${cand.estimatedTravelMinutes} mins`);
            console.log(`  Telemetry Freshness:  ${cand.freshnessStatus} (Score: ${cand.freshnessScore}/100)`);
            console.log(`  ICU Capacity:         ${cand.availableCapacity?.availableIcuBeds} available / ${cand.availableCapacity?.icuBeds} total`);
            console.log(`  General Beds:         ${cand.availableCapacity?.availableBeds} available / ${cand.availableCapacity?.totalBeds} total`);
            console.log(`  Suitability:          ${cand.suitability ? "✓ SUITABLE" : "✗ REJECTED / UNSUITABLE"}`);

            if (cand.suitability) {
                console.log(`  Overall Match Score:  ${cand.overallScore}/100`);
                console.log(`  Primary Rationale:    ${cand.reasons[0]}`);
            } else {
                console.log(`  Missing Resources:    ${cand.missingResources.join(", ")}`);
                console.log(`  Rejection Reason:     ${cand.reasons[0]}`);
            }
        }
        console.log("----------------------------------------------------------------------------------------------------------------");

        const topSelected = allocResult.results[0];
        console.log(`\nSELECTED TOP HOSPITAL:    ${topSelected.hospitalName} [${topSelected.hospitalId}]`);
        console.log(`  Suitability:            ${topSelected.suitability ? "SUITABLE" : "UNSUITABLE"}`);
        console.log(`  Overall Match Score:    ${topSelected.overallScore}/100`);
        console.log(`  Distance / Travel Time: ${topSelected.distanceKm.toFixed(2)} km / ${topSelected.estimatedTravelMinutes} min`);
        console.log(`  Available ICU Beds:     ${topSelected.availableCapacity?.availableIcuBeds}`);
        console.log(`  Selection Explanation:  ${topSelected.reasons.join(" ")}`);

        assert(topSelected.suitability === true, `Top ranked hospital is clinically and operationally SUITABLE`);
        assert(topSelected.availableCapacity.availableIcuBeds > 0, `Top ranked hospital has available ICU capacity`);

        // ───────────────────────────────────────────────────────────────────
        // TASK 5: AUTOMATED ASSERTION — NEAREST SUITABLE VS NEAREST UNSUITABLE
        // ───────────────────────────────────────────────────────────────────
        console.log("\n======================================================================");
        console.log("TASK 5: VERIFY ALLOCATION RULE (NEAREST SUITABLE ≠ NEAREST)");
        console.log("======================================================================");
        console.log("Rule: A hospital with required resources farther away must be selected over a closer hospital lacking mandatory resources.");

        const nearUnsuitable = {
            _id: new ObjectId(),
            uid: `TEST-HOSP-NEAR-${TEST_RUN_ID}`,
            hospitalName: "Near District Dispensary (Lacks ICU)",
            latitude: 18.5250, // ~0.7 km away
            longitude: 73.8610,
            specialties: ["Cardiology"],
            instruments: ["cath_lab_system", "ventilator"],
            capacity: {
                totalBeds: 50,
                availableBeds: 10,
                occupiedBeds: 40,
                reservedBeds: 0,
                icuBeds: 6,
                availableIcuBeds: 0, // <--- ZERO ICU BEDS (MANDATORY DISQUALIFIER)
                occupiedIcuBeds: 6,
                reservedIcuBeds: 0,
                operationTheatres: 1,
                onDutySpecialist: 1,
                emergencyAvailable: true,
                updatedAt: new Date().toISOString()
            }
        };

        const farSuitable = {
            _id: new ObjectId(),
            uid: `TEST-HOSP-FAR-${TEST_RUN_ID}`,
            hospitalName: "Far Apex Critical Care Institute (Equipped)",
            latitude: 18.5680, // ~5.5 km away
            longitude: 73.8820,
            specialties: ["Cardiology", "Critical Care"],
            instruments: ["cath_lab_system", "ventilator", "icu_monitor"],
            capacity: {
                totalBeds: 150,
                availableBeds: 35,
                occupiedBeds: 110,
                reservedBeds: 5,
                icuBeds: 20,
                availableIcuBeds: 6, // <--- AMPLE ICU CAPACITY
                occupiedIcuBeds: 13,
                reservedIcuBeds: 1,
                operationTheatres: 3,
                onDutySpecialist: 4,
                emergencyAvailable: true,
                updatedAt: new Date().toISOString()
            }
        };

        // Insert controlled fixtures into MongoDB
        await hospitalsCol.insertMany([nearUnsuitable, farSuitable]);

        const ruleTestResult = await evaluateHospitals({
            condition: "cardiac",
            chiefComplaint: "Acute STEMI in cardiogenic shock",
            priority: "RED",
            requiredSpecialty: "Cardiology",
            requiredResources: ["ICU_BED", "CATH_LAB"],
            incidentLocation,
            candidateHospitals: [nearUnsuitable, farSuitable]
        });

        const nearEval = ruleTestResult.results.find(r => r.hospitalId === nearUnsuitable.uid);
        const farEval = ruleTestResult.results.find(r => r.hospitalId === farSuitable.uid);

        assert(nearEval !== undefined && farEval !== undefined, `Both controlled test hospitals evaluated`);
        assert(nearEval!.distanceKm < farEval!.distanceKm, `Hospital Near is physically closer (${nearEval!.distanceKm.toFixed(2)} km vs ${farEval!.distanceKm.toFixed(2)} km)`);
        assert(nearEval!.suitability === false, `Hospital Near is marked UNSUITABLE due to 0 ICU beds`);
        assert(farEval!.suitability === true, `Hospital Far is marked SUITABLE with complete resource match`);

        const chosenHosp = ruleTestResult.results[0];
        assert(chosenHosp.hospitalId === farSuitable.uid, `Selected hospital is the farther suitable facility`);
        assert(chosenHosp.hospitalId !== nearUnsuitable.uid, `CONFIRMED: nearest unsuitable hospital (${nearEval!.distanceKm.toFixed(2)} km) ≠ selected hospital (${farEval!.distanceKm.toFixed(2)} km)`);

        // Clean up test fixtures
        await hospitalsCol.deleteMany({
            uid: { $in: [nearUnsuitable.uid, farSuitable.uid] }
        });
        console.log("  ✓ Cleaned up temporary rule-verification fixtures.");

    } finally {
        await client.close();
    }

    console.log("\n======================================================================");
    console.log(`ALLOCATION DEMO SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED (TOTAL: ${totalAssertions})`);
    console.log("======================================================================\n");

    if (failedAssertions > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runEmsAllocationDemo()
        .then(() => process.exit(0))
        .catch(err => {
            console.error("Allocation demo failed:", err);
            process.exit(1);
        });
}
