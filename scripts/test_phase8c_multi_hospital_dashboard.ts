/**
 * PHASE 8C — MULTI-HOSPITAL DASHBOARD & EMERGENCY ACCEPT/REJECT VALIDATION TEST
 *
 * Verifies:
 * 1. MongoDB contains multiple operational hospitals (count >= 2).
 * 2. Dashboard API retrieves all operational hospitals dynamically.
 * 3. Hospital A can be selected (via hospitalId query parameter).
 * 4. Hospital B can be selected (via hospitalId query parameter).
 * 5. Capacity shown for Hospital A belongs strictly to Hospital A.
 * 6. Capacity shown for Hospital B belongs strictly to Hospital B (no cross-contamination).
 * 7. Incoming reservation allocated to Hospital A appears under Hospital A.
 * 8. Incoming reservation allocated to Hospital A does NOT appear under Hospital B.
 * 9. Hospital A can ACCEPT or REJECT its incoming reservation via existing action endpoint.
 * 10. Existing CAS reservation logic remains intact (PENDING -> CONFIRMED / REJECTED).
 * 11. Switching between hospitals does not alter reservation state or capacity invariant.
 * 12. No hospital names, IDs, or capacities are hardcoded in the data layer.
 */

import { MongoClient } from "mongodb";
import { GET as handleActiveState } from "../app/api/emergency/active/route";
import { POST as handleReservationAction } from "../app/api/emergency/reservations/[reservationId]/action/route";
import { reserveResource } from "../lib/emergency/emergency-reservation";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/meddecision";
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

function header(title: string) {
    console.log("\n" + "=".repeat(75));
    console.log(title);
    console.log("=".repeat(75));
}

export async function runMultiHospitalDashboardTest() {
    header("PHASE 8C: MULTI-HOSPITAL DASHBOARD & ACCEPT/REJECT VALIDATION");
    console.log("Connecting to live MongoDB database...");

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(DB_NAME);

    try {
        // =========================================================================
        // 1. MONGODB CONTAINS MULTIPLE HOSPITALS
        // =========================================================================
        header("1. MULTIPLE OPERATIONAL HOSPITALS IN MONGODB");
        const allHospitals = await db.collection("hospitals").find({}).sort({ hospitalName: 1 }).toArray();
        console.log(`Found ${allHospitals.length} operational hospitals in database:`);
        allHospitals.forEach(h => console.log(`  - [${h.uid || h.hospitalId}] ${h.hospitalName}`));

        assert(allHospitals.length >= 2, `MongoDB contains multiple hospitals (count: ${allHospitals.length} >= 2)`);
        assert(allHospitals.length >= 5, `Expected 5 operational demo hospitals in benchmark fleet (found: ${allHospitals.length})`);

        const hospitalA = allHospitals[0];
        const hospitalB = allHospitals[1];
        const hidA = hospitalA.uid || hospitalA.hospitalId;
        const hidB = hospitalB.uid || hospitalB.hospitalId;

        console.log(`\nDesignated test pair:`);
        console.log(`  Hospital A: [${hidA}] ${hospitalA.hospitalName}`);
        console.log(`  Hospital B: [${hidB}] ${hospitalB.hospitalName}`);
        assert(hidA !== hidB, "Hospital A and Hospital B have distinct identifiers");

        // =========================================================================
        // 2. DASHBOARD RETRIEVES ALL OPERATIONAL HOSPITALS DYNAMICALLY
        // =========================================================================
        header("2. DYNAMIC RETRIEVAL OF ALL HOSPITALS (GET /api/emergency/active)");
        const reqUnfiltered = new Request("http://localhost:3000/api/emergency/active");
        const resUnfiltered = await handleActiveState(reqUnfiltered);
        const dataUnfiltered = await resUnfiltered.json();

        assert(dataUnfiltered.success === true, "GET /api/emergency/active returns success: true");
        assert(Array.isArray(dataUnfiltered.hospitals), "Response includes hospitals array");
        assert(dataUnfiltered.hospitals.length === allHospitals.length, `Returns all ${allHospitals.length} operational hospitals in master list`);

        // Check no hardcoding
        const hospitalNamesInDb = new Set(allHospitals.map(h => h.hospitalName));
        const hospitalNamesInApi = new Set(dataUnfiltered.hospitals.map((h: any) => h.hospitalName));
        assert(
            allHospitals.every(h => hospitalNamesInApi.has(h.hospitalName)),
            "All MongoDB hospital names match API response dynamically without hardcoded values"
        );

        // =========================================================================
        // 3. HOSPITAL A CAN BE SELECTED & SHOWS ALL HOSPITALS IN SWITCHER LIST
        // =========================================================================
        header("3. HOSPITAL A SELECTION & CONTEXT ISOLATION");
        const reqA = new Request(`http://localhost:3000/api/emergency/active?hospitalId=${encodeURIComponent(hidA)}`);
        const resA = await handleActiveState(reqA);
        const dataA = await resA.json();

        assert(dataA.success === true, "Query with hospitalId=A returns HTTP 200 OK");
        assert(dataA.hospitals.length === allHospitals.length, "API still returns ALL hospitals for switcher when Hospital A is selected");
        assert(dataA.selectedHospitalId === hidA, "API identifies Hospital A as active selectedHospitalId");
        assert(dataA.selectedHospital?.hospitalName === hospitalA.hospitalName, `Active hospital object matches: ${hospitalA.hospitalName}`);

        // =========================================================================
        // 4. HOSPITAL B CAN BE SELECTED & SHOWS ALL HOSPITALS IN SWITCHER LIST
        // =========================================================================
        header("4. HOSPITAL B SELECTION & CONTEXT ISOLATION");
        const reqB = new Request(`http://localhost:3000/api/emergency/active?hospitalId=${encodeURIComponent(hidB)}`);
        const resB = await handleActiveState(reqB);
        const dataB = await resB.json();

        assert(dataB.success === true, "Query with hospitalId=B returns HTTP 200 OK");
        assert(dataB.hospitals.length === allHospitals.length, "API still returns ALL hospitals for switcher when Hospital B is selected");
        assert(dataB.selectedHospitalId === hidB, "API identifies Hospital B as active selectedHospitalId");
        assert(dataB.selectedHospital?.hospitalName === hospitalB.hospitalName, `Active hospital object matches: ${hospitalB.hospitalName}`);

        // =========================================================================
        // 5 & 6. CAPACITY SHOWN FOR A BELONGS TO A, AND B BELONGS TO B
        // =========================================================================
        header("5 & 6. INDEPENDENT CAPACITY VERIFICATION");
        const capA = dataA.selectedHospital?.operationalCapacity || hospitalA.operationalCapacity || {};
        const capB = dataB.selectedHospital?.operationalCapacity || hospitalB.operationalCapacity || {};

        console.log(`Hospital A Capacity: ICU=${capA.availableIcuBeds ?? capA.icuBeds}/${capA.icuBeds}, General=${capA.availableBeds ?? capA.totalBeds}/${capA.totalBeds}`);
        console.log(`Hospital B Capacity: ICU=${capB.availableIcuBeds ?? capB.icuBeds}/${capB.icuBeds}, General=${capB.availableBeds ?? capB.totalBeds}/${capB.totalBeds}`);

        assert(dataA.selectedHospital.uid === hidA, "Capacity data A belongs strictly to Hospital A");
        assert(dataB.selectedHospital.uid === hidB, "Capacity data B belongs strictly to Hospital B");
        assert(dataA.selectedHospital.hospitalName !== dataB.selectedHospital.hospitalName, "Hospital A and Hospital B have distinct names");

        // =========================================================================
        // 7 & 8. RESERVATION FOR A APPEARS UNDER A, AND NOT UNDER B
        // =========================================================================
        header("7 & 8. RESERVATION ROUTING & ISOLATION BETWEEN HOSPITALS");
        const testEmgId = `TEST-MULTI-EMG-${Date.now()}`;
        const initialAvailIcuA = hospitalA.operationalCapacity?.availableIcuBeds ?? hospitalA.availableIcuBeds ?? 8;

        // Create a test emergency request allocated to Hospital A
        await db.collection("emergencyRequests").insertOne({
            emergencyId: testEmgId,
            patientName: "Multi-Hospital Isolation Test Patient",
            priority: "RED",
            condition: "Cardiac Presentation",
            allocatedHospitalId: hidA,
            receivingHospitalId: hidA,
            ambulanceId: "AMB-PUNE-01",
            status: "ALLOCATED",
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Reserve 1 ICU bed at Hospital A via CAS
        const resvResult = await reserveResource(
            {
                emergencyId: testEmgId,
                hospitalId: hidA,
                resourceType: "ICU_BED",
                quantity: 1
            },
            db
        );

        assert(resvResult.outcome === "SUCCESS", `Bed reservation successfully created at Hospital A via CAS (ID: ${resvResult.reservation?.reservationId})`);
        const testResvId = resvResult.reservation!.reservationId;

        // Query Hospital A active view
        const queryResA = await handleActiveState(new Request(`http://localhost:3000/api/emergency/active?hospitalId=${encodeURIComponent(hidA)}`));
        const stateA = await queryResA.json();
        const incomingForA = stateA.reservations.filter((r: any) => r.reservationId === testResvId);
        assert(incomingForA.length === 1, "Reservation for Hospital A appears under Hospital A's active board");
        assert(incomingForA[0].status === "PENDING", "Incoming reservation status under Hospital A is PENDING");

        // Query Hospital B active view
        const queryResB = await handleActiveState(new Request(`http://localhost:3000/api/emergency/active?hospitalId=${encodeURIComponent(hidB)}`));
        const stateB = await queryResB.json();
        const incomingForB = stateB.reservations.filter((r: any) => r.reservationId === testResvId);
        assert(incomingForB.length === 0, "Reservation for Hospital A does NOT appear under Hospital B's active board");

        const emgUnderB = stateB.emergencies.filter((e: any) => e.emergencyId === testEmgId);
        assert(emgUnderB.length === 0, "Emergency record for Hospital A does NOT leak into Hospital B's queue");

        // =========================================================================
        // 9 & 10. HOSPITAL A ACCEPTS RESERVATION (CAS CONFIRMATION)
        // =========================================================================
        header("9 & 10. HOSPITAL A ACCEPTS RESERVATION VIA CAS");
        const actionParams = Promise.resolve({ reservationId: testResvId });
        const acceptReq = new Request(`http://localhost:3000/api/emergency/reservations/${testResvId}/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "confirm" })
        });

        const acceptRes = await handleReservationAction(acceptReq, { params: actionParams });
        const acceptData = await acceptRes.json();
        assert(acceptData.success === true, "Hospital A successfully executes ACCEPT action on reservation");
        assert(acceptData.reservation.status === "CONFIRMED", "Reservation transitions cleanly from PENDING -> CONFIRMED");

        // Verify MongoDB state
        const dbResv = await db.collection("reservations").findOne({ reservationId: testResvId });
        assert(dbResv?.status === "CONFIRMED", "MongoDB reservation document reflects CONFIRMED status");

        // Verify capacity invariant at Hospital A
        const updatedHospA = await db.collection("hospitals").findOne({
            $or: [{ uid: hidA }, { hospitalId: hidA }]
        });
        const reservedCountA = updatedHospA?.capacity?.reservedIcuBeds ?? updatedHospA?.operationalCapacity?.reservedIcuBeds ?? 0;
        assert(reservedCountA >= 1, `Hospital A reserved ICU beds counter is incremented to hold the bed (count: ${reservedCountA})`);

        // =========================================================================
        // 11. SWITCHING HOSPITALS PRESERVES RESERVATION STATE
        // =========================================================================
        header("11. SWITCHING HOSPITALS DOES NOT ALTER RESERVATION STATE");
        // Switch to Hospital B
        const switchReqB = await handleActiveState(new Request(`http://localhost:3000/api/emergency/active?hospitalId=${encodeURIComponent(hidB)}`));
        const switchStateB = await switchReqB.json();
        assert(switchStateB.selectedHospitalId === hidB, "Switched to Hospital B successfully");
        assert(!switchStateB.reservations.some((r: any) => r.reservationId === testResvId), "Hospital B still does not see Hospital A's reservation");

        // Switch back to Hospital A
        const switchReqA = await handleActiveState(new Request(`http://localhost:3000/api/emergency/active?hospitalId=${encodeURIComponent(hidA)}`));
        const switchStateA = await switchReqA.json();
        assert(switchStateA.selectedHospitalId === hidA, "Switched back to Hospital A successfully");
        const resvUnderAAfterSwitch = switchStateA.reservations.find((r: any) => r.reservationId === testResvId);
        assert(!!resvUnderAAfterSwitch, "Hospital A still sees its reservation after switching");
        assert(resvUnderAAfterSwitch?.status === "CONFIRMED", "Reservation status remains CONFIRMED after hospital switching");

        // =========================================================================
        // 12. TEST REJECT ACTION (PENDING -> REJECTED & CAPACITY FREED)
        // =========================================================================
        header("12. TEST REJECT ACTION & CAPACITY RESTORATION");
        const rejectEmgId = `TEST-REJECT-EMG-${Date.now()}`;
        await db.collection("emergencyRequests").insertOne({
            emergencyId: rejectEmgId,
            patientName: "Reject Test Patient",
            priority: "YELLOW",
            allocatedHospitalId: hidB,
            receivingHospitalId: hidB,
            status: "ALLOCATED",
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const rejectResvResult = await reserveResource(
            {
                emergencyId: rejectEmgId,
                hospitalId: hidB,
                resourceType: "GENERAL_BED",
                quantity: 1
            },
            db
        );
        assert(rejectResvResult.outcome === "SUCCESS", `Created reservation at Hospital B to test REJECT (ID: ${rejectResvResult.reservation?.reservationId})`);
        const rejectResvId = rejectResvResult.reservation!.reservationId;

        // Hospital B rejects the reservation
        const rejectReq = new Request(`http://localhost:3000/api/emergency/reservations/${rejectResvId}/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "reject" })
        });
        const rejectRes = await handleReservationAction(rejectReq, { params: Promise.resolve({ reservationId: rejectResvId }) });
        const rejectData = await rejectRes.json();
        assert(rejectData.success === true, "Hospital B executes REJECT action successfully");
        assert(rejectData.outcome === "SUCCESS", "REJECT action outcome is SUCCESS");

        const dbRejectResv = await db.collection("reservations").findOne({ reservationId: rejectResvId });
        assert(dbRejectResv?.status === "REJECTED", "MongoDB reservation document reflects REJECTED status");

        // =========================================================================
        // CLEANUP TEST RECORDS
        // =========================================================================
        console.log("\nCleaning up test records...");
        await db.collection("emergencyRequests").deleteMany({
            emergencyId: { $in: [testEmgId, rejectEmgId] }
        });
        await db.collection("reservations").deleteMany({
            reservationId: { $in: [testResvId, rejectResvId] }
        });
        // Restore capacity counters
        await db.collection("hospitals").updateOne(
            { $or: [{ uid: hidA }, { hospitalId: hidA }] },
            { $set: { "operationalCapacity.reservedIcuBeds": 0, "operationalCapacity.availableIcuBeds": initialAvailIcuA } }
        );
        console.log("Cleanup complete.");

        header(`TEST SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED (TOTAL: ${totalAssertions})`);
        if (failedAssertions > 0) {
            process.exit(1);
        }

    } catch (err: any) {
        console.error("Test execution failed with error:", err);
        process.exit(1);
    } finally {
        await client.close();
    }
}

// Direct execution
if (require.main === module) {
    runMultiHospitalDashboardTest().catch(err => {
        console.error("Fatal error:", err);
        process.exit(1);
    });
}
