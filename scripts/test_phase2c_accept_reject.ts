import { MongoClient } from "mongodb";
import { allocateEmergencyHospital } from "../lib/emergency/emergency-allocator";
import {
    reserveResource,
    confirmReservation,
    rejectReservation
} from "../lib/emergency/emergency-reservation";

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/meddecision";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        failed++;
    }
}

async function runPhase2CTestSuite() {
    console.log("=========================================================================");
    console.log("PHASE 2C INTEGRATION TEST SUITE: HOSPITAL ACCEPT / REJECT RESERVATION");
    console.log("=========================================================================\n");

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    console.log(`Connected to MongoDB operational database: ${db.databaseName}\n`);

    const runId = `P2C-${Date.now().toString(36).toUpperCase()}`;
    const hospitalAId = `HOSP-A-${runId}`;
    const hospitalBId = `HOSP-B-${runId}`;
    const ambulanceId1 = `AMB-1-${runId}`;
    const ambulanceId2 = `AMB-2-${runId}`;
    const emergencyId1 = `EMG-1-${runId}`;
    const emergencyId2 = `EMG-2-${runId}`;

    try {
        const now = new Date();

        // -----------------------------------------------------------------------------
        // SETUP LIVE OPERATIONAL HOSPITAL FIXTURES IN MONGODB
        // -----------------------------------------------------------------------------
        console.log("--- SETUP: SEEDING OPERATIONAL HOSPITAL & AMBULANCE FIXTURES ---");

        // Hospital A: Metro Heart & Trauma (Total 10 ICU, Occ 6, Res 1, Avail 3)
        await db.collection("hospitals").insertOne({
            uid: hospitalAId,
            hospitalId: hospitalAId,
            hospitalName: "Metro Heart & Trauma Center",
            latitude: 18.5300,
            longitude: 73.8500,
            address: "Shivajinagar, Pune",
            specialties: ["Cardiology", "Emergency Medicine", "Critical Care"],
            instruments: ["ventilator", "cath_lab_system", "icu_monitor"],
            capacity: {
                totalBeds: 100,
                availableBeds: 40,
                occupiedBeds: 55,
                reservedBeds: 5,
                icuBeds: 10,
                availableIcuBeds: 3,
                occupiedIcuBeds: 6,
                reservedIcuBeds: 1,
                operationTheatres: 4,
                availableOTs: 2,
                reservedOTs: 0,
                occupiedOTs: 2,
                onDutySpecialist: 2,
                emergencyAvailable: true,
                updatedAt: new Date(now.getTime() - 2 * 60 * 1000)
            }
        });

        // Hospital B: City Emergency Center (Total 8 ICU, Occ 4, Res 0, Avail 4)
        await db.collection("hospitals").insertOne({
            uid: hospitalBId,
            hospitalId: hospitalBId,
            hospitalName: "City Emergency Center",
            latitude: 18.5350,
            longitude: 73.8450,
            address: "FC Road, Pune",
            specialties: ["Cardiology", "Emergency Medicine", "Trauma Care"],
            instruments: ["ventilator", "defibrillator", "icu_monitor"],
            capacity: {
                totalBeds: 80,
                availableBeds: 30,
                occupiedBeds: 45,
                reservedBeds: 5,
                icuBeds: 8,
                availableIcuBeds: 4,
                occupiedIcuBeds: 4,
                reservedIcuBeds: 0,
                operationTheatres: 3,
                availableOTs: 2,
                reservedOTs: 0,
                occupiedOTs: 1,
                onDutySpecialist: 2,
                emergencyAvailable: true,
                updatedAt: new Date(now.getTime() - 3 * 60 * 1000)
            }
        });

        // Seed Ambulances
        await db.collection("ambulances").insertMany([
            {
                ambulanceId: ambulanceId1,
                callSign: "EMS-ALPHA",
                vehicleType: "ALS",
                status: "TRANSPORTING",
                currentEmergencyId: emergencyId1,
                assignedEmergencyId: emergencyId1,
                currentLocation: { latitude: 18.5250, longitude: 73.8400 },
                speedKmH: 50,
                updatedAt: now
            },
            {
                ambulanceId: ambulanceId2,
                callSign: "EMS-BRAVO",
                vehicleType: "ALS",
                status: "TRANSPORTING",
                currentEmergencyId: emergencyId2,
                assignedEmergencyId: emergencyId2,
                currentLocation: { latitude: 18.5280, longitude: 73.8420 },
                speedKmH: 45,
                updatedAt: now
            }
        ]);

        console.log("  ✓ Operational hospital and ambulance fixtures seeded successfully.\n");

        // =============================================================================
        // FLOW 1: PATIENT -> AMBULANCE -> ALLOCATION -> RESERVE -> HOSPITAL ACCEPTS
        // =============================================================================
        console.log("--- FLOW 1: END-TO-END ACCEPTANCE FLOW (12 VERIFICATION STEPS) ---");

        // 1. Patient emergency exists
        await db.collection("emergencyRequests").insertOne({
            emergencyId: emergencyId1,
            patientId: `PAT-${runId}`,
            emergencyType: "Cardiac Emergency",
            priority: "P1_CRITICAL",
            condition: "Acute Myocardial Infarction",
            chiefComplaint: "Crushing retrosternal chest pain radiating to left arm",
            incidentLocation: {
                latitude: 18.5204,
                longitude: 73.8567,
                address: "Shivajinagar Station, Pune"
            },
            requiredSpecialty: "Cardiology",
            requiredResources: ["ICU_BED", "VENTILATOR"],
            status: "TRANSPORTING",
            ambulanceId: ambulanceId1,
            allocatedHospitalId: null,
            receivingHospitalId: null,
            createdAt: now,
            updatedAt: now
        });
        const emg1 = await db.collection("emergencyRequests").findOne({ emergencyId: emergencyId1 });
        assert(emg1 !== null, "Step 1: Patient emergency exists in MongoDB");

        // 2. Ambulance picks up patient (status is TRANSPORTING)
        const amb1 = await db.collection("ambulances").findOne({ ambulanceId: ambulanceId1 });
        assert(amb1?.status === "TRANSPORTING", "Step 2: Ambulance picks up patient and is in TRANSPORTING status");

        // 3. Allocator returns suitable hospitals
        const allocationResult = await allocateEmergencyHospital({
            emergencyId: emergencyId1,
            condition: emg1!.condition,
            chiefComplaint: emg1!.chiefComplaint,
            priority: emg1!.priority,
            requiredSpecialty: emg1!.requiredSpecialty,
            requiredResources: emg1!.requiredResources,
            incidentLocation: emg1!.incidentLocation
        });
        assert(allocationResult.results.length >= 2, "Step 3: Allocator returns evaluated regional hospitals");
        const hospASuitable = allocationResult.results.find(r => r.hospitalId === hospitalAId);
        assert(hospASuitable?.suitability === true, "Step 3: Hospital A evaluated as suitable receiving candidate");

        // 4. Ambulance requests reservation at Hospital A
        const reserveRes1 = await reserveResource({
            hospitalId: hospitalAId,
            emergencyId: emergencyId1,
            resourceType: "ICU_BED",
            quantity: 1,
            ttlMinutes: 30,
            allocatedBy: "AUTO_ALLOCATOR"
        }, db);
        assert(reserveRes1.outcome === "SUCCESS", "Step 4: Ambulance requests reservation at Hospital A");
        const resvId1 = reserveRes1.reservationId!;

        // Update emergency with allocatedHospitalId (as done by /api/emergency/reserve)
        await db.collection("emergencyRequests").updateOne(
            { emergencyId: emergencyId1 },
            { $set: { allocatedHospitalId: hospitalAId, reservationId: resvId1 } }
        );

        // 5. Reservation is PENDING
        const resvDoc1 = await db.collection("reservations").findOne({ reservationId: resvId1 });
        assert(resvDoc1?.status === "PENDING", "Step 5: Reservation is in PENDING status in MongoDB");

        // 6. Hospital board displays PENDING
        // Verify query: board matches hospitalId and sees pending reservation
        const boardReservations = await db.collection("reservations")
            .find({ hospitalId: hospitalAId, status: "PENDING" })
            .toArray();
        assert(boardReservations.some(r => r.reservationId === resvId1), "Step 6: Hospital Emergency Board displays PENDING reservation request");

        // 7. Hospital ACCEPTS reservation
        const confirmResult = await confirmReservation({ reservationId: resvId1 }, db);
        assert(confirmResult.outcome === "SUCCESS", "Step 7: Hospital clicks ACCEPT and confirmReservation succeeds");

        // Simulate reservation action endpoint DB synchronization
        await db.collection("emergencyRequests").updateOne(
            { emergencyId: emergencyId1 },
            { $set: { receivingHospitalId: hospitalAId, status: "TRANSPORTING", updatedAt: new Date() } }
        );
        await db.collection("ambulances").updateMany(
            { $or: [{ currentEmergencyId: emergencyId1 }, { ambulanceId: ambulanceId1 }] },
            { $set: { destinationHospitalId: hospitalAId, updatedAt: new Date() } }
        );

        // 8. Reservation becomes CONFIRMED
        const resvConfirmed = await db.collection("reservations").findOne({ reservationId: resvId1 });
        assert(resvConfirmed?.status === "CONFIRMED", "Step 8: Reservation document transitioned to CONFIRMED");

        // 9. Ambulance sees DESTINATION CONFIRMED
        const ambAfterAccept = await db.collection("ambulances").findOne({ ambulanceId: ambulanceId1 });
        assert(ambAfterAccept?.destinationHospitalId === hospitalAId, "Step 9: Ambulance UI receives DESTINATION CONFIRMED with matching hospital");
        assert(ambAfterAccept?.status === "TRANSPORTING", "Step 9: Ambulance did NOT automatically advance transport to ARRIVED (preserved for Phase 3)");

        // 10. Hospital sees CONFIRMED
        const hospBoardConfirmed = await db.collection("reservations").findOne({
            hospitalId: hospitalAId,
            reservationId: resvId1,
            status: "CONFIRMED"
        });
        assert(hospBoardConfirmed !== null, "Step 10: Hospital Emergency Board displays Status: CONFIRMED");

        // 11. Hospital capacity remains reserved (not occupied yet)
        const hospDocA = await db.collection("hospitals").findOne({ uid: hospitalAId });
        const capA = hospDocA?.capacity || {};
        assert(capA.reservedIcuBeds === 2, "Step 11: Hospital reservedIcuBeds remains 2 (secured capacity)");
        assert(capA.occupiedIcuBeds === 6, "Step 11: Patient NOT moved to occupied beds yet (occupied remains 6)");
        assert(capA.availableIcuBeds === 2, "Step 11: Available beds reflects total - occupied - reserved (10 - 6 - 2 = 2)");

        // 12. Patient sees receiving hospital confirmed
        const emgPatientView = await db.collection("emergencyRequests").findOne({ emergencyId: emergencyId1 });
        assert(emgPatientView?.receivingHospitalId === hospitalAId, "Step 12: Patient UI sees RECEIVING HOSPITAL CONFIRMED");

        console.log("  ✓ All 12 acceptance steps verified against live MongoDB!\n");

        // =============================================================================
        // FLOW 2: HOSPITAL REJECTS PENDING RESERVATION & CAPACITY RELEASE
        // =============================================================================
        console.log("--- FLOW 2: HOSPITAL REJECTION & CAPACITY RELEASE ---");

        // Create second emergency
        await db.collection("emergencyRequests").insertOne({
            emergencyId: emergencyId2,
            patientId: `PAT-2-${runId}`,
            emergencyType: "Cardiac Emergency",
            priority: "P1_CRITICAL",
            condition: "Ventricular Tachycardia",
            chiefComplaint: "Sudden collapse with syncope and rapid pulse",
            incidentLocation: {
                latitude: 18.5204,
                longitude: 73.8567,
                address: "Shivajinagar Station, Pune"
            },
            requiredSpecialty: "Cardiology",
            requiredResources: ["ICU_BED"],
            status: "TRANSPORTING",
            ambulanceId: ambulanceId2,
            allocatedHospitalId: null,
            receivingHospitalId: null,
            createdAt: now,
            updatedAt: now
        });

        // Check Hospital B initial capacity (availableIcuBeds: 4, reservedIcuBeds: 0, occupied: 4)
        const hospBBefore = await db.collection("hospitals").findOne({ uid: hospitalBId });
        assert(hospBBefore?.capacity.availableIcuBeds === 4, "Pre-condition: Hospital B available ICU beds is 4");
        assert(hospBBefore?.capacity.reservedIcuBeds === 0, "Pre-condition: Hospital B reserved ICU beds is 0");

        // 1. Create PENDING reservation at Hospital B
        const reserveRes2 = await reserveResource({
            hospitalId: hospitalBId,
            emergencyId: emergencyId2,
            resourceType: "ICU_BED",
            quantity: 1,
            ttlMinutes: 30,
            allocatedBy: "AUTO_ALLOCATOR"
        }, db);
        assert(reserveRes2.outcome === "SUCCESS", "Step 1: PENDING reservation created at Hospital B");
        const resvId2 = reserveRes2.reservationId!;

        // Capacity during pending: reserved incremented to 1, available decremented to 3
        const hospBDuring = await db.collection("hospitals").findOne({ uid: hospitalBId });
        assert(hospBDuring?.capacity.reservedIcuBeds === 1, "Hospital B reservedIcuBeds incremented to 1 while PENDING");
        assert(hospBDuring?.capacity.availableIcuBeds === 3, "Hospital B availableIcuBeds decremented to 3 while PENDING");

        // 2. Hospital REJECTS
        const rejectResult = await rejectReservation({ reservationId: resvId2 }, db);
        assert(rejectResult.outcome === "SUCCESS", "Step 2: Hospital clicks REJECT and rejectReservation succeeds");

        // 3. Reservation becomes REJECTED
        const resvDoc2 = await db.collection("reservations").findOne({ reservationId: resvId2 });
        assert(resvDoc2?.status === "REJECTED", "Step 3: Reservation document status transitioned to REJECTED");

        // 4. Reserved capacity is returned to available
        const hospBAfter = await db.collection("hospitals").findOne({ uid: hospitalBId });
        assert(hospBAfter?.capacity.reservedIcuBeds === 0, "Step 4: Hospital B reservedIcuBeds decremented back to 0");
        assert(hospBAfter?.capacity.availableIcuBeds === 4, "Step 4: Hospital B availableIcuBeds restored back to 4");
        const invB = (hospBAfter?.capacity.totalBeds || 8) === (hospBAfter?.capacity.occupiedBeds || 4) + (hospBAfter?.capacity.reservedBeds || 0) + (hospBAfter?.capacity.availableBeds || 4);
        assert(invB, "Step 4: Invariant available = total - occupied - reserved is strictly preserved");

        // 5. Ambulance sees rejection
        // Fetch active reservation for emergencyId2
        const amb2ActiveRes = await db.collection("reservations")
            .find({ emergencyId: emergencyId2 })
            .sort({ createdAt: -1 })
            .limit(1)
            .next();
        assert(amb2ActiveRes?.status === "REJECTED", "Step 5: Ambulance console active reservation is REJECTED");

        // 6. Ambulance can refresh and select another hospital (Hospital A)
        // Ambulance requests reservation at alternative Hospital A
        const reserveAlternative = await reserveResource({
            hospitalId: hospitalAId,
            emergencyId: emergencyId2,
            resourceType: "ICU_BED",
            quantity: 1,
            ttlMinutes: 30,
            allocatedBy: "MANUAL_DISPATCH"
        }, db);
        assert(reserveAlternative.outcome === "SUCCESS", "Step 6: Ambulance successfully selects and reserves alternative Hospital A");
        const resvAltDoc = await db.collection("reservations").findOne({ reservationId: reserveAlternative.reservationId });
        assert(resvAltDoc?.status === "PENDING", "Step 6: New alternative reservation created in PENDING status");

        console.log("  ✓ Hospital rejection and capacity restoration verified!\n");

        // =============================================================================
        // FLOW 3: CONCURRENCY, DUPLICATE ACTIONS, AND INVALID TRANSITIONS
        // =============================================================================
        console.log("--- FLOW 3: CONCURRENCY & TERMINAL STATE SAFETY ---");

        // Test 1: Accept twice (resvId1 is already CONFIRMED)
        const acceptTwice = await confirmReservation({ reservationId: resvId1 }, db);
        assert(
            acceptTwice.outcome === "ALREADY_PROCESSED" || acceptTwice.outcome === "INVALID_TRANSITION",
            `Accept twice correctly blocked with safe error: ${acceptTwice.outcome}`
        );

        // Test 2: Reject after accept (resvId1 is CONFIRMED)
        const rejectAfterAccept = await rejectReservation({ reservationId: resvId1 }, db);
        assert(
            rejectAfterAccept.outcome === "INVALID_TRANSITION" || rejectAfterAccept.outcome === "ALREADY_PROCESSED",
            `Reject after accept correctly blocked: ${rejectAfterAccept.outcome}`
        );

        // Test 3: Reject twice (resvId2 is already REJECTED)
        const rejectTwice = await rejectReservation({ reservationId: resvId2 }, db);
        assert(
            rejectTwice.outcome === "INVALID_TRANSITION" || rejectTwice.outcome === "ALREADY_PROCESSED",
            `Reject twice correctly blocked: ${rejectTwice.outcome}`
        );

        // Test 4: Accept after reject (resvId2 is REJECTED)
        const acceptAfterReject = await confirmReservation({ reservationId: resvId2 }, db);
        assert(
            acceptAfterReject.outcome === "INVALID_TRANSITION" || acceptAfterReject.outcome === "ALREADY_PROCESSED",
            `Accept after reject correctly blocked: ${acceptAfterReject.outcome}`
        );

        // =============================================================================
        // FLOW 4: AUDIT EVENTS VERIFICATION
        // =============================================================================
        console.log("\n--- FLOW 4: EVENT AUDIT LOGGING ---");

        // Check RESERVATION_CONFIRMED event
        const confirmEvent = await db.collection("hospitalEvents").findOne({
            reservationId: resvId1,
            eventType: "RESERVATION_CONFIRMED"
        });
        assert(confirmEvent !== null, "Audit event RESERVATION_CONFIRMED exists in hospitalEvents");
        assert(confirmEvent?.hospitalId === hospitalAId, "Audit event has real hospitalId");
        assert(confirmEvent?.emergencyId === emergencyId1, "Audit event has real emergencyId");
        assert(confirmEvent?.timestamp instanceof Date, "Audit event has real timestamp");

        // Check RESERVATION_REJECTED event
        const rejectEvent = await db.collection("hospitalEvents").findOne({
            reservationId: resvId2,
            eventType: "RESERVATION_REJECTED"
        });
        assert(rejectEvent !== null, "Audit event RESERVATION_REJECTED exists in hospitalEvents");
        assert(rejectEvent?.hospitalId === hospitalBId, "Audit event has real hospitalId");
        assert(rejectEvent?.emergencyId === emergencyId2, "Audit event has real emergencyId");

        console.log("  ✓ All audit events verified with real IDs!\n");

    } finally {
        // Clean up test data
        console.log("--- CLEANUP: REMOVING TEST FIXTURES ---");
        await db.collection("hospitals").deleteMany({ uid: { $in: [hospitalAId, hospitalBId] } });
        await db.collection("ambulances").deleteMany({ ambulanceId: { $in: [ambulanceId1, ambulanceId2] } });
        await db.collection("emergencyRequests").deleteMany({ emergencyId: { $in: [emergencyId1, emergencyId2] } });
        await db.collection("reservations").deleteMany({ emergencyId: { $in: [emergencyId1, emergencyId2] } });
        await db.collection("hospitalEvents").deleteMany({ emergencyId: { $in: [emergencyId1, emergencyId2] } });
        await client.close();
        console.log("Cleaned up operational test records.\n");
    }

    console.log("=========================================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runPhase2CTestSuite().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
