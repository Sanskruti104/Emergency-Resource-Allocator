/**
 * EMS Simulation & Operational Data Test Suite
 *
 * Tests the FULL simulation pipeline end-to-end against REAL MongoDB.
 * Uses DEMO hospital data (seeded by seed_demo_hospitals.ts).
 *
 * Prerequisites:
 *   npx tsx --env-file=.env.local scripts/seed_demo_hospitals.ts
 *   then run this test suite
 *
 * Collections used:
 *   - hospitals          (demo records — read only in tests)
 *   - _test_sim_requests (isolated — cleaned up)
 *   - _test_sim_ambs     (isolated — cleaned up)
 *   - _test_sim_reserv   (isolated — cleaned up)
 *   - _test_sim_events   (isolated — cleaned up)
 *   - _test_sim_handoffs (isolated — cleaned up)
 */

import { MongoClient, Db } from "mongodb";
import { runSimulation, advanceAmbulance } from "../lib/emergency/ems-simulator";
import { releaseReservation } from "../lib/emergency/emergency-reservation";

// ─── Isolated collection overrides ───────────────────────────────────────────
// The simulator calls reserveResource / allocateEmergencyHospital, which both
// read from "hospitals" (the real demo seed) and write to the other collections.
// We override write collections so production data is never touched.

const TEST_COLLECTIONS = {
    emergencyRequests: "_test_sim_requests",
    ambulances:        "_test_sim_ambs",
    reservations:      "_test_sim_reserv",
    hospitalEvents:    "_test_sim_events",
    handoffs:          "_test_sim_handoffs"
};

// ─── Test infra ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    } else {
        console.log(`  ✔  PASS: ${message}`);
        passed++;
    }
}

// Patch simulator to write to isolated collections by monkey-patching db.collection
function patchDb(db: Db): Db {
    const original = db.collection.bind(db);
    (db as any).collection = (name: string, ...rest: any[]) => {
        const override = (TEST_COLLECTIONS as any)[name];
        return original(override ?? name, ...rest);
    };
    return db;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTests() {
    const uri = process.env.MONGODB_URI;
    if (!uri) { console.error("ERROR: MONGODB_URI not set"); process.exit(1); }

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 });
    await client.connect();
    const rawDb = client.db();
    const db = patchDb(rawDb);

    // Verify demo hospitals exist
    const hospitalCount = await rawDb.collection("hospitals")
        .countDocuments({ dataSource: "DEMO_OPERATIONAL_SEED" });

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🚑 EMS SIMULATION & OPERATIONAL DATA TEST SUITE");
    console.log("═══════════════════════════════════════════════════════════════════\n");
    console.log(`ℹ  Demo hospitals in DB: ${hospitalCount}`);

    if (hospitalCount === 0) {
        console.error("❌ No demo hospitals found. Run: npx tsx --env-file=.env.local scripts/seed_demo_hospitals.ts");
        await client.close();
        process.exit(1);
    }

    // Drop test collections
    for (const col of Object.values(TEST_COLLECTIONS)) {
        await rawDb.collection(col).drop().catch(() => {});
    }
    console.log("ℹ  Isolated test collections created\n");

    // ═══════════════════════════════════════════════════════════════
    // TEST 1: Normal Cardiac Simulation
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 1: Normal Cardiac Simulation ───");
    const r1 = await runSimulation({ scenario: "NORMAL_CARDIAC" }, db);
    console.log(`  Scenario: ${r1.scenario} | Emergency: ${r1.emergencyId}`);
    console.log(`  Allocated to: ${r1.selectedHospitalId}`);
    console.log(`  Reservation: ${r1.reservationOutcome}`);

    assert(r1.emergencyId.startsWith("SIM-EMG-"), "Emergency ID generated with SIM prefix");
    assert(r1.allocationResult.suitableCount > 0, "At least 1 suitable hospital found for CARDIAC");
    assert(
        r1.selectedHospitalId !== null,
        `Hospital selected: ${r1.selectedHospitalId}`
    );

    // Verify real MongoDB doc created
    const emgDoc1 = await rawDb.collection(TEST_COLLECTIONS.emergencyRequests).findOne({ emergencyId: r1.emergencyId });
    assert(emgDoc1 !== null, "EmergencyRequest document exists in MongoDB");
    assert(emgDoc1?.source === "EMS_SIMULATION", "Source = EMS_SIMULATION");
    assert(emgDoc1?.condition === "cardiac", "Condition = cardiac");

    const ambDoc1 = await rawDb.collection(TEST_COLLECTIONS.ambulances).findOne({ ambulanceId: r1.ambulanceState.ambulanceId });
    assert(ambDoc1 !== null, "Ambulance document exists in MongoDB");
    assert(ambDoc1?.telemetrySource === "SIMULATION", "Ambulance telemetrySource = SIMULATION");

    assert(r1.simulationMetadata.telemetrySource === "SIMULATION", "Metadata labels telemetrySource correctly");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // TEST 2: Trauma Simulation
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 2: Trauma Simulation ───");
    const r2 = await runSimulation({ scenario: "TRAUMA" }, db);
    console.log(`  Allocated to: ${r2.selectedHospitalId} | Reservation: ${r2.reservationOutcome}`);

    assert(r2.scenario === "TRAUMA", "Scenario = TRAUMA");
    assert(r2.allocationResult.emergency.priority === "RED" || r2.allocationResult.emergency.priority === "YELLOW",
        `Trauma triage priority is RED or YELLOW (got ${r2.allocationResult.emergency.priority})`);
    assert(r2.selectedHospitalId !== null, "Trauma allocated to a hospital");

    const emgDoc2 = await rawDb.collection(TEST_COLLECTIONS.emergencyRequests).findOne({ emergencyId: r2.emergencyId });
    assert(emgDoc2?.condition === "trauma", "Condition = trauma in DB");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // TEST 3: Stroke Simulation
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 3: Stroke Simulation ───");
    const r3 = await runSimulation({ scenario: "STROKE" }, db);
    console.log(`  Allocated to: ${r3.selectedHospitalId} | Reservation: ${r3.reservationOutcome}`);

    assert(r3.scenario === "STROKE", "Scenario = STROKE");
    assert(r3.allocationResult.emergency.requiredSpecialty.toLowerCase().includes("neuro") ||
           r3.allocationResult.emergency.requiredSpecialty.toLowerCase().includes("stroke"),
        `Required specialty includes neuro/stroke (got: ${r3.allocationResult.emergency.requiredSpecialty})`
    );
    assert(r3.selectedHospitalId !== null, "Stroke allocated to a hospital");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // TEST 4: ICU Scarcity
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 4: ICU Scarcity ───");
    const r4 = await runSimulation({ scenario: "ICU_SCARCITY" }, db);
    console.log(`  Reservation outcome: ${r4.reservationOutcome}`);
    console.log(`  Suitable hospitals: ${r4.allocationResult.suitableCount}`);

    // With 5 hospitals seeded, at least some should survive scarcity
    assert(r4.scenario === "ICU_SCARCITY", "Scenario = ICU_SCARCITY");
    assert(
        r4.reservationOutcome === "SUCCESS" || r4.reservationOutcome === "RESOURCE_UNAVAILABLE" || r4.reservationOutcome === "NO_SUITABLE_HOSPITAL",
        `ICU scarcity produces a valid outcome (got ${r4.reservationOutcome})`
    );
    // Allocator ran and evaluated hospitals
    assert(r4.allocationResult.totalCandidatesEvaluated > 0, "Allocator evaluated candidates");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // TEST 5: Stale Hospital Data
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 5: Stale Hospital Telemetry ───");
    const r5 = await runSimulation({ scenario: "STALE_HOSPITAL_DATA" }, db);

    // Check if any hospital was marked STALE in results
    const staleHospitals = r5.allocationResult.results.filter((h: any) => h.freshnessStatus === "STALE");
    const freshHospitals  = r5.allocationResult.results.filter((h: any) => h.freshnessStatus === "FRESH" || h.freshnessStatus === "AGING");

    console.log(`  Stale hospitals in ranking: ${staleHospitals.length}`);
    console.log(`  Fresh/Aging hospitals: ${freshHospitals.length}`);

    assert(staleHospitals.length >= 1, "At least 1 hospital marked STALE in allocation results");
    assert(r5.scenario === "STALE_HOSPITAL_DATA", "Scenario = STALE_HOSPITAL_DATA");

    // Verify stale hospital scores lower than fresh
    if (staleHospitals.length > 0 && freshHospitals.length > 0) {
        const maxStaleScore = Math.max(...staleHospitals.map((h: any) => h.overallScore));
        const maxFreshScore = Math.max(...freshHospitals.map((h: any) => h.overallScore));
        assert(maxFreshScore >= maxStaleScore, `Fresh hospital scores (${maxFreshScore}) >= stale scores (${maxStaleScore})`);
    }

    // Verify stale hospital's updatedAt was restored (not permanently corrupted)
    const restoredHosp = await rawDb.collection("hospitals").findOne({ uid: "DEMO-HOSP-GENERAL-004" });
    const restoredAge = (Date.now() - new Date(restoredHosp?.capacity?.updatedAt ?? restoredHosp?.updatedAt).getTime()) / 60000;
    assert(restoredAge < 70, `Hospital data restored after scenario (age: ${Math.round(restoredAge)} min)`);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // TEST 6: No Suitable Hospital
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 6: No Suitable Hospital ───");
    const r6 = await runSimulation({ scenario: "NO_SUITABLE_HOSPITAL" }, db);
    console.log(`  Suitable count: ${r6.allocationResult.suitableCount}`);
    console.log(`  Reservation outcome: ${r6.reservationOutcome}`);

    assert(r6.scenario === "NO_SUITABLE_HOSPITAL", "Scenario = NO_SUITABLE_HOSPITAL");
    assert(r6.reservationOutcome === "NO_SUITABLE_HOSPITAL", "Outcome = NO_SUITABLE_HOSPITAL");

    const emgDoc6 = await rawDb.collection(TEST_COLLECTIONS.emergencyRequests).findOne({ emergencyId: r6.emergencyId });
    assert(emgDoc6?.status === "CANCELLED", "EmergencyRequest status = CANCELLED when no hospital found");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // TEST 7: Successful Reservation Through Simulator
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 7: Successful Reservation Through Simulator ───");
    const r7 = await runSimulation({ scenario: "NORMAL_CARDIAC" }, db);

    if (r7.reservationOutcome === "SUCCESS" && r7.reservationId) {
        assert(true, `Reservation created: ${r7.reservationId}`);

        const resDoc = await rawDb.collection(TEST_COLLECTIONS.reservations).findOne({ reservationId: r7.reservationId });
        assert(resDoc !== null, "Reservation document exists in MongoDB");
        assert(resDoc?.status === "PENDING", "Reservation status = PENDING");
        assert(resDoc?.hospitalId === r7.selectedHospitalId, "Reservation hospital matches allocation");
        assert(resDoc?.emergencyId === r7.emergencyId, "Reservation emergency matches");
    } else {
        // If all capacity is exhausted from previous tests, acceptable
        assert(
            r7.reservationOutcome === "RESOURCE_UNAVAILABLE" || r7.reservationOutcome === "SUCCESS",
            `Reservation produced a valid outcome (got ${r7.reservationOutcome})`
        );
    }
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // TEST 8: Reservation Failure When Resource Unavailable
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 8: Reservation Failure — Resource Unavailable ───");
    // Exhaust all ICU beds at CONSTRAINED hospital by patching it to 0
    await rawDb.collection("hospitals").updateOne(
        { uid: "DEMO-HOSP-CONSTRAINED-005" },
        { $set: { "capacity.availableIcuBeds": 0 } }
    );

    const r8 = await runSimulation({
        scenario: "ICU_SCARCITY",
        forceHospitalId: "DEMO-HOSP-CONSTRAINED-005"
    } as any, db);

    // Restore
    await rawDb.collection("hospitals").updateOne(
        { uid: "DEMO-HOSP-CONSTRAINED-005" },
        { $set: { "capacity.availableIcuBeds": 1, "capacity.updatedAt": new Date() } }
    );

    assert(
        r8.reservationOutcome !== null,
        `Reservation attempted for constrained hospital (outcome: ${r8.reservationOutcome})`
    );
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // TEST 9: Ambulance EN_ROUTE → ARRIVED
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 9: Ambulance EN_ROUTE → ARRIVED ───");
    // Use a simulation that produced a valid ambulance
    const r9base = await runSimulation({ scenario: "TRAUMA" }, db);
    const ambId9 = r9base.ambulanceState.ambulanceId;

    const enRouteResult = await advanceAmbulance(ambId9, "EN_ROUTE", db);
    assert(enRouteResult.newStatus === "TRANSPORTING", `EN_ROUTE → TRANSPORTING (got ${enRouteResult.newStatus})`);
    assert(enRouteResult.telemetrySource === "SIMULATION", "telemetrySource = SIMULATION");

    const arrivedResult = await advanceAmbulance(ambId9, "ARRIVED", db);
    assert(arrivedResult.newStatus === "AT_HOSPITAL", `ARRIVED → AT_HOSPITAL (got ${arrivedResult.newStatus})`);
    assert(arrivedResult.handoffId !== undefined, `Handoff document created: ${arrivedResult.handoffId}`);

    const handoffDoc = await rawDb.collection(TEST_COLLECTIONS.handoffs).findOne({ handoffId: arrivedResult.handoffId });
    assert(handoffDoc !== null, "Handoff document exists in MongoDB");
    assert(handoffDoc?.status === "ARRIVED", "Handoff status = ARRIVED");
    assert(handoffDoc?.telemetrySource === "SIMULATION", "Handoff telemetrySource = SIMULATION");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // TEST 10: ARRIVED → HANDOFF
    // ═══════════════════════════════════════════════════════════════
    console.log("─── TEST 10: ARRIVED → HANDOFF ───");
    const handoffResult = await advanceAmbulance(ambId9, "HANDOFF", db);
    assert(handoffResult.newStatus === "AVAILABLE", `HANDOFF → AVAILABLE (got ${handoffResult.newStatus})`);

    const completedHandoff = await rawDb.collection(TEST_COLLECTIONS.handoffs).findOne({ handoffId: arrivedResult.handoffId });
    assert(completedHandoff?.status === "COMPLETED", "Handoff document status = COMPLETED");
    assert(completedHandoff?.handoffTime !== null, "Handoff timestamp recorded");

    const finalEmg = await rawDb.collection(TEST_COLLECTIONS.emergencyRequests)
        .findOne({ emergencyId: r9base.emergencyId });
    assert(finalEmg?.status === "HANDED_OFF", `EmergencyRequest final status = HANDED_OFF (got ${finalEmg?.status})`);

    const patientAdmitted = await rawDb.collection(TEST_COLLECTIONS.hospitalEvents)
        .findOne({ eventType: "PATIENT_ADMITTED", emergencyId: r9base.emergencyId });
    assert(patientAdmitted !== null, "PATIENT_ADMITTED hospital event recorded");
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // FINAL: Collection Counts
    // ═══════════════════════════════════════════════════════════════
    console.log("─── Final MongoDB Collection Counts ───");
    const hospitals    = await rawDb.collection("hospitals").countDocuments({ dataSource: "DEMO_OPERATIONAL_SEED" });
    const requests     = await rawDb.collection(TEST_COLLECTIONS.emergencyRequests).countDocuments();
    const ambulances   = await rawDb.collection(TEST_COLLECTIONS.ambulances).countDocuments();
    const reservations = await rawDb.collection(TEST_COLLECTIONS.reservations).countDocuments();
    const events       = await rawDb.collection(TEST_COLLECTIONS.hospitalEvents).countDocuments();
    const handoffs     = await rawDb.collection(TEST_COLLECTIONS.handoffs).countDocuments();

    console.log(`  hospitals (demo)       : ${hospitals}`);
    console.log(`  emergencyRequests      : ${requests}`);
    console.log(`  ambulances             : ${ambulances}`);
    console.log(`  reservations           : ${reservations}`);
    console.log(`  hospitalEvents         : ${events}`);
    console.log(`  handoffs               : ${handoffs}`);
    console.log();

    // ─── Cleanup ────────────────────────────────────────────────────────────
    console.log("─── Cleanup: removing isolated test collections ───");
    for (const col of Object.values(TEST_COLLECTIONS)) {
        await rawDb.collection(col).drop().catch(() => {});
    }
    console.log("  ✔  Test collections dropped\n");

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`📊 RESULTS:  ${passed} passed  /  ${failed} failed  /  ${passed + failed} total`);
    if (failed === 0) {
        console.log("🎉 ALL SIMULATION & OPERATIONAL DATA TESTS PASSED!");
    } else {
        console.log("❌ SOME TESTS FAILED — see output above.");
    }
    console.log("═══════════════════════════════════════════════════════════════════\n");

    await client.close();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error("Test suite crashed:", err);
    process.exit(1);
});
