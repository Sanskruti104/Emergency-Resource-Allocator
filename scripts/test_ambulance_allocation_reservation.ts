import { MongoClient } from "mongodb";
import { allocateEmergencyHospital, calculateFreshness } from "../lib/emergency/emergency-allocator";
import { reserveResource, confirmReservation, rejectReservation } from "../lib/emergency/emergency-reservation";

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

async function runTestSuite() {
    console.log("=========================================================================");
    console.log("PHASE 2 INTEGRATION TEST SUITE: HOSPITAL ALLOCATION & TWO-WAY RESERVATION");
    console.log("=========================================================================\n");

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    console.log(`Connected to MongoDB operational database: ${db.databaseName}\n`);

    const testId = `TEST-P2-${Date.now().toString(36).toUpperCase()}`;
    const emergencyId = `EMG-${testId}`;
    const ambulanceId = `AMB-${testId}`;

    const hospitalAId = `HOSP-A-${testId}`;
    const hospitalBId = `HOSP-B-${testId}`;
    const hospitalCId = `HOSP-C-${testId}`;

    try {
        const now = new Date();

        // -----------------------------------------------------------------------------
        // SETUP LIVE OPERATIONAL HOSPITAL FIXTURES IN MONGODB
        // -----------------------------------------------------------------------------
        console.log("--- SETUP: SEEDING OPERATIONAL HOSPITAL FIXTURES ---");

        // Hospital A: Optimal Suitable Cardiac Hospital (Fresh, High ICU, Close)
        await db.collection("hospitals").insertOne({
            uid: hospitalAId,
            hospitalId: hospitalAId,
            hospitalName: "Metro Heart & Trauma Centre",
            latitude: 18.5300,
            longitude: 73.8500,
            address: "Shivajinagar, Pune",
            specialties: ["Cardiology", "Emergency Medicine", "Critical Care"],
            instruments: ["ventilator", "cath_lab_system", "icu_monitor"],
            capacity: {
                totalBeds: 80,
                availableBeds: 24,
                occupiedBeds: 50,
                reservedBeds: 6,
                icuBeds: 12,
                availableIcuBeds: 4,
                occupiedIcuBeds: 7,
                reservedIcuBeds: 1,
                operationTheatres: 3,
                availableOTs: 2,
                reservedOTs: 0,
                occupiedOTs: 1,
                onDutySpecialist: 2,
                emergencyAvailable: true,
                updatedAt: new Date(now.getTime() - 4 * 60 * 1000) // 4 mins ago (FRESH)
            }
        });

        // Hospital B: ICU Scarcity Disqualified (0 available ICU beds)
        await db.collection("hospitals").insertOne({
            uid: hospitalBId,
            hospitalId: hospitalBId,
            hospitalName: "Suburban General Hospital",
            latitude: 18.5200,
            longitude: 73.8600,
            address: "Camp Area, Pune",
            specialties: ["Cardiology", "General Medicine"],
            instruments: ["ventilator"],
            capacity: {
                totalBeds: 50,
                availableBeds: 10,
                occupiedBeds: 35,
                reservedBeds: 5,
                icuBeds: 6,
                availableIcuBeds: 0, // ZERO ICU BEDS AVAILABLE
                occupiedIcuBeds: 5,
                reservedIcuBeds: 1,
                operationTheatres: 1,
                availableOTs: 1,
                reservedOTs: 0,
                occupiedOTs: 0,
                onDutySpecialist: 1,
                emergencyAvailable: true,
                updatedAt: new Date(now.getTime() - 8 * 60 * 1000) // 8 mins ago (FRESH)
            }
        });

        // Hospital C: Stale Telemetry Hospital (> 90 mins old)
        await db.collection("hospitals").insertOne({
            uid: hospitalCId,
            hospitalId: hospitalCId,
            hospitalName: "Valley Specialty Hospital",
            latitude: 18.5600,
            longitude: 73.8200,
            address: "Aundh, Pune",
            specialties: ["Cardiology", "Neurology"],
            instruments: ["ventilator", "cath_lab_system"],
            capacity: {
                totalBeds: 40,
                availableBeds: 8,
                occupiedBeds: 30,
                reservedBeds: 2,
                icuBeds: 8,
                availableIcuBeds: 2,
                occupiedIcuBeds: 5,
                reservedIcuBeds: 1,
                operationTheatres: 2,
                availableOTs: 1,
                reservedOTs: 0,
                occupiedOTs: 1,
                onDutySpecialist: 1,
                emergencyAvailable: true,
                updatedAt: new Date(now.getTime() - 100 * 60 * 1000) // 100 mins ago (STALE)
            }
        });

        // Setup active emergency (status: TRANSPORTING) and ambulance
        await db.collection("emergencyRequests").insertOne({
            emergencyId,
            ambulanceId,
            emergencyType: "CARDIAC",
            condition: "cardiac",
            chiefComplaint: "Acute myocardial infarction with retrosternal chest pain",
            priority: "CRITICAL",
            requiredSpecialty: "Cardiology",
            requiredResources: ["ICU_BED", "CATH_LAB"],
            incidentLocation: {
                latitude: 18.5204,
                longitude: 73.8567,
                address: "Pune Railway Station Central, Pune",
                isSimulated: true
            },
            status: "TRANSPORTING",
            patientPickedUpAt: now,
            createdAt: now,
            updatedAt: now
        });

        await db.collection("ambulances").insertOne({
            ambulanceId,
            callSign: "Pune ALS 01",
            status: "TRANSPORTING",
            currentEmergencyId: emergencyId,
            currentLocation: { latitude: 18.5204, longitude: 73.8567 },
            updatedAt: now
        });

        assert(true, "Live operational hospital and emergency fixtures initialized in MongoDB");

        // -----------------------------------------------------------------------------
        // TEST GROUP 1: ALLOCATOR DETERMINES SUITABILITY & FRESHNESS
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 1: ALLOCATOR EVALUATION AGAINST LIVE MONGODB STATE ---");

        const allocationOutput = await allocateEmergencyHospital({
            emergencyId,
            condition: "cardiac",
            chiefComplaint: "Acute myocardial infarction with retrosternal chest pain",
            priority: "RED",
            requiredSpecialty: "Cardiology",
            requiredResources: ["ICU_BED", "CATH_LAB"],
            incidentLocation: { latitude: 18.5204, longitude: 73.8567 }
        });

        assert(allocationOutput.success === true, "Allocator successfully executed with live MongoDB data");
        assert(allocationOutput.totalCandidatesEvaluated >= 3, "Evaluated candidate hospitals from MongoDB");

        // Check Hospital A (Primary Recommended)
        const evalA = allocationOutput.results.find(r => r.hospitalId === hospitalAId);
        assert(evalA !== undefined, "Hospital A evaluated in candidates");
        assert(evalA?.suitability === true, "Hospital A marked as SUITABLE (ICU free, Specialty match, Equipment match)");
        assert(evalA?.freshnessStatus === "FRESH", "Hospital A data freshness classified as 'FRESH' (< 15 mins)");
        assert((evalA?.distanceKm ?? 0) > 0, "Hospital A distance computed deterministically");
        assert((evalA?.estimatedTravelMinutes ?? 0) > 0, "Hospital A travel ETA computed based on urban speed model");

        // -----------------------------------------------------------------------------
        // TEST GROUP 2: ICU SCARCITY DISQUALIFICATION
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 2: ICU SCARCITY DISQUALIFICATION ---");

        const evalB = allocationOutput.results.find(r => r.hospitalId === hospitalBId);
        assert(evalB !== undefined, "Hospital B evaluated in candidates");
        assert(evalB?.suitability === false, "Hospital B marked as UNSUITABLE due to 0 available ICU beds");
        const hasIcuReason = evalB?.reasons.some(r => r.toLowerCase().includes("icu"));
        assert(!!hasIcuReason, "Hospital B provides explicit rejection reason: 'No ICU beds currently available'");

        // -----------------------------------------------------------------------------
        // TEST GROUP 3: STALE HOSPITAL TELEMETRY PENALTY
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 3: STALE HOSPITAL DATA PENALTY ---");

        const evalC = allocationOutput.results.find(r => r.hospitalId === hospitalCId);
        assert(evalC !== undefined, "Hospital C evaluated in candidates");
        assert(evalC?.freshnessStatus === "STALE", "Hospital C correctly tagged as 'STALE' (> 60 mins age)");
        assert(evalC?.freshnessScore === 20, "Hospital C received stale penalty score (20/100)");

        // -----------------------------------------------------------------------------
        // TEST GROUP 4: NO SUITABLE HOSPITALS SCENARIO
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 4: NO CURRENTLY SUITABLE RECEIVING HOSPITAL SCENARIO ---");

        const impossibleOutput = await allocateEmergencyHospital({
            condition: "rare-trauma",
            chiefComplaint: "Extensive multi-organ trauma needing hyperbaric chamber",
            priority: "RED",
            requiredSpecialty: "Hyperbaric Specialized Surgery",
            incidentLocation: { latitude: 18.5204, longitude: 73.8567 }
        });

        assert(impossibleOutput.success === true, "Engine handles zero suitable matches gracefully with 200 OK");
        assert(impossibleOutput.suitableCount === 0, "suitableCount is strictly 0 when no facility qualifies");
        assert(impossibleOutput.results.every(r => !r.suitability), "All facilities have suitability: false with explicit reasons");

        // -----------------------------------------------------------------------------
        // TEST GROUP 5: AMBULANCE REQUESTS RESERVATION (ATOMIC TWO-WAY)
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 5: AMBULANCE REQUESTS RESERVATION (ATOMIC) ---");

        const hospBefore = await db.collection("hospitals").findOne({ uid: hospitalAId });
        const availIcuBefore = hospBefore?.capacity.availableIcuBeds;
        const resvIcuBefore = hospBefore?.capacity.reservedIcuBeds;

        const reserveResult = await reserveResource({
            hospitalId: hospitalAId,
            emergencyId,
            resourceType: "ICU_BED",
            quantity: 1,
            ttlMinutes: 30,
            allocatedBy: "AUTO_ALLOCATOR"
        }, db);

        assert(reserveResult.outcome === "SUCCESS", "Reservation successfully created in MongoDB");
        assert(reserveResult.reservationId !== undefined, "Assigned unique reservation ID");

        // Verify atomic decrement of available and increment of reserved
        const hospAfter = await db.collection("hospitals").findOne({ uid: hospitalAId });
        assert(hospAfter?.capacity.availableIcuBeds === availIcuBefore - 1, "Available ICU beds atomically decremented by 1");
        assert(hospAfter?.capacity.reservedIcuBeds === resvIcuBefore + 1, "Reserved ICU beds atomically incremented by 1");

        // Verify reservation record in database
        const savedResv = await db.collection("reservations").findOne({ reservationId: reserveResult.reservationId });
        assert(savedResv !== null, "Reservation persisted in 'reservations' collection");
        assert(savedResv?.status === "PENDING", "Initial reservation status is strictly 'PENDING'");
        assert(savedResv?.hospitalId === hospitalAId, "Reservation linked to target hospital");
        assert(savedResv?.emergencyId === emergencyId, "Reservation linked to active emergency");

        // Link reservation to emergencyRequest
        await db.collection("emergencyRequests").updateOne(
            { emergencyId },
            { $set: { reservationId: reserveResult.reservationId, allocatedHospitalId: hospitalAId } }
        );

        // -----------------------------------------------------------------------------
        // TEST GROUP 6: HOSPITAL EMERGENCY BOARD CONFIRMS RESERVATION
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 6: HOSPITAL CONFIRMS RESERVATION ---");

        const confirmResult = await confirmReservation({ reservationId: reserveResult.reservationId! }, db);
        assert(confirmResult.outcome === "SUCCESS", "Hospital operator confirms pending reservation");

        const confirmedResv = await db.collection("reservations").findOne({ reservationId: reserveResult.reservationId });
        assert(confirmedResv?.status === "CONFIRMED", "Reservation transitioned to 'CONFIRMED'");
        assert(confirmedResv?.confirmedAt instanceof Date, "confirmedAt timestamp recorded");

        // Update emergency and ambulance records on confirm
        await db.collection("emergencyRequests").updateOne(
            { emergencyId },
            { $set: { receivingHospitalId: hospitalAId, updatedAt: new Date() } }
        );
        await db.collection("ambulances").updateOne(
            { ambulanceId },
            { $set: { destinationHospitalId: hospitalAId, updatedAt: new Date() } }
        );

        const updatedEmg = await db.collection("emergencyRequests").findOne({ emergencyId });
        const updatedAmb = await db.collection("ambulances").findOne({ ambulanceId });
        assert(updatedEmg?.receivingHospitalId === hospitalAId, "Emergency record reflects confirmed receiving hospital");
        assert(updatedAmb?.destinationHospitalId === hospitalAId, "Ambulance record receives confirmed destination hospital");

        // -----------------------------------------------------------------------------
        // TEST GROUP 7: HOSPITAL REJECTION & CAPACITY RESTORATION
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 7: HOSPITAL REJECTION & CAPACITY RESTORATION ---");

        // Create temporary reservation to test rejection
        const tempResv = await reserveResource({
            hospitalId: hospitalAId,
            emergencyId: `TEMP-${testId}`,
            resourceType: "ICU_BED",
            quantity: 1,
            ttlMinutes: 30,
            allocatedBy: "AUTO_ALLOCATOR"
        }, db);

        const hospMid = await db.collection("hospitals").findOne({ uid: hospitalAId });
        const availBeforeReject = hospMid?.capacity.availableIcuBeds;

        const rejectResult = await rejectReservation({ reservationId: tempResv.reservationId! }, db);
        assert(rejectResult.outcome === "SUCCESS", "Hospital rejects reservation");

        const hospPostReject = await db.collection("hospitals").findOne({ uid: hospitalAId });
        assert(
            hospPostReject?.capacity.availableIcuBeds === availBeforeReject + 1,
            "Rejected reservation restores reserved capacity immediately to available pool"
        );

        // -----------------------------------------------------------------------------
        // TEST GROUP 8: SIMULTANEOUS RESERVATION CONFLICT (RACE CONDITION)
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 8: SIMULTANEOUS RESERVATION RACE CONDITION (CAS) ---");

        // Setup a single-bed scarce hospital
        const scarceHospitalId = `HOSP-SCARCE-${testId}`;
        await db.collection("hospitals").insertOne({
            uid: scarceHospitalId,
            hospitalId: scarceHospitalId,
            hospitalName: "Single Bed Clinic",
            capacity: {
                totalBeds: 10,
                availableBeds: 5,
                occupiedBeds: 5,
                reservedBeds: 0,
                icuBeds: 1,
                availableIcuBeds: 1, // EXACTLY 1 ICU BED LEFT
                occupiedIcuBeds: 0,
                reservedIcuBeds: 0,
                emergencyAvailable: true,
                updatedAt: new Date()
            }
        });

        // Fire two simultaneous reservation attempts for the same single bed
        const [resv1, resv2] = await Promise.all([
            reserveResource({
                hospitalId: scarceHospitalId,
                emergencyId: `RACE-1-${testId}`,
                resourceType: "ICU_BED",
                quantity: 1,
                ttlMinutes: 30,
                allocatedBy: "AUTO_ALLOCATOR"
            }, db),
            reserveResource({
                hospitalId: scarceHospitalId,
                emergencyId: `RACE-2-${testId}`,
                resourceType: "ICU_BED",
                quantity: 1,
                ttlMinutes: 30,
                allocatedBy: "AUTO_ALLOCATOR"
            }, db)
        ]);

        const outcomes = [resv1.outcome, resv2.outcome];
        const successCount = outcomes.filter(o => o === "SUCCESS").length;
        const conflictCount = outcomes.filter(o => o === "RESOURCE_UNAVAILABLE").length;

        assert(successCount === 1, "Exactly one concurrent reservation succeeds (CAS guard protected)");
        assert(conflictCount === 1, "Exactly one concurrent reservation rejected with RESOURCE_UNAVAILABLE (409 Conflict)");

        const finalScarce = await db.collection("hospitals").findOne({ uid: scarceHospitalId });
        assert(finalScarce?.capacity.availableIcuBeds === 0, "Available ICU capacity locked at exactly 0 (no overbooking)");
        assert(finalScarce?.capacity.reservedIcuBeds === 1, "Reserved ICU capacity is strictly 1");

        // Clean up scarce hospital
        await db.collection("hospitals").deleteOne({ uid: scarceHospitalId });
        await db.collection("reservations").deleteMany({ emergencyId: { $in: [`RACE-1-${testId}`, `RACE-2-${testId}`] } });

    } finally {
        // Cleanup test fixtures
        await db.collection("hospitals").deleteMany({ uid: { $in: [hospitalAId, hospitalBId, hospitalCId] } });
        await db.collection("emergencyRequests").deleteMany({ emergencyId: { $regex: testId } });
        await db.collection("ambulances").deleteMany({ ambulanceId: { $regex: testId } });
        await db.collection("reservations").deleteMany({ emergencyId: { $regex: testId } });
        await client.close();
    }

    console.log("\n=========================================================================");
    console.log(`PHASE 2 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error("Phase 2 test suite fatal error:", err);
    process.exit(1);
});
