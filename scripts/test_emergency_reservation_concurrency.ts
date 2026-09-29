/**
 * Emergency Reservation Concurrency & Correctness Test Suite
 *
 * Uses ISOLATED test collections (_test_hospitals, _test_reservations, _test_hospitalEvents).
 * Does NOT touch the production hospitals, emergencyRequests, or reservations collections.
 * Cleans up all test data at the end.
 *
 * Tests:
 *  CONCURRENCY-1: Two simultaneous ICU reservations against capacity=1 → exactly 1 succeeds
 *  CORRECT-1:  Reserve final ICU bed → success
 *  CORRECT-2:  Reserve again immediately → fails
 *  CORRECT-3:  Release → capacity restored
 *  CORRECT-4:  Reserve again after release → success
 *  CORRECT-5:  Expired reservation releases capacity
 *  CORRECT-6:  Invalid state transition (RELEASED → CONFIRMED) → rejected
 *  CORRECT-7:  Double release → no double capacity increment
 *  CORRECT-8:  Reserve quantity > available → atomic failure
 *  CORRECT-9:  Two simultaneous reservations against capacity=2 → exactly 2 succeed
 *  CORRECT-10: Final MongoDB invariant check after all tests
 */

import { MongoClient } from "mongodb";
import {
    reserveResource,
    releaseReservation,
    expireReservation,
    confirmAdmission,
    rejectReservation,
    ReservationDoc
} from "../lib/emergency/emergency-reservation";

// ─── Configuration ────────────────────────────────────────────────────────────
const HOSPITALS_COL    = "_test_hospitals";
const RESERVATIONS_COL = "_test_reservations";
const EVENTS_COL       = "_test_hospitalEvents";

const TEST_HOSPITAL_ID = "TEST-HOSPITAL-CONCURRENCY";

// ─── Test infra ───────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    } else {
        console.log(`  ✔ PASS: ${message}`);
        passed++;
    }
}

// Build a hospital fixture document with explicit four-bucket accounting
function makeHospital(overrides: Partial<{
    totalIcu: number; occupiedIcu: number; reservedIcu: number;
    totalBeds: number; occupiedBeds: number; reservedBeds: number;
}> = {}) {
    const {
        totalIcu = 1, occupiedIcu = 0, reservedIcu = 0,
        totalBeds = 20, occupiedBeds = 0, reservedBeds = 0
    } = overrides;

    return {
        uid: TEST_HOSPITAL_ID,
        hospitalName: "Test Hospital – Concurrency Suite",
        latitude: 18.5204,
        longitude: 73.8567,
        specialties: ["Emergency Medicine", "Critical Care"],
        capacity: {
            // General beds (existing schema fields preserved)
            totalBeds,
            availableBeds: totalBeds - occupiedBeds - reservedBeds,
            occupiedBeds,
            reservedBeds,
            // ICU (new four-bucket fields)
            icuBeds: totalIcu,
            availableIcuBeds: totalIcu - occupiedIcu - reservedIcu,
            occupiedIcuBeds: occupiedIcu,
            reservedIcuBeds: reservedIcu,
            // Other
            operationTheatres: 2,
            availableOTs: 2,
            reservedOTs: 0,
            onDutySpecialist: 3,
            emergencyAvailable: true,
            updatedAt: new Date()
        },
        instruments: { available: ["ventilator", "icu_monitor", "oxygen_supply"] },
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

async function getCapacity(db: any) {
    const h = await db.collection(HOSPITALS_COL).findOne({ uid: TEST_HOSPITAL_ID });
    return h?.capacity ?? null;
}

async function getActiveReservations(db: any): Promise<ReservationDoc[]> {
    return db.collection(RESERVATIONS_COL)
        .find({ hospitalId: TEST_HOSPITAL_ID, status: { $in: ["PENDING","CONFIRMED"] } })
        .toArray();
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runTests() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("ERROR: MONGODB_URI not set");
        process.exit(1);
    }

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 });
    await client.connect();
    const db = client.db();

    // Helper to call service functions with test-collection overrides
    const resParams = {
        hospitalsCollection:    HOSPITALS_COL,
        reservationsCollection: RESERVATIONS_COL
    };

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("🏥 EMERGENCY RESERVATION CONCURRENCY & CORRECTNESS TEST SUITE");
    console.log("═══════════════════════════════════════════════════════════════\n");

    // ── Setup: drop & recreate isolated test collections ─────────────────────
    await db.collection(HOSPITALS_COL).drop().catch(() => {});
    await db.collection(RESERVATIONS_COL).drop().catch(() => {});
    await db.collection(EVENTS_COL).drop().catch(() => {});

    console.log("ℹ Using isolated test collections (no production data touched):");
    console.log("  •", HOSPITALS_COL);
    console.log("  •", RESERVATIONS_COL);
    console.log("  •", EVENTS_COL);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CONCURRENCY-1: Two simultaneous ICU reservations, capacity = 1
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CONCURRENCY-1: Simultaneous ICU reservations (capacity=1) ───");

    await db.collection(HOSPITALS_COL).deleteMany({ uid: TEST_HOSPITAL_ID });
    await db.collection(RESERVATIONS_COL).deleteMany({ hospitalId: TEST_HOSPITAL_ID });
    await db.collection(HOSPITALS_COL).insertOne(makeHospital({ totalIcu: 1 }));

    // Launch both concurrently — NOT sequentially
    const [resA, resB] = await Promise.all([
        reserveResource({ hospitalId: TEST_HOSPITAL_ID, emergencyId: "EMERGENCY-A", resourceType: "ICU_BED", quantity: 1, ...resParams }, db),
        reserveResource({ hospitalId: TEST_HOSPITAL_ID, emergencyId: "EMERGENCY-B", resourceType: "ICU_BED", quantity: 1, ...resParams }, db)
    ]);

    console.log(`  Result A: ${resA.outcome} — ${resA.message}`);
    console.log(`  Result B: ${resB.outcome} — ${resB.message}`);

    const successCount = [resA, resB].filter(r => r.outcome === "SUCCESS").length;
    const failCount    = [resA, resB].filter(r => r.outcome === "RESOURCE_UNAVAILABLE").length;

    assert(successCount === 1, `Exactly 1 reservation succeeded (got ${successCount})`);
    assert(failCount    === 1, `Exactly 1 reservation was RESOURCE_UNAVAILABLE (got ${failCount})`);

    // Verify ACTUAL MongoDB state
    const cap1 = await getCapacity(db);
    assert(cap1.reservedIcuBeds   === 1, `DB: reservedIcuBeds = 1 (got ${cap1.reservedIcuBeds})`);
    assert(cap1.availableIcuBeds  === 0, `DB: availableIcuBeds = 0 (got ${cap1.availableIcuBeds})`);
    assert(cap1.icuBeds           === 1, `DB: icuBeds (total) unchanged = 1 (got ${cap1.icuBeds})`);

    const activeAfterConc = await getActiveReservations(db);
    assert(activeAfterConc.length === 1, `Exactly 1 active reservation in DB (got ${activeAfterConc.length})`);
    assert(
        successCount !== 2,
        "CRITICAL INVARIANT: Two reservations did NOT both succeed (double-booking prevented)"
    );

    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-1: Reserve final ICU bed → success
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-1: Reserve final ICU bed → success ───");

    await db.collection(HOSPITALS_COL).deleteMany({ uid: TEST_HOSPITAL_ID });
    await db.collection(RESERVATIONS_COL).deleteMany({ hospitalId: TEST_HOSPITAL_ID });
    await db.collection(HOSPITALS_COL).insertOne(makeHospital({ totalIcu: 1 }));

    const r1 = await reserveResource({ hospitalId: TEST_HOSPITAL_ID, emergencyId: "EMG-001", resourceType: "ICU_BED", quantity: 1, ...resParams }, db);
    assert(r1.outcome === "SUCCESS", `Reserve ICU bed succeeds (got ${r1.outcome})`);

    const cap_c1 = await getCapacity(db);
    assert(cap_c1.availableIcuBeds === 0, `availableIcuBeds = 0 after reserve (got ${cap_c1.availableIcuBeds})`);
    assert(cap_c1.reservedIcuBeds  === 1, `reservedIcuBeds = 1 after reserve (got ${cap_c1.reservedIcuBeds})`);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-2: Reserve another ICU bed immediately → fails
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-2: Reserve another ICU bed → fails ───");

    const r2 = await reserveResource({ hospitalId: TEST_HOSPITAL_ID, emergencyId: "EMG-002", resourceType: "ICU_BED", quantity: 1, ...resParams }, db);
    assert(r2.outcome === "RESOURCE_UNAVAILABLE", `Second ICU reserve fails (got ${r2.outcome})`);

    const cap_c2 = await getCapacity(db);
    assert(cap_c2.availableIcuBeds === 0, `availableIcuBeds still 0 after failed reserve (got ${cap_c2.availableIcuBeds})`);
    assert(cap_c2.reservedIcuBeds  === 1, `reservedIcuBeds still 1 (got ${cap_c2.reservedIcuBeds})`);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-3: Release reservation → capacity restored
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-3: Release reservation → capacity restored ───");

    const releaseResult = await releaseReservation({ reservationId: r1.reservationId!, ...resParams }, db);
    assert(releaseResult.outcome === "SUCCESS", `Release succeeds (got ${releaseResult.outcome})`);

    const cap_c3 = await getCapacity(db);
    assert(cap_c3.availableIcuBeds === 1, `availableIcuBeds restored to 1 (got ${cap_c3.availableIcuBeds})`);
    assert(cap_c3.reservedIcuBeds  === 0, `reservedIcuBeds back to 0 (got ${cap_c3.reservedIcuBeds})`);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-4: Reserve again after release → success
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-4: Reserve again after release → success ───");

    const r4 = await reserveResource({ hospitalId: TEST_HOSPITAL_ID, emergencyId: "EMG-003", resourceType: "ICU_BED", quantity: 1, ...resParams }, db);
    assert(r4.outcome === "SUCCESS", `Reserve after release succeeds (got ${r4.outcome})`);

    const cap_c4 = await getCapacity(db);
    assert(cap_c4.availableIcuBeds === 0, `availableIcuBeds = 0 again (got ${cap_c4.availableIcuBeds})`);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-5: Expired reservation releases capacity
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-5: Expired reservation releases capacity ───");

    const expireResult = await expireReservation({ reservationId: r4.reservationId!, ...resParams }, db);
    assert(expireResult.outcome === "SUCCESS", `Expire succeeds (got ${expireResult.outcome})`);

    const cap_c5 = await getCapacity(db);
    assert(cap_c5.availableIcuBeds === 1, `availableIcuBeds = 1 after expire (got ${cap_c5.availableIcuBeds})`);
    assert(cap_c5.reservedIcuBeds  === 0, `reservedIcuBeds = 0 after expire (got ${cap_c5.reservedIcuBeds})`);

    const expiredDoc = await db.collection(RESERVATIONS_COL).findOne({ reservationId: r4.reservationId });
    assert(expiredDoc?.status === "EXPIRED", `Reservation document marked EXPIRED (got ${expiredDoc?.status})`);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-6: Invalid state transition RELEASED → CONFIRMED
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-6: Invalid transition (RELEASED → CONFIRMED) → rejected ───");

    // r1 was already RELEASED in CORRECT-3
    const invalidConfirm = await confirmAdmission({ reservationId: r1.reservationId!, ...resParams }, db);
    assert(
        invalidConfirm.outcome === "INVALID_TRANSITION" || invalidConfirm.outcome === "ALREADY_PROCESSED",
        `Invalid transition rejected (got ${invalidConfirm.outcome})`
    );
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-7: Double release → no double increment
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-7: Double release → no double increment ───");

    // Create a fresh reservation and release it twice
    const r7_base = await reserveResource({ hospitalId: TEST_HOSPITAL_ID, emergencyId: "EMG-004", resourceType: "ICU_BED", quantity: 1, ...resParams }, db);
    assert(r7_base.outcome === "SUCCESS", `Setup reserve for double-release test (got ${r7_base.outcome})`);

    const cap_before_double = await getCapacity(db);
    const avail_before = cap_before_double.availableIcuBeds;

    await releaseReservation({ reservationId: r7_base.reservationId!, ...resParams }, db);
    const cap_after_first_release = await getCapacity(db);

    await releaseReservation({ reservationId: r7_base.reservationId!, ...resParams }, db); // second call
    const cap_after_second_release = await getCapacity(db);

    assert(
        cap_after_first_release.availableIcuBeds === cap_after_second_release.availableIcuBeds,
        `Double release did NOT double-increment capacity (${cap_after_first_release.availableIcuBeds} stayed ${cap_after_second_release.availableIcuBeds})`
    );
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-8: Reserve quantity > available → atomic failure
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-8: Quantity > available → atomic failure ───");

    // Current state: 1 ICU bed, 0 reserved, 1 available
    const r8 = await reserveResource({ hospitalId: TEST_HOSPITAL_ID, emergencyId: "EMG-005", resourceType: "ICU_BED", quantity: 5, ...resParams }, db);
    assert(r8.outcome === "RESOURCE_UNAVAILABLE", `Quantity 5 > available 1 fails atomically (got ${r8.outcome})`);

    const cap_c8 = await getCapacity(db);
    assert(cap_c8.reservedIcuBeds  === 0, `reservedIcuBeds unchanged at 0 (got ${cap_c8.reservedIcuBeds})`);
    assert(cap_c8.availableIcuBeds === 1, `availableIcuBeds unchanged at 1 (got ${cap_c8.availableIcuBeds})`);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-9: Two concurrent reservations against capacity = 2
    //            → exactly 2 succeed (not 1, not 3)
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-9: Two concurrent reservations, capacity=2 → exactly 2 succeed ───");

    await db.collection(HOSPITALS_COL).deleteMany({ uid: TEST_HOSPITAL_ID });
    await db.collection(RESERVATIONS_COL).deleteMany({ hospitalId: TEST_HOSPITAL_ID });
    await db.collection(HOSPITALS_COL).insertOne(makeHospital({ totalIcu: 2 }));

    const [r9a, r9b] = await Promise.all([
        reserveResource({ hospitalId: TEST_HOSPITAL_ID, emergencyId: "EMG-C9-A", resourceType: "ICU_BED", quantity: 1, ...resParams }, db),
        reserveResource({ hospitalId: TEST_HOSPITAL_ID, emergencyId: "EMG-C9-B", resourceType: "ICU_BED", quantity: 1, ...resParams }, db)
    ]);

    console.log(`  Result A: ${r9a.outcome}`);
    console.log(`  Result B: ${r9b.outcome}`);

    const c9_success = [r9a, r9b].filter(r => r.outcome === "SUCCESS").length;
    assert(c9_success === 2, `Both succeed when capacity=2 (got ${c9_success} successes)`);

    const cap_c9 = await getCapacity(db);
    assert(cap_c9.reservedIcuBeds  === 2, `reservedIcuBeds = 2 (got ${cap_c9.reservedIcuBeds})`);
    assert(cap_c9.availableIcuBeds === 0, `availableIcuBeds = 0 (got ${cap_c9.availableIcuBeds})`);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // CORRECT-10: Confirm admission lifecycle → occupied bucket tracking
    // ═══════════════════════════════════════════════════════════════
    console.log("─── CORRECT-10: Confirm admission — reserved→occupied tracking ───");

    const confirmResult = await confirmAdmission({ reservationId: r9a.reservationId!, ...resParams }, db);
    assert(confirmResult.outcome === "SUCCESS", `Confirm admission succeeds (got ${confirmResult.outcome})`);

    const cap_c10 = await getCapacity(db);
    // After confirming 1: reserved should be 1 (r9b still pending), occupied = 1, available = 0
    assert(cap_c10.occupiedIcuBeds === 1, `occupiedIcuBeds = 1 after admission (got ${cap_c10.occupiedIcuBeds})`);
    assert(cap_c10.reservedIcuBeds === 1, `reservedIcuBeds = 1 (r9b still pending, got ${cap_c10.reservedIcuBeds})`);
    assert(cap_c10.availableIcuBeds === 0, `availableIcuBeds still 0 (available unchanged by confirm, got ${cap_c10.availableIcuBeds})`);

    const confirmedDoc = await db.collection(RESERVATIONS_COL).findOne({ reservationId: r9a.reservationId });
    assert(confirmedDoc?.status === "CONFIRMED", `Reservation document is CONFIRMED (got ${confirmedDoc?.status})`);
    console.log();

    // ═══════════════════════════════════════════════════════════════
    // FINAL INVARIANT CHECK
    // ═══════════════════════════════════════════════════════════════
    console.log("─── FINAL: MongoDB Capacity Invariant Check ───");

    const finalCap = await getCapacity(db);
    const derived = finalCap.icuBeds - finalCap.occupiedIcuBeds - finalCap.reservedIcuBeds;
    assert(
        derived === finalCap.availableIcuBeds,
        `ICU invariant holds: total(${finalCap.icuBeds}) - occupied(${finalCap.occupiedIcuBeds}) - reserved(${finalCap.reservedIcuBeds}) = available(${finalCap.availableIcuBeds}) [derived=${derived}]`
    );
    console.log();

    // ─── Cleanup ──────────────────────────────────────────────────────────────
    console.log("─── Cleanup: removing test collections ───");
    await db.collection(HOSPITALS_COL).drop().catch(() => {});
    await db.collection(RESERVATIONS_COL).drop().catch(() => {});
    await db.collection(EVENTS_COL).drop().catch(() => {});
    console.log("  ✔ Test collections dropped\n");

    // ─── Summary ──────────────────────────────────────────────────────────────
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`📊 RESULTS:  ${passed} passed  /  ${failed} failed  /  ${passed + failed} total`);
    if (failed === 0) {
        console.log("🎉 ALL RESERVATION & CONCURRENCY TESTS PASSED!");
    } else {
        console.log("❌ SOME TESTS FAILED — review output above.");
    }
    console.log("═══════════════════════════════════════════════════════════════\n");

    await client.close();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error("Test suite crashed:", err);
    process.exit(1);
});
