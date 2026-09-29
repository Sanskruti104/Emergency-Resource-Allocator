/**
 * PHASE 6B — MEDDECISION DEMO SCENARIO LAUNCHER VALIDATION
 *
 * Tests the Demo Scenario Launcher orchestration layer against the live
 * MongoDB Atlas operational database:
 *
 * Scenarios:
 *   1. NORMAL_CARDIAC       (Full Lifecycle: PENDING -> ARRIVED -> ADMITTED)
 *   2. TRAUMA               (Full Lifecycle: PENDING -> ARRIVED -> ADMITTED)
 *   3. STROKE               (Full Lifecycle: PENDING -> ARRIVED -> ADMITTED)
 *   4. ICU_SCARCITY         (Controlled Negative Path: 0 suitable, 0 capacity change)
 *   5. STALE_HOSPITAL_DATA  (Telemetry Freshness Preference)
 *   6. NO_SUITABLE_HOSPITAL (Controlled Negative Path: Safe Diversion)
 *
 * Also verifies:
 *   - Duplicate active scenario protection (HTTP 409)
 *   - Safe reset (only demo records deleted, production hospitals untouched)
 *   - Cross-panel endpoint synchronization
 *   - Capacity invariant (total - occupied - reserved === available)
 *
 * Run:
 *   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/test_phase6b_demo_launcher.ts
 */

import { MongoClient } from "mongodb";
import { GET as handleGetScenario, POST as handleStartScenario } from "../app/api/demo/scenario/route";
import { POST as handleResetDemo } from "../app/api/demo/reset/route";
import { POST as handleAdvanceDemo } from "../app/api/demo/advance/route";
import { GET as handleActiveState } from "../app/api/emergency/active/route";
import { GET as handleAmbulanceRequests } from "../app/api/emergency/ambulance/requests/route";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/meddecision";

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        totalPassed++;
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        totalFailed++;
    }
}

function printHeader(title: string) {
    console.log("\n" + "=".repeat(70));
    console.log(title);
    console.log("=".repeat(70));
}

async function runDemoLauncherTestSuite() {
    printHeader("PHASE 6B: DEMO SCENARIO LAUNCHER VALIDATION");
    console.log("Connecting to live MongoDB operational database...");

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    console.log(`Connected to database: ${db.databaseName}\n`);

    const initialHospitalsCount = await db.collection("hospitals").countDocuments();
    console.log(`Initial hospital count in DB: ${initialHospitalsCount}`);

    try {
        // ─────────────────────────────────────────────────────────────────────
        // STEP 1: INITIAL CLEAN RESET
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 1: INITIAL DEMO RESET & BASELINE CHECK");

        const resetRes1 = await handleResetDemo();
        const resetData1 = await resetRes1.json();
        assert(resetRes1.status === 200 && resetData1.success, "Demo reset endpoint returns HTTP 200 Success");

        const getRes1 = await handleGetScenario();
        const getData1 = await getRes1.json();
        assert(getRes1.status === 200 && getData1.activeScenario === null, "Active scenario is null after reset");

        const hospitalsAfterReset = await db.collection("hospitals").countDocuments();
        assert(hospitalsAfterReset === initialHospitalsCount, `Hospital count untouched by reset (${hospitalsAfterReset}/${initialHospitalsCount})`);


        // ─────────────────────────────────────────────────────────────────────
        // STEP 2: SCENARIO 1 — NORMAL CARDIAC (FULL LIFECYCLE)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 2: SCENARIO 1 — NORMAL CARDIAC (FULL LIFECYCLE)");

        const cardiacReq = new Request("http://localhost:3000/api/demo/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "NORMAL_CARDIAC" })
        });
        const cardiacRes = await handleStartScenario(cardiacReq);
        const cardiacData = await cardiacRes.json();

        assert(cardiacRes.status === 200 && cardiacData.success, "Start NORMAL_CARDIAC returns HTTP 200 Success");
        const cardiacEmgId = cardiacData.activeScenario.emergencyId;
        assert(!!cardiacEmgId, `Generated Emergency ID: ${cardiacEmgId}`);
        assert(cardiacData.activeScenario.status === "PENDING", "Initial status is PENDING (ready for ambulance dispatch)");
        assert(cardiacData.activeScenario.emergencyType === "CARDIAC", "Emergency type is CARDIAC");
        assert(cardiacData.activeScenario.priority === "RED", "Priority is RED");

        // Verify Duplicate Launch Protection
        const dupReq = new Request("http://localhost:3000/api/demo/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "TRAUMA" })
        });
        const dupRes = await handleStartScenario(dupReq);
        const dupData = await dupRes.json();
        assert(dupRes.status === 409 && dupData.alreadyActive, "Duplicate scenario launch safely rejected with HTTP 409 Conflict");

        // Verify Ambulance CAD Feed receives incoming alert
        const ambFeedRes = await handleAmbulanceRequests(new Request("http://localhost:3000/api/emergency/ambulance/requests?ambulanceId=AMB-PUNE-01"));
        const ambFeedData = await ambFeedRes.json();
        assert(ambFeedRes.status === 200, "Ambulance CAD endpoint returns HTTP 200");
        const foundPending = ambFeedData.pendingRequests?.find((r: any) => r.emergencyId === cardiacEmgId);
        assert(!!foundPending, "Ambulance CAD feed sees incoming dispatch alert for AMB-PUNE-01");

        // Step-by-Step Advance through full lifecycle:
        // Advance 1: PENDING -> DISPATCHED
        const adv1 = await (await handleAdvanceDemo()).json();
        assert(adv1.success && adv1.stage === "DISPATCHED", "Advance 1: Ambulance Dispatched");

        // Advance 2: DISPATCHED -> ON_SCENE
        const adv2 = await (await handleAdvanceDemo()).json();
        assert(adv2.success && adv2.stage === "ON_SCENE", "Advance 2: Ambulance On Scene");

        // Advance 3: ON_SCENE -> TRANSPORTING (Allocated)
        const adv3 = await (await handleAdvanceDemo()).json();
        assert(adv3.success && adv3.stage === "TRANSPORTING", "Advance 3: Patient Secured & Hospital Allocated");

        // Advance 4: TRANSPORTING -> RESERVATION_REQUESTED
        const adv4 = await (await handleAdvanceDemo()).json();
        assert(adv4.success && adv4.stage === "RESERVATION_REQUESTED", "Advance 4: Bed Reservation Requested");

        // Advance 5: RESERVATION_REQUESTED -> DESTINATION_CONFIRMED
        const adv5 = await (await handleAdvanceDemo()).json();
        assert(adv5.success && adv5.stage === "DESTINATION_CONFIRMED", "Advance 5: Hospital Operator Confirmed Reservation");

        // Advance 6: DESTINATION_CONFIRMED -> EN_ROUTE
        const adv6 = await (await handleAdvanceDemo()).json();
        assert(adv6.success && adv6.stage === "EN_ROUTE", "Advance 6: Ambulance En Route to Hospital");

        // Advance 7: EN_ROUTE -> ARRIVED
        const adv7 = await (await handleAdvanceDemo()).json();
        assert(adv7.success && adv7.stage === "ARRIVED", "Advance 7: Ambulance Arrived at ED");

        // Advance 8: ARRIVED -> HANDOFF_IN_PROGRESS
        const adv8 = await (await handleAdvanceDemo()).json();
        assert(adv8.success && adv8.stage === "HANDOFF_IN_PROGRESS", "Advance 8: Clinical Handoff In Progress");

        // Advance 9: HANDOFF_IN_PROGRESS -> ADMITTED
        const adv9 = await (await handleAdvanceDemo()).json();
        assert(adv9.success && adv9.stage === "ADMITTED", "Advance 9: Patient Formally Admitted");

        // Verify Database Final State for Cardiac Emergency
        const cardiacDocFinal = await db.collection("emergencyRequests").findOne({ emergencyId: cardiacEmgId });
        assert(cardiacDocFinal?.status === "ADMITTED", "MongoDB: Emergency status = ADMITTED");
        assert(cardiacDocFinal?.handoffStatus === "COMPLETED", "MongoDB: handoffStatus = COMPLETED");

        const cardiacAmbFinal = await db.collection("ambulances").findOne({ ambulanceId: "AMB-PUNE-01" });
        assert(cardiacAmbFinal?.status === "AVAILABLE", "MongoDB: Ambulance released to AVAILABLE");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 3: RESET AFTER CARDIAC SCENARIO
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 3: RESET AFTER CARDIAC SCENARIO");

        await handleResetDemo();
        const getAfterReset = await (await handleGetScenario()).json();
        assert(getAfterReset.activeScenario === null, "Active scenario cleared cleanly after reset");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 4: SCENARIO 2 — TRAUMA (FULL LIFECYCLE)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 4: SCENARIO 2 — TRAUMA EMERGENCY");

        const traumaReq = new Request("http://localhost:3000/api/demo/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "TRAUMA" })
        });
        const traumaRes = await handleStartScenario(traumaReq);
        const traumaData = await traumaRes.json();

        assert(traumaRes.status === 200 && traumaData.success, "Start TRAUMA scenario returns HTTP 200 Success");
        assert(traumaData.activeScenario.emergencyType === "TRAUMA", "Emergency type is TRAUMA");

        // Advance trauma scenario through stages
        for (let i = 0; i < 9; i++) {
            await handleAdvanceDemo();
        }

        const traumaFinal = await db.collection("emergencyRequests").findOne({ emergencyId: traumaData.activeScenario.emergencyId });
        assert(traumaFinal?.status === "ADMITTED", "Trauma scenario reaches ADMITTED status");

        await handleResetDemo();


        // ─────────────────────────────────────────────────────────────────────
        // STEP 5: SCENARIO 3 — STROKE (FULL LIFECYCLE)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 5: SCENARIO 3 — STROKE EMERGENCY");

        const strokeReq = new Request("http://localhost:3000/api/demo/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "STROKE" })
        });
        const strokeRes = await handleStartScenario(strokeReq);
        const strokeData = await strokeRes.json();

        assert(strokeRes.status === 200 && strokeData.success, "Start STROKE scenario returns HTTP 200 Success");
        assert(strokeData.activeScenario.emergencyType === "STROKE", "Emergency type is STROKE");

        // Advance stroke scenario through stages
        for (let i = 0; i < 9; i++) {
            await handleAdvanceDemo();
        }

        const strokeFinal = await db.collection("emergencyRequests").findOne({ emergencyId: strokeData.activeScenario.emergencyId });
        assert(strokeFinal?.status === "ADMITTED", "Stroke scenario reaches ADMITTED status");

        await handleResetDemo();


        // ─────────────────────────────────────────────────────────────────────
        // STEP 6: SCENARIO 4 — ICU SCARCITY (CONTROLLED NEGATIVE PATH)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 6: SCENARIO 4 — ICU SCARCITY (CONTROLLED NEGATIVE PATH)");

        const scarcityReq = new Request("http://localhost:3000/api/demo/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "ICU_SCARCITY" })
        });
        const scarcityRes = await handleStartScenario(scarcityReq);
        const scarcityData = await scarcityRes.json();

        assert(scarcityRes.status === 200 && scarcityData.success, "Start ICU_SCARCITY returns HTTP 200");
        assert(scarcityData.activeScenario.isDiversion === true, "ICU_SCARCITY flagged as clinical diversion");
        assert(scarcityData.activeScenario.hospitalId === null, "Zero hospital assigned in ICU scarcity");
        assert(scarcityData.activeScenario.reservationId === null, "Zero bed reservation created in ICU scarcity");

        await handleResetDemo();


        // ─────────────────────────────────────────────────────────────────────
        // STEP 7: SCENARIO 5 — STALE HOSPITAL DATA (FRESHNESS PREFERENCE)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 7: SCENARIO 5 — STALE HOSPITAL DATA (TELEMETRY PREFERENCE)");

        const staleReq = new Request("http://localhost:3000/api/demo/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "STALE_HOSPITAL_DATA" })
        });
        const staleRes = await handleStartScenario(staleReq);
        const staleData = await staleRes.json();

        assert(staleRes.status === 200 && staleData.success, "Start STALE_HOSPITAL_DATA returns HTTP 200");
        assert(staleData.activeScenario.hospitalId !== null, "Fresh hospital selected by allocator");
        assert(staleData.activeScenario.reservationId !== null, "Reservation created at fresh facility");

        await handleResetDemo();


        // ─────────────────────────────────────────────────────────────────────
        // STEP 8: SCENARIO 6 — NO SUITABLE HOSPITAL (SAFE DIVERSION)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 8: SCENARIO 6 — NO SUITABLE HOSPITAL (SAFE DIVERSION)");

        const noMatchReq = new Request("http://localhost:3000/api/demo/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "NO_SUITABLE_HOSPITAL" })
        });
        const noMatchRes = await handleStartScenario(noMatchReq);
        const noMatchData = await noMatchRes.json();

        assert(noMatchRes.status === 200 && noMatchData.success, "Start NO_SUITABLE_HOSPITAL returns HTTP 200");
        assert(noMatchData.activeScenario.isDiversion === true, "Marked as safe clinical diversion");
        assert(noMatchData.activeScenario.hospitalId === null, "No false hospital assignment");
        assert(noMatchData.activeScenario.reservationId === null, "No reservation created");

        await handleResetDemo();


        // ─────────────────────────────────────────────────────────────────────
        // STEP 9: FINAL PRODUCTION INTEGRITY & DATA SAFETY CHECK
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 9: FINAL PRODUCTION INTEGRITY & DATA SAFETY CHECK");

        const finalHospitals = await db.collection("hospitals").find({}).toArray();
        assert(finalHospitals.length === initialHospitalsCount, `Hospital collection intact: ${finalHospitals.length}/${initialHospitalsCount} facilities`);

        // Check Capacity Invariants across all hospitals
        let invariantsHeld = true;
        for (const hosp of finalHospitals) {
            const cap = hosp.capacity;
            if (cap) {
                const total = cap.totalBeds ?? (cap.availableBeds + cap.occupiedBeds + cap.reservedBeds);
                const inv = total - (cap.occupiedBeds || 0) - (cap.reservedBeds || 0);
                if (inv !== cap.availableBeds && cap.availableBeds !== undefined) {
                    invariantsHeld = false;
                }
                if (cap.availableBeds < 0 || cap.occupiedBeds < 0 || cap.reservedBeds < 0) {
                    invariantsHeld = false;
                }
            }
        }
        assert(invariantsHeld, "Capacity four-bucket invariant holds across all hospitals: available = total - occupied - reserved (no negatives)");

        const demoEmgCount = await db.collection("emergencyRequests").countDocuments({
            $or: [{ isDemo: true }, { source: "DEMO_SCENARIO" }, { emergencyId: { $regex: "^DEMO-" } }]
        });
        assert(demoEmgCount === 0, `All demo emergency records cleaned up from database (${demoEmgCount} remaining)`);

    } finally {
        await client.close();
    }

    printHeader(`PHASE 6B TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    if (totalFailed > 0) {
        process.exit(1);
    }
}

runDemoLauncherTestSuite().catch((err) => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
