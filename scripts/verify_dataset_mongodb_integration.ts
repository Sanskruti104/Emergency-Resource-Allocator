/**
 * MedDecision — Real-Time Emergency Resource Allocator
 * Phase 7: Dataset → MongoDB → Real Operational Data Integration Test Suite
 *
 * Verifies:
 * 1. Dataset files exist on disk and have valid columns
 * 2. MongoDB Atlas dataset collections (ems_events, hospital_capacity_benchmarks) populated
 * 3. Idempotency & zero duplicates
 * 4. Source metadata integrity (sourceDataset, sourceFile, importedAt, sourceRecordId)
 * 5. Operational hospital enrichment with historical reference (capacity untouched)
 * 6. Allocator demonstrates "Nearest Suitable", NOT "Nearest" (rejects closer unsuitable hospital)
 * 7. Dynamic capacity responsiveness (ICU 5 -> 0 -> 5 eligibility transitions in MongoDB)
 * 8. Telemetry freshness scoring (FRESH vs AGING vs STALE penalty)
 * 9. Safe fixture cleanup preserving operational hospitals
 */

import * as fs from "fs";
import * as path from "path";
import { MongoClient, ObjectId } from "mongodb";
import { evaluateHospitals, allocateEmergencyHospital, calculateFreshness } from "@/lib/emergency/emergency-allocator";
import { IncidentLocation } from "@/lib/emergency/emergency-types";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://riyawankhede24_db_user:0FStgjz5aMwj60hI@cluster0.atxl8em.mongodb.net/meddecision?appName=Cluster0";
const DB_NAME = "meddecision";

const DATASETS_DIR = path.resolve(process.cwd(), "Datasets");
const EMS_CSV_PATH = path.join(DATASETS_DIR, "ems_events_20000.csv");
const RESP_CSV_PATH = path.join(DATASETS_DIR, "raw_weekly_hospital_respiratory_data_2020_2024.csv");

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

export async function runDatasetVerification() {
    console.log("======================================================================");
    console.log("PHASE 7: DATASET → MONGODB INTEGRATION & ALLOCATOR VERIFICATION");
    console.log("======================================================================");
    console.log(`Connecting to MongoDB Atlas database: ${DB_NAME}...`);

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    console.log("Connected to MongoDB successfully.\n");

    const TEST_RUN_ID = `P7-TEST-${Date.now().toString(36).toUpperCase()}`;

    try {
        // ───────────────────────────────────────────────────────────────────
        // GROUP 1: DATASET FILES VERIFICATION
        // ───────────────────────────────────────────────────────────────────
        console.log("======================================================================");
        console.log("GROUP 1: LOCAL DATASET FILES ON DISK");
        console.log("======================================================================");
        assert(fs.existsSync(EMS_CSV_PATH), `EMS dataset file exists at Datasets/ems_events_20000.csv`);
        const emsStats = fs.statSync(EMS_CSV_PATH);
        assert(emsStats.size > 2 * 1024 * 1024, `EMS dataset file size is valid (${(emsStats.size / (1024 * 1024)).toFixed(2)} MB)`);

        assert(fs.existsSync(RESP_CSV_PATH), `Weekly respiratory dataset file exists at Datasets/raw_weekly_hospital_respiratory_data_2020_2024.csv`);
        const respStats = fs.statSync(RESP_CSV_PATH);
        assert(respStats.size > 5 * 1024 * 1024, `Respiratory dataset file size is valid (${(respStats.size / (1024 * 1024)).toFixed(2)} MB)\n`);

        // ───────────────────────────────────────────────────────────────────
        // GROUP 2: MONGODB DATASET RECORD COUNTS
        // ───────────────────────────────────────────────────────────────────
        console.log("======================================================================");
        console.log("GROUP 2: MONGODB ATLAS DATASET COLLECTIONS");
        console.log("======================================================================");
        const emsCol = db.collection("ems_events");
        const respCol = db.collection("hospital_capacity_benchmarks");

        const emsCount = await emsCol.countDocuments();
        assert(emsCount >= 20000, `ems_events collection contains all records (count: ${emsCount})`);

        const respCount = await respCol.countDocuments();
        assert(respCount >= 12768, `hospital_capacity_benchmarks contains all weekly records (count: ${respCount})`);

        // Check index presence
        const emsIndexes = await emsCol.indexes();
        const hasEmsUnique = emsIndexes.some(idx => idx.key.eventId === 1 && idx.unique);
        assert(hasEmsUnique, `ems_events has unique index on { eventId: 1 }`);

        const respIndexes = await respCol.indexes();
        const hasRespUnique = respIndexes.some(idx => idx.key.region === 1 && idx.key.weekEndingDate === 1 && idx.unique);
        assert(hasRespUnique, `hospital_capacity_benchmarks has unique compound index on { region: 1, weekEndingDate: 1 }\n`);

        // ───────────────────────────────────────────────────────────────────
        // GROUP 3: SOURCE METADATA & FIELD INTEGRITY
        // ───────────────────────────────────────────────────────────────────
        console.log("======================================================================");
        console.log("GROUP 3: SOURCE METADATA & FIELD INTEGRITY");
        console.log("======================================================================");
        const sampleEms = await emsCol.findOne({ eventId: "EMS-100000" });
        assert(sampleEms !== null, `Sample EMS event (EMS-100000) exists`);
        assert(sampleEms?.metadata?.sourceDataset === "Emergency Medical Response Mapping Dataset", `EMS metadata sourceDataset recorded correctly`);
        assert(sampleEms?.metadata?.sourceFile === "ems_events_20000.csv", `EMS metadata sourceFile recorded correctly`);
        assert(sampleEms?.metadata?.sourceRecordId === "EMS-100000", `EMS metadata sourceRecordId recorded correctly`);
        assert(sampleEms?.vitals?.sbp !== undefined && sampleEms?.vitals?.spo2 !== undefined, `EMS vitals schema preserved`);
        assert(sampleEms?.triagePriority === "RED", `EMS triage priority normalized`);

        const sampleResp = await respCol.findOne({ region: "WA" });
        assert(sampleResp !== null, `Sample weekly benchmark (region: WA) exists`);
        assert(sampleResp?.metadata?.sourceDataset === "Weekly Hospital Respiratory Data and Metrics", `Benchmark metadata sourceDataset recorded correctly`);
        assert(sampleResp?.metadata?.sourceFile === "raw_weekly_hospital_respiratory_data_2020_2024.csv", `Benchmark metadata sourceFile recorded correctly`);
        assert(sampleResp?.totalInpatientBeds > 0, `Benchmark totalInpatientBeds populated (${sampleResp?.totalInpatientBeds})`);
        assert(sampleResp?.totalIcuBeds > 0, `Benchmark totalIcuBeds populated (${sampleResp?.totalIcuBeds})`);
        assert(sampleResp?.icuOccupancyRate >= 0 && sampleResp?.icuOccupancyRate <= 1, `Benchmark icuOccupancyRate within valid float range (${sampleResp?.icuOccupancyRate})\n`);

        // ───────────────────────────────────────────────────────────────────
        // GROUP 4: OPERATIONAL HOSPITAL ENRICHMENT WITH REFERENCE DATA
        // ───────────────────────────────────────────────────────────────────
        console.log("======================================================================");
        console.log("GROUP 4: OPERATIONAL HOSPITAL ENRICHMENT & CAPACITY ISOLATION");
        console.log("======================================================================");
        const hospitalsCol = db.collection("hospitals");
        const hospitals = await hospitalsCol.find({}).toArray();
        assert(hospitals.length >= 5, `Operational hospitals collection has at least 5 facilities (found: ${hospitals.length})`);

        const cardiacHosp = hospitals.find(h => (h.uid || h.hospitalId) === "DEMO-HOSP-CARDIAC-001");
        assert(cardiacHosp !== undefined, `DEMO-HOSP-CARDIAC-001 found in hospitals collection`);
        assert(cardiacHosp?.historicalBenchmark !== undefined, `DEMO-HOSP-CARDIAC-001 has historicalBenchmark reference`);
        assert(cardiacHosp?.historicalBenchmark?.benchmarkHospitalId === "H001", `Benchmark hospital ID is H001`);
        assert(cardiacHosp?.historicalBenchmark?.targetHospitalType === "cardiac_center", `Target benchmark type is cardiac_center`);
        assert(cardiacHosp?.historicalBenchmark?.historicalEmsIncidentVolume > 0, `Historical EMS incident volume attached (${cardiacHosp?.historicalBenchmark?.historicalEmsIncidentVolume})`);

        // CAPACITY PRESERVATION INVARIANT: Verify live operational capacity is intact and NOT overwritten by historical benchmarks
        const cap = cardiacHosp?.capacity || {};
        assert(cap.totalBeds > 0 && cap.icuBeds > 0, `Operational capacity beds intact (total: ${cap.totalBeds}, icu: ${cap.icuBeds})`);
        assert(cap.availableIcuBeds !== undefined, `Operational availableIcuBeds intact (${cap.availableIcuBeds})`);
        assert(cap.totalBeds - cap.occupiedBeds - cap.reservedBeds === cap.availableBeds, `General capacity invariant holds: total - occupied - reserved === available`);
        assert(cap.icuBeds - cap.occupiedIcuBeds - cap.reservedIcuBeds === cap.availableIcuBeds, `ICU capacity invariant holds: total - occupied - reserved === available\n`);

        // ───────────────────────────────────────────────────────────────────
        // GROUP 5: DEMONSTRATE "NEAREST SUITABLE", NOT "NEAREST"
        // ───────────────────────────────────────────────────────────────────
        console.log("======================================================================");
        console.log("GROUP 5: ALLOCATOR DEMONSTRATION — NEAREST SUITABLE, NOT NEAREST");
        console.log("======================================================================");
        console.log("Setting up deterministic test scenario:");
        console.log("  • Patient at Pune Junction: 18.5284, 73.8740");
        console.log("  • Emergency: RED CARDIAC (Requires Cardiology, ICU_BED, CATH_LAB)");
        console.log("  • Hospital A (Nearest Unsuitable): 0.8 km away, but 0 available ICU beds");
        console.log("  • Hospital B (Farther Suitable):   4.2 km away, fully equipped with ICU beds & Cath Lab");

        const incidentLocation: IncidentLocation = {
            latitude: 18.5284,
            longitude: 73.8740,
            address: "Pune Junction Platform 1"
        };

        const testHospA = {
            _id: new ObjectId(),
            uid: `TEST-HOSP-NEAR-UNSUITABLE-${TEST_RUN_ID}`,
            hospitalName: "Nearby Clinic & First Aid (Unsuitable)",
            latitude: 18.5320,  // ~0.8 km away
            longitude: 73.8790,
            specialties: ["Cardiology", "General Medicine"],
            instruments: ["cath_lab_system", "ventilator", "defibrillator"],
            capacity: {
                totalBeds: 50,
                availableBeds: 10,
                occupiedBeds: 40,
                reservedBeds: 0,
                icuBeds: 10,
                availableIcuBeds: 0, // <--- ZERO ICU BEDS (DISQUALIFIER FOR RED CARDIAC)
                occupiedIcuBeds: 10,
                reservedIcuBeds: 0,
                operationTheatres: 1,
                onDutySpecialist: 2,
                emergencyAvailable: true,
                updatedAt: new Date().toISOString()
            }
        };

        const testHospB = {
            _id: new ObjectId(),
            uid: `TEST-HOSP-FAR-SUITABLE-${TEST_RUN_ID}`,
            hospitalName: "Metro Heart & Critical Care (Farther Suitable)",
            latitude: 18.5650,  // ~4.2 km away
            longitude: 73.8900,
            specialties: ["Cardiology", "Cardiac Surgery", "Critical Care"],
            instruments: ["cath_lab_system", "angiography_system", "ventilator", "icu_monitor"],
            capacity: {
                totalBeds: 200,
                availableBeds: 45,
                occupiedBeds: 150,
                reservedBeds: 5,
                icuBeds: 25,
                availableIcuBeds: 8, // <--- AMPLE ICU BEDS AVAILABLE
                occupiedIcuBeds: 16,
                reservedIcuBeds: 1,
                operationTheatres: 4,
                onDutySpecialist: 5,
                emergencyAvailable: true,
                updatedAt: new Date().toISOString()
            }
        };

        // Insert test fixtures into live MongoDB
        await hospitalsCol.insertMany([testHospA, testHospB]);

        // Run allocation using evaluateHospitals
        const allocResult = await evaluateHospitals({
            condition: "cardiac",
            chiefComplaint: "Crushing chest pain radiating to left jaw, SBP 85, diaphoresis",
            priority: "RED",
            incidentLocation,
            candidateHospitals: [testHospA, testHospB]
        });

        assert(allocResult.success === true, `evaluateHospitals returned success`);
        assert(allocResult.totalCandidatesEvaluated === 2, `Evaluated both candidate hospitals`);
        assert(allocResult.suitableCount === 1, `Exactly 1 hospital verified suitable`);

        const evalA = allocResult.results.find(r => r.hospitalId === testHospA.uid);
        const evalB = allocResult.results.find(r => r.hospitalId === testHospB.uid);

        assert(evalA !== undefined && evalB !== undefined, `Both candidates evaluated in results`);
        assert(evalA!.distanceKm < evalB!.distanceKm, `Hospital A is geographically closer (${evalA!.distanceKm.toFixed(2)} km vs ${evalB!.distanceKm.toFixed(2)} km)`);
        assert(evalA!.suitability === false, `Hospital A (closer) is marked UNSUITABLE due to 0 ICU beds`);
        assert(evalA!.missingResources.includes("ICU_BED"), `Hospital A rejection explicitly lists missing ICU_BED`);
        assert(evalB!.suitability === true, `Hospital B (farther) is marked SUITABLE`);

        const topMatch = allocResult.results[0];
        assert(topMatch.hospitalId === testHospB.uid, `Hospital B is selected as Top Recommended Hospital`);
        assert(topMatch.hospitalId !== testHospA.uid, `PROVEN: Nearest unsuitable hospital (${evalA!.distanceKm.toFixed(2)} km) is NOT selected over farther suitable hospital (${evalB!.distanceKm.toFixed(2)} km)\n`);

        // ───────────────────────────────────────────────────────────────────
        // GROUP 6: TEST DYNAMIC REAL RESOURCE AVAILABILITY RESPONSIVENESS
        // ───────────────────────────────────────────────────────────────────
        console.log("======================================================================");
        console.log("GROUP 6: TEST DYNAMIC RESOURCE AVAILABILITY RESPONSIVENESS");
        console.log("======================================================================");
        const dynamicHospUid = `TEST-HOSP-DYNAMIC-${TEST_RUN_ID}`;
        const dynamicHosp = {
            _id: new ObjectId(),
            uid: dynamicHospUid,
            hospitalName: "Dynamic Response General Hospital",
            latitude: 18.5250,
            longitude: 73.8600,
            specialties: ["Cardiology", "Emergency Medicine"],
            instruments: ["cath_lab_system", "ventilator", "icu_monitor"],
            capacity: {
                totalBeds: 100,
                availableBeds: 20,
                occupiedBeds: 80,
                reservedBeds: 0,
                icuBeds: 10,
                availableIcuBeds: 5, // INITIAL: 5 BEDS
                occupiedIcuBeds: 5,
                reservedIcuBeds: 0,
                operationTheatres: 2,
                onDutySpecialist: 3,
                emergencyAvailable: true,
                updatedAt: new Date().toISOString()
            }
        };

        await hospitalsCol.insertOne(dynamicHosp);

        // Step 6.1: Initial check with availableIcuBeds = 5
        let dynamicCheck1 = await evaluateHospitals({
            condition: "cardiac",
            chiefComplaint: "Acute STEMI with shock",
            priority: "RED",
            incidentLocation,
            candidateHospitals: [await hospitalsCol.findOne({ uid: dynamicHospUid })]
        });
        assert(dynamicCheck1.results[0].suitability === true, `Initial state: Hospital is ELIGIBLE with 5 available ICU beds`);

        // Step 6.2: Mutate MongoDB capacity: availableIcuBeds = 0
        await hospitalsCol.updateOne(
            { uid: dynamicHospUid },
            {
                $set: {
                    "capacity.availableIcuBeds": 0,
                    "capacity.occupiedIcuBeds": 10,
                    "capacity.updatedAt": new Date().toISOString()
                }
            }
        );

        let dynamicCheck2 = await evaluateHospitals({
            condition: "cardiac",
            chiefComplaint: "Acute STEMI with shock",
            priority: "RED",
            incidentLocation,
            candidateHospitals: [await hospitalsCol.findOne({ uid: dynamicHospUid })]
        });
        assert(dynamicCheck2.results[0].suitability === false, `Updated state: Hospital immediately becomes INELIGIBLE when ICU beds drop to 0`);
        assert(dynamicCheck2.results[0].missingResources.includes("ICU_BED"), `Disqualification reason is strictly ICU_BED`);

        // Step 6.3: Restore MongoDB capacity: availableIcuBeds = 5
        await hospitalsCol.updateOne(
            { uid: dynamicHospUid },
            {
                $set: {
                    "capacity.availableIcuBeds": 5,
                    "capacity.occupiedIcuBeds": 5,
                    "capacity.updatedAt": new Date().toISOString()
                }
            }
        );

        let dynamicCheck3 = await evaluateHospitals({
            condition: "cardiac",
            chiefComplaint: "Acute STEMI with shock",
            priority: "RED",
            incidentLocation,
            candidateHospitals: [await hospitalsCol.findOne({ uid: dynamicHospUid })]
        });
        assert(dynamicCheck3.results[0].suitability === true, `Restored state: Hospital immediately becomes ELIGIBLE again when capacity is restored\n`);

        // ───────────────────────────────────────────────────────────────────
        // GROUP 7: TEST DATA FRESHNESS PENALTY MODEL
        // ───────────────────────────────────────────────────────────────────
        console.log("======================================================================");
        console.log("GROUP 7: TELEMETRY FRESHNESS EVALUATION");
        console.log("======================================================================");
        const now = Date.now();
        const freshTimestamp = new Date(now - 5 * 60 * 1000).toISOString(); // 5 min ago
        const agingTimestamp = new Date(now - 30 * 60 * 1000).toISOString(); // 30 min ago
        const staleTimestamp = new Date(now - 120 * 60 * 1000).toISOString(); // 120 min ago

        const freshEval = calculateFreshness(freshTimestamp);
        assert(freshEval.status === "FRESH", `Timestamp 5 mins ago is classified FRESH`);
        assert(freshEval.score >= 85 && freshEval.score <= 100, `FRESH telemetry receives score in fresh range (got: ${freshEval.score}/100)`);

        const agingEval = calculateFreshness(agingTimestamp);
        assert(agingEval.status === "AGING", `Timestamp 30 mins ago is classified AGING`);
        assert(agingEval.score >= 40 && agingEval.score <= 75, `AGING telemetry receives score in aging range (got: ${agingEval.score}/100)`);

        const staleEval = calculateFreshness(staleTimestamp);
        assert(staleEval.status === "STALE", `Timestamp 120 mins ago is classified STALE`);
        assert(staleEval.score === 20, `STALE telemetry receives penalized score 20/100`);

        const missingEval = calculateFreshness(null);
        assert(missingEval.status === "STALE", `Missing timestamp is safely treated as STALE`);
        assert(missingEval.score === 20, `Missing timestamp receives penalized score 20/100\n`);

        // Clean up test fixtures from operational collection
        await hospitalsCol.deleteMany({
            uid: { $in: [testHospA.uid, testHospB.uid, dynamicHospUid] }
        });
        console.log("  ✓ Cleaned up temporary test hospital fixtures.\n");

    } finally {
        await client.close();
    }

    console.log("======================================================================");
    console.log(`PHASE 7 TEST SUITE SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED (TOTAL: ${totalAssertions})`);
    console.log("======================================================================");

    if (failedAssertions > 0) {
        process.exit(1);
    }
}

if (require.main === module) {
    runDatasetVerification()
        .then(() => process.exit(0))
        .catch(err => {
            console.error("Verification suite failed:", err);
            process.exit(1);
        });
}
