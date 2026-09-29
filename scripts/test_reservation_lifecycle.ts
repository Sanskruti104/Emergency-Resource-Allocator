/**
 * Reservation Lifecycle & Capacity Invariant Test Suite
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the complete lifecycle:
 *   1. reservation → confirmation (PENDING → CONFIRMED, capacity held in reserved)
 *   2. confirmation → admission (CONFIRMED → ADMITTED, capacity shifts reserved → occupied)
 *   3. admission updates capacity correctly (invariant: available = total - occupied - reserved)
 *   4. handoff completion updates appropriate states (auto-admit, handoff COMPLETED)
 *   5. discharge releases occupied capacity (occupied → available)
 *   6. repeated admission/handoff does not double-update capacity (idempotency guard)
 */

import { MongoClient, Db } from "mongodb";
import {
    reserveResource,
    confirmReservation,
    admitPatient,
    dischargePatient,
    confirmAdmission
} from "../lib/emergency/emergency-reservation";
import { runSimulation, advanceAmbulance } from "../lib/emergency/ems-simulator";

const HOSPITALS_COL = "_test_lc_hospitals";
const RESERVATIONS_COL = "_test_lc_reservations";
const EVENTS_COL = "_test_lc_events";
const EMG_COL = "_test_lc_requests";
const AMB_COL = "_test_lc_ambs";
const HANDOFF_COL = "_test_lc_handoffs";

const TEST_HOSP_ID = "TEST-HOSP-LIFECYCLE-001";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
    if (!condition) {
        console.error(`  ❌ FAIL: ${msg}`);
        failed++;
    } else {
        console.log(`  ✔  PASS: ${msg}`);
        passed++;
    }
}

const TEST_COLLECTIONS: Record<string, string> = {
    hospitals:         HOSPITALS_COL,
    reservations:      RESERVATIONS_COL,
    hospitalEvents:    EVENTS_COL,
    emergencyRequests: EMG_COL,
    ambulances:        AMB_COL,
    handoffs:          HANDOFF_COL
};

function patchDb(db: Db): Db {
    const original = db.collection.bind(db);
    (db as any).collection = (name: string, ...rest: any[]) => {
        const override = TEST_COLLECTIONS[name];
        return original(override ?? name, ...rest);
    };
    return db;
}

async function getHospital(db: Db) {
    return db.collection(HOSPITALS_COL).findOne({ uid: TEST_HOSP_ID });
}

async function runLifecycleTests() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("ERROR: MONGODB_URI not set");
        process.exit(1);
    }

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 });
    await client.connect();
    const rawDb = client.db();
    const db = patchDb(rawDb);

    console.log("\n═══════════════════════════════════════════════════════════════════");
    console.log("🔄 RESERVATION LIFECYCLE & CAPACITY INVARIANT TEST SUITE");
    console.log("═══════════════════════════════════════════════════════════════════\n");

    // Clean up test collections
    const collections = [HOSPITALS_COL, RESERVATIONS_COL, EVENTS_COL, EMG_COL, AMB_COL, HANDOFF_COL];
    for (const c of collections) {
        await db.collection(c).drop().catch(() => {});
    }

    // Seed test hospital: Total ICU = 5, Occupied = 2, Reserved = 0, Available = 3
    // Invariant: 5 - 2 - 0 = 3
    await db.collection(HOSPITALS_COL).insertOne({
        uid: TEST_HOSP_ID,
        hospitalName: "Lifecycle Test Hospital",
        city: "Pune",
        state: "Maharashtra",
        latitude: 18.5204,
        longitude: 73.8567,
        specialties: ["Cardiology", "Critical Care", "Emergency Medicine"],
        capacity: {
            totalBeds: 100,
            availableBeds: 50,
            icuBeds: 5,
            availableIcuBeds: 3,
            occupiedIcuBeds: 2,
            reservedIcuBeds: 0,
            operationTheatres: 2,
            emergencyAvailable: true,
            updatedAt: new Date()
        }
    });

    const resOpts = {
        hospitalsCollection: HOSPITALS_COL,
        reservationsCollection: RESERVATIONS_COL
    };

    // ─────────────────────────────────────────────────────────────
    // TEST 1: reservation → confirmation
    // ─────────────────────────────────────────────────────────────
    console.log("─── TEST 1: reservation → confirmation ───");
    const r1 = await reserveResource({
        hospitalId: TEST_HOSP_ID,
        emergencyId: "EMG-LC-001",
        resourceType: "ICU_BED",
        quantity: 1,
        ...resOpts
    }, db);

    assert(r1.outcome === "SUCCESS", `Reservation created (outcome: ${r1.outcome})`);
    assert(r1.reservationId !== undefined, `Reservation ID: ${r1.reservationId}`);

    // Verify initial reservation state: PENDING, capacity held in reserved
    let h1 = await getHospital(db);
    assert(h1?.capacity?.availableIcuBeds === 2, `Available ICU beds decremented from 3 to 2 (got ${h1?.capacity?.availableIcuBeds})`);
    assert(h1?.capacity?.reservedIcuBeds === 1, `Reserved ICU beds incremented from 0 to 1 (got ${h1?.capacity?.reservedIcuBeds})`);
    assert(h1?.capacity?.occupiedIcuBeds === 2, `Occupied ICU beds unchanged at 2 (got ${h1?.capacity?.occupiedIcuBeds})`);

    // Invariant check
    let inv1 = h1?.capacity?.icuBeds - h1?.capacity?.occupiedIcuBeds - h1?.capacity?.reservedIcuBeds;
    assert(inv1 === h1?.capacity?.availableIcuBeds, `Invariant holds on reserve: 5 - 2 - 1 = ${inv1} = available(${h1?.capacity?.availableIcuBeds})`);

    // Hospital confirms incoming transport
    const conf1 = await confirmReservation({ reservationId: r1.reservationId!, ...resOpts }, db);
    assert(conf1.outcome === "SUCCESS", `Confirm reservation succeeds (got ${conf1.outcome})`);

    const resDoc1 = await db.collection(RESERVATIONS_COL).findOne({ reservationId: r1.reservationId });
    assert(resDoc1?.status === "CONFIRMED", `Reservation status is CONFIRMED (got ${resDoc1?.status})`);
    assert(resDoc1?.confirmedAt !== null, `confirmedAt timestamp recorded`);

    // Confirmation does NOT prematurely occupy the bed — bed remains held in reserved
    h1 = await getHospital(db);
    assert(h1?.capacity?.reservedIcuBeds === 1, `Reserved ICU beds still 1 after confirmation (got ${h1?.capacity?.reservedIcuBeds})`);
    assert(h1?.capacity?.occupiedIcuBeds === 2, `Occupied ICU beds still 2 after confirmation (got ${h1?.capacity?.occupiedIcuBeds})`);
    assert(h1?.capacity?.availableIcuBeds === 2, `Available ICU beds still 2 after confirmation (got ${h1?.capacity?.availableIcuBeds})`);
    console.log();

    // ─────────────────────────────────────────────────────────────
    // TEST 2: confirmation → admission
    // ─────────────────────────────────────────────────────────────
    console.log("─── TEST 2: confirmation → admission ───");
    const admitResult = await admitPatient({ reservationId: r1.reservationId!, ...resOpts }, db);
    assert(admitResult.outcome === "SUCCESS", `Admit patient succeeds (got ${admitResult.outcome})`);

    const resDoc2 = await db.collection(RESERVATIONS_COL).findOne({ reservationId: r1.reservationId });
    assert(resDoc2?.status === "ADMITTED", `Reservation status is ADMITTED (got ${resDoc2?.status})`);
    assert(resDoc2?.admittedAt !== null, `admittedAt timestamp recorded`);
    console.log();

    // ─────────────────────────────────────────────────────────────
    // TEST 3: admission updates capacity correctly
    // ─────────────────────────────────────────────────────────────
    console.log("─── TEST 3: admission updates capacity correctly ───");
    const h3 = await getHospital(db);
    // reserved should decrease by 1 (1 -> 0)
    assert(h3?.capacity?.reservedIcuBeds === 0, `Reserved ICU beds decreased to 0 (got ${h3?.capacity?.reservedIcuBeds})`);
    // occupied should increase by 1 (2 -> 3)
    assert(h3?.capacity?.occupiedIcuBeds === 3, `Occupied ICU beds increased to 3 (got ${h3?.capacity?.occupiedIcuBeds})`);
    // available remains 2 (was already decremented on reserve)
    assert(h3?.capacity?.availableIcuBeds === 2, `Available ICU beds remains 2 (got ${h3?.capacity?.availableIcuBeds})`);

    // Invariant check: total(5) - occupied(3) - reserved(0) = available(2)
    const inv3 = h3?.capacity?.icuBeds - h3?.capacity?.occupiedIcuBeds - h3?.capacity?.reservedIcuBeds;
    assert(inv3 === h3?.capacity?.availableIcuBeds, `Invariant holds on admission: 5 - 3 - 0 = ${inv3} = available(${h3?.capacity?.availableIcuBeds})`);

    // Verify hospitalEvent recorded
    const admitEvent = await db.collection("hospitalEvents").findOne({
        eventType: "PATIENT_ADMITTED",
        reservationId: r1.reservationId
    });
    assert(admitEvent !== null, `PATIENT_ADMITTED event recorded in hospitalEvents`);
    console.log();

    // ─────────────────────────────────────────────────────────────
    // TEST 4: handoff completion updates appropriate states
    // ─────────────────────────────────────────────────────────────
    console.log("─── TEST 4: handoff completion updates appropriate states (auto-admit) ───");
    // Create an emergency + reservation + ambulance simulating active transport
    const r4 = await reserveResource({
        hospitalId: TEST_HOSP_ID,
        emergencyId: "EMG-LC-004",
        resourceType: "ICU_BED",
        quantity: 1,
        ...resOpts
    }, db);
    assert(r4.outcome === "SUCCESS", `Setup: reservation created for handoff test (ID: ${r4.reservationId})`);

    const ambId = "AMB-LC-004";
    await db.collection("emergencyRequests").insertOne({
        emergencyId: "EMG-LC-004",
        status: "TRANSPORTING",
        condition: "cardiac",
        createdAt: new Date(),
        updatedAt: new Date()
    });

    await db.collection("ambulances").replaceOne(
        { ambulanceId: ambId },
        {
            ambulanceId: ambId,
            vehicleNumber: "MH-12-LC-004",
            currentEmergencyId: "EMG-LC-004",
            destinationHospitalId: TEST_HOSP_ID,
            status: "TRANSPORTING",
            telemetrySource: "SIMULATION",
            createdAt: new Date(),
            updatedAt: new Date()
        },
        { upsert: true }
    );

    // Ambulance arrives at ED
    const arrived = await advanceAmbulance(ambId, "ARRIVED", db);
    assert(arrived.newStatus === "AT_HOSPITAL", `Ambulance status is AT_HOSPITAL (got ${arrived.newStatus})`);
    assert(arrived.handoffId !== undefined, `Handoff record created (ID: ${arrived.handoffId})`);

    // Ambulance completes handoff -> triggers auto-admission
    const handedOff = await advanceAmbulance(ambId, "HANDOFF", db);
    assert(handedOff.newStatus === "AVAILABLE", `Ambulance is now AVAILABLE (got ${handedOff.newStatus})`);

    // Verify handoff record is COMPLETED
    const handoffDoc = await db.collection("handoffs").findOne({ handoffId: arrived.handoffId });
    assert(handoffDoc?.status === "COMPLETED", `Handoff record status is COMPLETED (got ${handoffDoc?.status})`);
    assert(handoffDoc?.handoffTime !== null, `Handoff time recorded`);

    // Verify emergencyRequest is HANDED_OFF
    const emgDoc = await db.collection("emergencyRequests").findOne({ emergencyId: "EMG-LC-004" });
    assert(emgDoc?.status === "HANDED_OFF", `EmergencyRequest status is HANDED_OFF (got ${emgDoc?.status})`);

    // Verify reservation was AUTO-ADMITTED (not left as PENDING!)
    const resDoc4 = await db.collection(RESERVATIONS_COL).findOne({ reservationId: r4.reservationId });
    assert(resDoc4?.status === "ADMITTED", `Reservation is ADMITTED upon handoff (no longer PENDING! got: ${resDoc4?.status})`);

    // Verify hospital capacity: shifted from reserved to occupied
    const h4 = await getHospital(db);
    assert(h4?.capacity?.occupiedIcuBeds === 4, `Occupied ICU beds is now 4 (got ${h4?.capacity?.occupiedIcuBeds})`);
    assert(h4?.capacity?.reservedIcuBeds === 0, `Reserved ICU beds is 0 (got ${h4?.capacity?.reservedIcuBeds})`);
    assert(h4?.capacity?.availableIcuBeds === 1, `Available ICU beds is 1 (got ${h4?.capacity?.availableIcuBeds})`);
    const inv4 = h4?.capacity?.icuBeds - h4?.capacity?.occupiedIcuBeds - h4?.capacity?.reservedIcuBeds;
    assert(inv4 === h4?.capacity?.availableIcuBeds, `Invariant holds after handoff auto-admission: 5 - 4 - 0 = ${inv4} = available(${h4?.capacity?.availableIcuBeds})`);
    console.log();

    // ─────────────────────────────────────────────────────────────
    // TEST 5: discharge releases occupied capacity
    // ─────────────────────────────────────────────────────────────
    console.log("─── TEST 5: discharge releases occupied capacity ───");
    // Discharge the patient from Test 1 (reservation r1)
    const dischargeResult = await dischargePatient({ reservationId: r1.reservationId!, ...resOpts }, db);
    assert(dischargeResult.outcome === "SUCCESS", `Discharge patient succeeds (got ${dischargeResult.outcome})`);

    const resDocDischarge = await db.collection(RESERVATIONS_COL).findOne({ reservationId: r1.reservationId });
    assert(resDocDischarge?.status === "DISCHARGED", `Reservation status is DISCHARGED (got ${resDocDischarge?.status})`);
    assert(resDocDischarge?.dischargedAt !== null, `dischargedAt timestamp recorded`);

    // Occupied should decrease by 1 (4 -> 3)
    // Available should increase by 1 (1 -> 2)
    const h5 = await getHospital(db);
    assert(h5?.capacity?.occupiedIcuBeds === 3, `Occupied ICU beds decreased from 4 to 3 (got ${h5?.capacity?.occupiedIcuBeds})`);
    assert(h5?.capacity?.availableIcuBeds === 2, `Available ICU beds increased from 1 to 2 (got ${h5?.capacity?.availableIcuBeds})`);

    // Invariant check: total(5) - occupied(3) - reserved(0) = available(2)
    const inv5 = h5?.capacity?.icuBeds - h5?.capacity?.occupiedIcuBeds - h5?.capacity?.reservedIcuBeds;
    assert(inv5 === h5?.capacity?.availableIcuBeds, `Invariant holds on discharge: 5 - 3 - 0 = ${inv5} = available(${h5?.capacity?.availableIcuBeds})`);

    // Verify hospitalEvent recorded
    const dischargeEvent = await db.collection("hospitalEvents").findOne({
        eventType: "PATIENT_DISCHARGED",
        reservationId: r1.reservationId
    });
    assert(dischargeEvent !== null, `PATIENT_DISCHARGED event recorded in hospitalEvents`);
    console.log();

    // ─────────────────────────────────────────────────────────────
    // TEST 6: repeated admission/handoff does not double-update capacity
    // ─────────────────────────────────────────────────────────────
    console.log("─── TEST 6: repeated admission/handoff does not double-update capacity ───");
    // Attempt repeated admission on already-admitted reservation r4
    const repeatAdmit = await admitPatient({ reservationId: r4.reservationId!, ...resOpts }, db);
    assert(repeatAdmit.outcome === "ALREADY_PROCESSED", `Repeated admit returns ALREADY_PROCESSED (got ${repeatAdmit.outcome})`);

    // Check capacity unchanged
    let h6 = await getHospital(db);
    assert(h6?.capacity?.occupiedIcuBeds === 3, `Occupied beds NOT double-incremented (remained 3, got ${h6?.capacity?.occupiedIcuBeds})`);
    assert(h6?.capacity?.availableIcuBeds === 2, `Available beds NOT changed (remained 2, got ${h6?.capacity?.availableIcuBeds})`);

    // Attempt repeated discharge on already-discharged reservation r1
    const repeatDischarge = await dischargePatient({ reservationId: r1.reservationId!, ...resOpts }, db);
    assert(repeatDischarge.outcome === "ALREADY_PROCESSED", `Repeated discharge returns ALREADY_PROCESSED (got ${repeatDischarge.outcome})`);

    h6 = await getHospital(db);
    assert(h6?.capacity?.occupiedIcuBeds === 3, `Occupied beds NOT double-decremented (remained 3, got ${h6?.capacity?.occupiedIcuBeds})`);
    assert(h6?.capacity?.availableIcuBeds === 2, `Available beds NOT double-incremented (remained 2, got ${h6?.capacity?.availableIcuBeds})`);

    // Attempt repeat handoff on ambulance
    const repeatHandoff = await advanceAmbulance(ambId, "HANDOFF", db);
    assert(repeatHandoff.newStatus === "AVAILABLE", `Repeated handoff completes safely`);

    h6 = await getHospital(db);
    assert(h6?.capacity?.occupiedIcuBeds === 3, `Occupied beds still 3 after repeat handoff (got ${h6?.capacity?.occupiedIcuBeds})`);
    assert(h6?.capacity?.availableIcuBeds === 2, `Available beds still 2 after repeat handoff (got ${h6?.capacity?.availableIcuBeds})`);
    console.log();

    // ─── Cleanup ─────────────────────────────────────────────────
    for (const c of collections) {
        await db.collection(c).drop().catch(() => {});
    }
    console.log("✔ Test collections cleaned up\n");

    // ─── Summary ─────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════════════════");
    console.log(`📊 RESULTS:  ${passed} passed  /  ${failed} failed  /  ${passed + failed} total`);
    if (failed === 0) {
        console.log("🎉 ALL RESERVATION LIFECYCLE & INVARIANT TESTS PASSED!");
    } else {
        console.log("❌ SOME TESTS FAILED — see output above.");
    }
    console.log("═══════════════════════════════════════════════════════════════════\n");

    await client.close();
    process.exit(failed > 0 ? 1 : 0);
}

runLifecycleTests().catch(err => {
    console.error("Test suite crashed:", err);
    process.exit(1);
});
