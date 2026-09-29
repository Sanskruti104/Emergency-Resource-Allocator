import { MongoClient } from "mongodb";
import { POST as handleHandoffAction } from "../app/api/emergency/handoff/action/route";
import { POST as handleAmbulanceAction } from "../app/api/emergency/ambulance/action/route";
import { GET as getPatientEmergency } from "../app/api/emergency/request/route";
import { GET as getHospitalActiveState } from "../app/api/emergency/active/route";
import { GET as getAmbulanceRequests } from "../app/api/emergency/ambulance/requests/route";
import {
    reserveResource,
    confirmReservation
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

// Helpers to invoke API routes with Next.js Request
const callHandoffAction = async (body: any) => {
    const req = new Request("http://localhost:3000/api/emergency/handoff/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const res = await handleHandoffAction(req);
    const data = await res.json();
    return { status: res.status, data };
};

const callAmbulanceAction = async (body: any) => {
    const req = new Request("http://localhost:3000/api/emergency/ambulance/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const res = await handleAmbulanceAction(req);
    const data = await res.json();
    return { status: res.status, data };
};

const callPatientEmergency = async (emergencyId: string) => {
    const req = new Request(`http://localhost:3000/api/emergency/request?emergencyId=${encodeURIComponent(emergencyId)}`, {
        method: "GET"
    });
    const res = await getPatientEmergency(req);
    const data = await res.json();
    return { status: res.status, data };
};

const callHospitalActive = async (hospitalId: string) => {
    const req = new Request(`http://localhost:3000/api/emergency/active?hospitalId=${encodeURIComponent(hospitalId)}`, {
        method: "GET"
    });
    const res = await getHospitalActiveState(req);
    const data = await res.json();
    return { status: res.status, data };
};

const callAmbulanceRequests = async (ambulanceId: string) => {
    const req = new Request(`http://localhost:3000/api/emergency/ambulance/requests?ambulanceId=${encodeURIComponent(ambulanceId)}`, {
        method: "GET"
    });
    const res = await getAmbulanceRequests(req);
    const data = await res.json();
    return { status: res.status, data };
};

async function runPhase3BTestSuite() {
    console.log("=========================================================================");
    console.log("PHASE 3B INTEGRATION TEST SUITE: PATIENT HANDOFF, ADMISSION & CAPACITY");
    console.log("=========================================================================\n");

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    console.log(`Connected to MongoDB operational database: ${db.databaseName}\n`);

    const runId = `P3B-${Date.now().toString(36).toUpperCase()}`;
    const hospitalId1 = `HOSP-3B-${runId}`;
    const ambulanceId1 = `AMB-1-${runId}`;
    const emergencyId1 = `EMG-1-${runId}`;

    // For concurrency test
    const hospitalIdConcurrent = `HOSP-CONC-${runId}`;
    const ambulanceIdConc = `AMB-CONC-${runId}`;
    const emergencyIdConc = `EMG-CONC-${runId}`;

    try {
        const now = new Date();

        // -----------------------------------------------------------------------------
        // SETUP LIVE OPERATIONAL FIXTURES IN MONGODB
        // -----------------------------------------------------------------------------
        console.log("--- SETUP: SEEDING OPERATIONAL HOSPITAL, AMBULANCE & EMERGENCY FIXTURES ---");

        // Hospital 1: Total 10 ICU, Occupied 6, Reserved 1, Available 3
        await db.collection("hospitals").insertOne({
            uid: hospitalId1,
            hospitalId: hospitalId1,
            hospitalName: "Apex Emergency Medical Center",
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

        // Ambulance 1: Assigned to Emergency 1, status AT_HOSPITAL, transportStatus ARRIVED
        await db.collection("ambulances").insertOne({
            ambulanceId: ambulanceId1,
            callSign: "EMS-Unit-Alpha",
            vehicleType: "MICU",
            status: "AT_HOSPITAL",
            transportStatus: "ARRIVED",
            handoffStatus: null,
            currentLocation: {
                latitude: 18.5300,
                longitude: 73.8500,
                speedKmH: 0,
                updatedAt: now
            },
            currentEmergencyId: emergencyId1,
            destinationHospitalId: hospitalId1,
            ETA: 0,
            assignedCrew: {
                leadParamedic: "Paramedic Lead Rao",
                contactPhone: "+91-98765-11111"
            },
            createdAt: now,
            updatedAt: now
        });

        // Emergency 1: In ARRIVED state with confirmed destination
        await db.collection("emergencyRequests").insertOne({
            emergencyId: emergencyId1,
            ambulanceId: ambulanceId1,
            emergencyType: "CARDIAC",
            priority: "RED",
            incidentLocation: {
                latitude: 18.5204,
                longitude: 73.8567,
                address: "Station Road, Pune"
            },
            chiefComplaint: "Acute myocardial infarction with ongoing chest pain",
            condition: "cardiac",
            requiredSpecialty: "Cardiology",
            requiredResources: ["ICU_BED"],
            allocatedHospitalId: hospitalId1,
            receivingHospitalId: hospitalId1,
            receivingHospitalName: "Apex Emergency Medical Center",
            status: "ARRIVED",
            transportStatus: "ARRIVED",
            handoffStatus: null,
            patientPickedUpAt: new Date(now.getTime() - 20 * 60 * 1000),
            transportStartedAt: new Date(now.getTime() - 15 * 60 * 1000),
            arrivedHospitalAt: now,
            source: "EMS_SIMULATION",
            createdAt: now,
            updatedAt: now
        });

        // Seed Confirmed Reservation for Emergency 1
        const resv1 = await reserveResource({
            hospitalId: hospitalId1,
            emergencyId: emergencyId1,
            resourceType: "ICU_BED",
            quantity: 1,
            ttlMinutes: 30,
            allocatedBy: "MANUAL_DISPATCH"
        }, db);
        assert(resv1.outcome === "SUCCESS", "Setup: Reservation created in PENDING status");

        const confirmRes = await confirmReservation({ reservationId: resv1.reservationId! }, db);
        assert(confirmRes.outcome === "SUCCESS", "Setup: Reservation transitioned to CONFIRMED");

        await db.collection("emergencyRequests").updateOne(
            { emergencyId: emergencyId1 },
            { $set: { reservationId: resv1.reservationId } }
        );

        console.log("  ✓ Operational fixtures seeded successfully.\n");

        // -----------------------------------------------------------------------------
        // FLOW 1: END-TO-END ARRIVED → START HANDOFF → HANDOFF IN PROGRESS → COMPLETE HANDOFF → ADMITTED
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 1: ARRIVED → START HANDOFF → HANDOFF IN PROGRESS → COMPLETE HANDOFF → ADMITTED ---");

        // 1.1 Verify pre-conditions
        const preEmg1 = await db.collection("emergencyRequests").findOne({ emergencyId: emergencyId1 });
        const preAmb1 = await db.collection("ambulances").findOne({ ambulanceId: ambulanceId1 });
        const preHosp1 = await db.collection("hospitals").findOne({ uid: hospitalId1 });
        assert(preEmg1?.status === "ARRIVED", "1.1: Emergency status is ARRIVED");
        assert(preEmg1?.transportStatus === "ARRIVED", "1.1: Emergency transportStatus is ARRIVED");
        assert(preAmb1?.status === "AT_HOSPITAL", "1.1: Ambulance status is AT_HOSPITAL");
        assert(preHosp1?.capacity.reservedIcuBeds === 2, "1.1: Pre-capacity reservedIcuBeds is 2 (1 base + 1 newly reserved)");
        assert(preHosp1?.capacity.occupiedIcuBeds === 6, "1.1: Pre-capacity occupiedIcuBeds is 6");
        assert(preHosp1?.capacity.availableIcuBeds === 2, "1.1: Pre-capacity availableIcuBeds is 2 (3 base - 1 newly reserved)");

        // 1.2 START HANDOFF
        const startHandoffRes = await callHandoffAction({
            emergencyId: emergencyId1,
            action: "START_HANDOFF",
            hospitalId: hospitalId1,
            ambulanceId: ambulanceId1,
            reservationId: resv1.reservationId,
            notes: "Clinical report given to triage nurse. Vitals stable."
        });
        assert(startHandoffRes.status === 200, "1.2: START HANDOFF returns HTTP 200");
        assert(startHandoffRes.data.success === true, "1.2: START HANDOFF returns success: true");
        assert(startHandoffRes.data.handoffStatus === "IN_PROGRESS", "1.2: Response handoffStatus is IN_PROGRESS");

        // 1.3 Verify MongoDB state after START HANDOFF
        const postStartEmg = await db.collection("emergencyRequests").findOne({ emergencyId: emergencyId1 });
        const postStartAmb = await db.collection("ambulances").findOne({ ambulanceId: ambulanceId1 });
        const postStartHandoffDoc = await db.collection("handoffs").findOne({ emergencyId: emergencyId1 });
        assert(postStartEmg?.status === "ARRIVED", "1.3: Emergency status remains ARRIVED during handoff");
        assert(postStartEmg?.handoffStatus === "IN_PROGRESS", "1.3: emergencyRequests.handoffStatus is IN_PROGRESS");
        assert(postStartAmb?.status === "AT_HOSPITAL", "1.3: Ambulance status remains AT_HOSPITAL during handoff");
        assert(postStartAmb?.handoffStatus === "IN_PROGRESS", "1.3: Ambulance handoffStatus is IN_PROGRESS");
        assert(postStartHandoffDoc?.status === "IN_PROGRESS", "1.3: handoffs collection doc has status IN_PROGRESS");

        // 1.4 Verify Hospital Capacity is strictly UNCHANGED at START HANDOFF
        const postStartHosp = await db.collection("hospitals").findOne({ uid: hospitalId1 });
        assert(postStartHosp?.capacity.reservedIcuBeds === 2, "1.4: reservedIcuBeds UNCHANGED at START HANDOFF (equals 2)");
        assert(postStartHosp?.capacity.occupiedIcuBeds === 6, "1.4: occupiedIcuBeds UNCHANGED at START HANDOFF (equals 6)");
        assert(postStartHosp?.capacity.availableIcuBeds === 2, "1.4: availableIcuBeds UNCHANGED at START HANDOFF (equals 2)");

        // 1.5 COMPLETE HANDOFF / ADMISSION
        const completeHandoffRes = await callHandoffAction({
            emergencyId: emergencyId1,
            action: "COMPLETE_HANDOFF",
            hospitalId: hospitalId1,
            ambulanceId: ambulanceId1,
            reservationId: resv1.reservationId,
            notes: "Patient accepted into ICU Bay 3. Handover complete."
        });
        assert(completeHandoffRes.status === 200, "1.5: COMPLETE HANDOFF returns HTTP 200");
        assert(completeHandoffRes.data.success === true, "1.5: COMPLETE HANDOFF returns success: true");
        assert(completeHandoffRes.data.status === "ADMITTED", "1.5: Response status is ADMITTED");
        assert(completeHandoffRes.data.handoffStatus === "COMPLETED", "1.5: Response handoffStatus is COMPLETED");
        assert(completeHandoffRes.data.ambulanceReleased === true, "1.5: Response indicates ambulance released");

        // 1.6 Verify MongoDB state after COMPLETE HANDOFF
        const postAdmitEmg = await db.collection("emergencyRequests").findOne({ emergencyId: emergencyId1 });
        const postAdmitHandoff = await db.collection("handoffs").findOne({ emergencyId: emergencyId1 });
        const postAdmitResv = await db.collection("reservations").findOne({ reservationId: resv1.reservationId });
        assert(postAdmitEmg?.status === "ADMITTED", "1.6: emergencyRequests.status is ADMITTED");
        assert(postAdmitEmg?.handoffStatus === "COMPLETED", "1.6: emergencyRequests.handoffStatus is COMPLETED");
        assert(postAdmitEmg?.admittedAt != null, "1.6: emergencyRequests.admittedAt timestamp is recorded");
        assert(postAdmitHandoff?.status === "COMPLETED", "1.6: handoffs collection doc status is COMPLETED");
        assert(postAdmitResv?.status === "ADMITTED", "1.6: reservation status is ADMITTED");

        console.log("  ✓ Flow 1 ARRIVED → START HANDOFF → COMPLETE HANDOFF → ADMITTED verified.\n");

        // -----------------------------------------------------------------------------
        // FLOW 2: CRITICAL CAPACITY TRANSITION VERIFICATION
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 2: CRITICAL CAPACITY TRANSITION VERIFICATION ---");
        const postAdmitHosp = await db.collection("hospitals").findOne({ uid: hospitalId1 });
        const cap = postAdmitHosp?.capacity;

        console.log("  Live MongoDB Capacity Accounting:");
        console.log(`    BEFORE Admission: reserved = 2, occupied = 6, available = 2 (Total = 10)`);
        console.log(`    AFTER Admission:  reserved = ${cap.reservedIcuBeds}, occupied = ${cap.occupiedIcuBeds}, available = ${cap.availableIcuBeds} (Total = ${cap.icuBeds})`);

        assert(cap.reservedIcuBeds === 1, "Flow 2: reservedIcuBeds decremented by 1 (2 -> 1)");
        assert(cap.occupiedIcuBeds === 7, "Flow 2: occupiedIcuBeds incremented by 1 (6 -> 7)");
        assert(cap.availableIcuBeds === 2, "Flow 2: availableIcuBeds strictly UNCHANGED (equals 2)");
        assert(
            cap.icuBeds - cap.occupiedIcuBeds - cap.reservedIcuBeds === cap.availableIcuBeds,
            "Flow 2: Invariant preserved: total (10) - occupied (7) - reserved (1) == available (2)"
        );
        console.log("  ✓ Flow 2 capacity transition math verified.\n");

        // -----------------------------------------------------------------------------
        // FLOW 3: AMBULANCE RELEASE VERIFICATION
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 3: AMBULANCE RELEASE VERIFICATION ---");
        const postAdmitAmb = await db.collection("ambulances").findOne({ ambulanceId: ambulanceId1 });
        assert(postAdmitAmb?.status === "AVAILABLE", "Flow 3: Ambulance status is AVAILABLE");
        assert(postAdmitAmb?.transportStatus == null, "Flow 3: Ambulance transportStatus cleared to null");
        assert(postAdmitAmb?.handoffStatus == null, "Flow 3: Ambulance handoffStatus cleared to null");
        assert(postAdmitAmb?.currentEmergencyId == null, "Flow 3: Ambulance currentEmergencyId cleared to null");
        assert(postAdmitAmb?.destinationHospitalId == null, "Flow 3: Ambulance destinationHospitalId cleared to null");
        assert(postAdmitAmb?.ETA == null, "Flow 3: Ambulance ETA cleared to null");
        console.log("  ✓ Flow 3 ambulance released cleanly after admission.\n");

        // -----------------------------------------------------------------------------
        // FLOW 4: DUPLICATE START HANDOFF PROTECTION
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 4: DUPLICATE START HANDOFF PROTECTION ---");
        const emergencyId4 = `EMG-4-${runId}`;
        const ambulanceId4 = `AMB-4-${runId}`;

        // Seed fixtures for Flow 4
        await db.collection("emergencyRequests").insertOne({
            emergencyId: emergencyId4,
            ambulanceId: ambulanceId4,
            emergencyType: "TRAUMA",
            priority: "RED",
            allocatedHospitalId: hospitalId1,
            receivingHospitalId: hospitalId1,
            status: "ARRIVED",
            transportStatus: "ARRIVED",
            handoffStatus: null,
            createdAt: now
        });
        await db.collection("ambulances").insertOne({
            ambulanceId: ambulanceId4,
            callSign: "EMS-4",
            status: "AT_HOSPITAL",
            transportStatus: "ARRIVED",
            currentEmergencyId: emergencyId4,
            destinationHospitalId: hospitalId1,
            createdAt: now
        });
        const resv4 = await reserveResource({
            hospitalId: hospitalId1,
            emergencyId: emergencyId4,
            resourceType: "ICU_BED",
            quantity: 1,
            allocatedBy: "MANUAL_DISPATCH"
        }, db);
        await confirmReservation({ reservationId: resv4.reservationId! }, db);
        await db.collection("emergencyRequests").updateOne(
            { emergencyId: emergencyId4 },
            { $set: { reservationId: resv4.reservationId } }
        );

        // Attempt 1: Should succeed
        const start1 = await callHandoffAction({
            emergencyId: emergencyId4,
            action: "START_HANDOFF",
            hospitalId: hospitalId1,
            ambulanceId: ambulanceId4,
            reservationId: resv4.reservationId
        });
        assert(start1.status === 200, "Flow 4: First START HANDOFF succeeds with HTTP 200");

        // Attempt 2: Duplicate START HANDOFF must be safely rejected
        const start2 = await callHandoffAction({
            emergencyId: emergencyId4,
            action: "START_HANDOFF",
            hospitalId: hospitalId1,
            ambulanceId: ambulanceId4,
            reservationId: resv4.reservationId
        });
        assert(start2.status === 409, "Flow 4: Second START HANDOFF rejected with HTTP 409");
        assert(start2.data.outcome === "ALREADY_PROCESSED", "Flow 4: Outcome is ALREADY_PROCESSED");
        console.log("  ✓ Flow 4 duplicate START HANDOFF blocked.\n");

        // -----------------------------------------------------------------------------
        // FLOW 5: DUPLICATE COMPLETE HANDOFF PROTECTION
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 5: DUPLICATE COMPLETE HANDOFF PROTECTION ---");
        // Attempt 1: First complete handoff succeeds
        const complete1 = await callHandoffAction({
            emergencyId: emergencyId4,
            action: "COMPLETE_HANDOFF",
            hospitalId: hospitalId1,
            ambulanceId: ambulanceId4,
            reservationId: resv4.reservationId
        });
        assert(complete1.status === 200, "Flow 5: First COMPLETE HANDOFF succeeds with HTTP 200");

        // Attempt 2: Duplicate complete handoff must be safely rejected
        const complete2 = await callHandoffAction({
            emergencyId: emergencyId4,
            action: "COMPLETE_HANDOFF",
            hospitalId: hospitalId1,
            ambulanceId: ambulanceId4,
            reservationId: resv4.reservationId
        });
        assert(complete2.status === 409, "Flow 5: Second COMPLETE HANDOFF rejected with HTTP 409");
        assert(complete2.data.outcome === "ALREADY_PROCESSED", "Flow 5: Outcome is ALREADY_PROCESSED");
        console.log("  ✓ Flow 5 duplicate COMPLETE HANDOFF blocked.\n");

        // -----------------------------------------------------------------------------
        // FLOW 6: INVALID TRANSITIONS & BOUNDARY PROTECTION
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 6: INVALID TRANSITIONS & BOUNDARY PROTECTION ---");
        const emergencyId6 = `EMG-6-${runId}`;
        const ambulanceId6 = `AMB-6-${runId}`;

        // 6A: COMPLETE HANDOFF before START HANDOFF
        await db.collection("emergencyRequests").insertOne({
            emergencyId: emergencyId6,
            ambulanceId: ambulanceId6,
            emergencyType: "STROKE",
            status: "ARRIVED",
            transportStatus: "ARRIVED",
            handoffStatus: null, // NOT in progress
            allocatedHospitalId: hospitalId1,
            receivingHospitalId: hospitalId1,
            createdAt: now
        });
        await db.collection("ambulances").insertOne({
            ambulanceId: ambulanceId6,
            status: "AT_HOSPITAL",
            transportStatus: "ARRIVED",
            currentEmergencyId: emergencyId6,
            destinationHospitalId: hospitalId1,
            createdAt: now
        });
        const resv6 = await reserveResource({
            hospitalId: hospitalId1,
            emergencyId: emergencyId6,
            resourceType: "ICU_BED",
            quantity: 1,
            allocatedBy: "MANUAL_DISPATCH"
        }, db);
        await confirmReservation({ reservationId: resv6.reservationId! }, db);
        await db.collection("emergencyRequests").updateOne(
            { emergencyId: emergencyId6 },
            { $set: { reservationId: resv6.reservationId } }
        );

        const prematureComplete = await callHandoffAction({
            emergencyId: emergencyId6,
            action: "COMPLETE_HANDOFF",
            hospitalId: hospitalId1,
            reservationId: resv6.reservationId
        });
        assert(prematureComplete.status === 409, "6A: COMPLETE HANDOFF before START HANDOFF rejected with HTTP 409");
        assert(prematureComplete.data.outcome === "INVALID_TRANSITION", "6A: Outcome is INVALID_TRANSITION");

        // 6B: START HANDOFF before ARRIVED (still EN_ROUTE)
        const emergencyId6B = `EMG-6B-${runId}`;
        await db.collection("emergencyRequests").insertOne({
            emergencyId: emergencyId6B,
            status: "TRANSPORTING",
            transportStatus: "EN_ROUTE",
            handoffStatus: null,
            allocatedHospitalId: hospitalId1,
            receivingHospitalId: hospitalId1,
            createdAt: now
        });
        const resv6B = await reserveResource({
            hospitalId: hospitalId1,
            emergencyId: emergencyId6B,
            resourceType: "ICU_BED",
            quantity: 1,
            allocatedBy: "MANUAL_DISPATCH"
        }, db);
        await confirmReservation({ reservationId: resv6B.reservationId! }, db);
        await db.collection("emergencyRequests").updateOne(
            { emergencyId: emergencyId6B },
            { $set: { reservationId: resv6B.reservationId } }
        );

        const prematureStart = await callHandoffAction({
            emergencyId: emergencyId6B,
            action: "START_HANDOFF",
            hospitalId: hospitalId1,
            reservationId: resv6B.reservationId
        });
        assert(prematureStart.status === 409, "6B: START HANDOFF before ARRIVED rejected with HTTP 409");
        assert(prematureStart.data.outcome === "INVALID_TRANSITION", "6B: Outcome is INVALID_TRANSITION");

        // 6C: Wrong hospital attempting handoff
        const wrongHospitalAttempt = await callHandoffAction({
            emergencyId: emergencyId6,
            action: "START_HANDOFF",
            hospitalId: "WRONG-HOSPITAL-999",
            reservationId: resv6.reservationId
        });
        assert(wrongHospitalAttempt.status === 403, "6C: Wrong hospital rejected with HTTP 403");
        assert(wrongHospitalAttempt.data.outcome === "FORBIDDEN", "6C: Outcome is FORBIDDEN");

        // 6D: Wrong ambulance attempting handoff
        const wrongAmbulanceAttempt = await callHandoffAction({
            emergencyId: emergencyId6,
            action: "START_HANDOFF",
            hospitalId: hospitalId1,
            ambulanceId: "WRONG-AMBULANCE-999",
            reservationId: resv6.reservationId
        });
        assert(wrongAmbulanceAttempt.status === 403, "6D: Wrong ambulance rejected with HTTP 403");
        assert(wrongAmbulanceAttempt.data.outcome === "FORBIDDEN", "6D: Outcome is FORBIDDEN");

        // 6E: Admission failure must NOT release ambulance and must NOT corrupt capacity
        // Start handoff for emergency 6
        await callHandoffAction({
            emergencyId: emergencyId6,
            action: "START_HANDOFF",
            hospitalId: hospitalId1,
            ambulanceId: ambulanceId6,
            reservationId: resv6.reservationId
        });
        // Corrupt/expire reservation behind the scenes to simulate unexpected admission failure
        await db.collection("reservations").updateOne(
            { reservationId: resv6.reservationId },
            { $set: { status: "EXPIRED" } }
        );
        const hospitalBeforeFail = await db.collection("hospitals").findOne({ uid: hospitalId1 });

        const failedAdmission = await callHandoffAction({
            emergencyId: emergencyId6,
            action: "COMPLETE_HANDOFF",
            hospitalId: hospitalId1,
            ambulanceId: ambulanceId6,
            reservationId: resv6.reservationId
        });
        assert(failedAdmission.status === 409, "6E: Admission failure rejected with HTTP 409");

        const ambAfterFail = await db.collection("ambulances").findOne({ ambulanceId: ambulanceId6 });
        const hospitalAfterFail = await db.collection("hospitals").findOne({ uid: hospitalId1 });
        assert(ambAfterFail?.status !== "AVAILABLE", "6E: Admission failure did NOT release ambulance");
        assert(
            hospitalBeforeFail?.capacity.occupiedIcuBeds === hospitalAfterFail?.capacity.occupiedIcuBeds,
            "6E: Admission failure did NOT corrupt occupied capacity"
        );

        console.log("  ✓ Flow 6 edge-case and security protections verified.\n");

        // -----------------------------------------------------------------------------
        // FLOW 7: CAPACITY CONCURRENCY TEST (RACE TEST)
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 7: CAPACITY CONCURRENCY RACE TEST ---");
        // Dedicated test hospital: Total 15 ICU, Occupied 10, Reserved 1, Available 4
        await db.collection("hospitals").insertOne({
            uid: hospitalIdConcurrent,
            hospitalId: hospitalIdConcurrent,
            hospitalName: "Metropolitan Trauma Hospital (Concurrency Node)",
            latitude: 18.5200,
            longitude: 73.8500,
            specialties: ["Cardiology", "Trauma Surgery"],
            capacity: {
                totalBeds: 50,
                availableBeds: 20,
                occupiedBeds: 25,
                reservedBeds: 5,
                icuBeds: 15,
                availableIcuBeds: 4,
                occupiedIcuBeds: 10,
                reservedIcuBeds: 1, // Controlled reserved resource = 1
                updatedAt: now
            }
        });

        // Seed Ambulance & Emergency
        await db.collection("ambulances").insertOne({
            ambulanceId: ambulanceIdConc,
            callSign: "EMS-CONC-UNIT",
            status: "AT_HOSPITAL",
            transportStatus: "ARRIVED",
            handoffStatus: "IN_PROGRESS",
            currentEmergencyId: emergencyIdConc,
            destinationHospitalId: hospitalIdConcurrent,
            createdAt: now
        });

        await db.collection("emergencyRequests").insertOne({
            emergencyId: emergencyIdConc,
            ambulanceId: ambulanceIdConc,
            emergencyType: "CARDIAC",
            status: "ARRIVED",
            transportStatus: "ARRIVED",
            handoffStatus: "IN_PROGRESS",
            allocatedHospitalId: hospitalIdConcurrent,
            receivingHospitalId: hospitalIdConcurrent,
            createdAt: now
        });

        // Create 1 Confirmed Reservation
        const resvConc = await reserveResource({
            hospitalId: hospitalIdConcurrent,
            emergencyId: emergencyIdConc,
            resourceType: "ICU_BED",
            quantity: 1,
            allocatedBy: "MANUAL_DISPATCH"
        }, db);
        await confirmReservation({ reservationId: resvConc.reservationId! }, db);
        await db.collection("emergencyRequests").updateOne(
            { emergencyId: emergencyIdConc },
            { $set: { reservationId: resvConc.reservationId } }
        );

        // Pre-race hospital snapshot
        const preRaceHosp = await db.collection("hospitals").findOne({ uid: hospitalIdConcurrent });
        const initialReserved = preRaceHosp?.capacity.reservedIcuBeds; // 2 (1 base + 1 created)
        const initialOccupied = preRaceHosp?.capacity.occupiedIcuBeds; // 10
        const initialAvailable = preRaceHosp?.capacity.availableIcuBeds; // 3

        console.log(`  Pre-race Capacity: reserved = ${initialReserved}, occupied = ${initialOccupied}, available = ${initialAvailable}`);

        // Fire 2 concurrent COMPLETE HANDOFF requests at identical instant
        const [concRes1, concRes2] = await Promise.all([
            callHandoffAction({
                emergencyId: emergencyIdConc,
                action: "COMPLETE_HANDOFF",
                hospitalId: hospitalIdConcurrent,
                ambulanceId: ambulanceIdConc,
                reservationId: resvConc.reservationId
            }),
            callHandoffAction({
                emergencyId: emergencyIdConc,
                action: "COMPLETE_HANDOFF",
                hospitalId: hospitalIdConcurrent,
                ambulanceId: ambulanceIdConc,
                reservationId: resvConc.reservationId
            })
        ]);

        const statuses = [concRes1.status, concRes2.status];
        const successCount = statuses.filter(s => s === 200).length;
        const conflictCount = statuses.filter(s => s === 409).length;

        assert(successCount === 1, `Flow 7: Exactly 1 concurrent request succeeded (successCount: ${successCount})`);
        assert(conflictCount === 1, `Flow 7: Exactly 1 concurrent request was rejected (conflictCount: ${conflictCount})`);

        // Post-race hospital state verification
        const postRaceHosp = await db.collection("hospitals").findOne({ uid: hospitalIdConcurrent });
        const finalReserved = postRaceHosp?.capacity.reservedIcuBeds;
        const finalOccupied = postRaceHosp?.capacity.occupiedIcuBeds;
        const finalAvailable = postRaceHosp?.capacity.availableIcuBeds;

        console.log(`  Post-race Capacity: reserved = ${finalReserved}, occupied = ${finalOccupied}, available = ${finalAvailable}`);

        assert(finalReserved === initialReserved - 1, `Flow 7: Reserved decremented exactly once (${initialReserved} -> ${finalReserved})`);
        assert(finalOccupied === initialOccupied + 1, `Flow 7: Occupied incremented exactly once (${initialOccupied} -> ${finalOccupied})`);
        assert(finalAvailable === initialAvailable, `Flow 7: Available preserved unchanged (${initialAvailable} -> ${finalAvailable})`);
        console.log("  ✓ Flow 7 concurrency race safety verified against live Atlas.\n");

        // -----------------------------------------------------------------------------
        // FLOW 8: HOSPITAL AUDIT EVENTS VERIFICATION
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 8: HOSPITAL AUDIT EVENTS VERIFICATION ---");
        const auditEvents = await db.collection("hospitalEvents")
            .find({ emergencyId: emergencyId1 })
            .toArray();

        const hasHandoffStarted = auditEvents.some(e => e.eventType === "HANDOFF_STARTED");
        const hasHandoffCompleted = auditEvents.some(e => e.eventType === "HANDOFF_COMPLETED");
        const hasPatientAdmitted = auditEvents.some(e => e.eventType === "PATIENT_ADMITTED");

        assert(hasHandoffStarted, "Flow 8: HANDOFF_STARTED event recorded in hospitalEvents");
        assert(hasHandoffCompleted, "Flow 8: HANDOFF_COMPLETED event recorded in hospitalEvents");
        assert(hasPatientAdmitted, "Flow 8: PATIENT_ADMITTED event recorded in hospitalEvents");

        // Verify audit event structure
        const sampleEvent = auditEvents.find(e => e.eventType === "HANDOFF_COMPLETED");
        assert(sampleEvent?.hospitalId === hospitalId1, "Flow 8: Audit event contains correct hospitalId");
        assert(sampleEvent?.reservationId === resv1.reservationId, "Flow 8: Audit event contains correct reservationId");
        assert(sampleEvent?.timestamp != null, "Flow 8: Audit event contains timestamp");
        console.log("  ✓ Flow 8 audit trail verified.\n");

        // -----------------------------------------------------------------------------
        // FLOW 9: CROSS-PANEL STATE SYNCHRONIZATION
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 9: CROSS-PANEL STATE SYNCHRONIZATION ---");
        // Patient Panel API
        const patientView = await callPatientEmergency(emergencyId1);
        assert(patientView.status === 200, "Flow 9: Patient view endpoint returns 200");
        assert(patientView.data.emergency?.status === "ADMITTED", "Flow 9: Patient view reflects ADMITTED");
        assert(patientView.data.emergency?.handoffStatus === "COMPLETED", "Flow 9: Patient view reflects COMPLETED handoff");

        // Hospital Panel API
        const hospitalView = await callHospitalActive(hospitalId1);
        assert(hospitalView.status === 200, "Flow 9: Hospital active endpoint returns 200");

        // Ambulance Panel API
        const ambulanceView = await callAmbulanceRequests(ambulanceId1);
        assert(ambulanceView.status === 200, "Flow 9: Ambulance view endpoint returns 200");
        assert(ambulanceView.data.activeEmergency == null, "Flow 9: Ambulance active mission cleared upon admission");
        console.log("  ✓ Flow 9 UI/API state synchronization verified.\n");

        // -----------------------------------------------------------------------------
        // FLOW 10: REGRESSION OF FULL LIFECYCLE
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 10: FULL END-TO-END LIFECYCLE REGRESSION ---");
        const regEmgId = `EMG-REG-${runId}`;
        const regAmbId = `AMB-REG-${runId}`;

        // 1. Seed dedicated hospital, emergency & ambulance
        const hospitalIdReg = `HOSP-REG-${runId}`;
        await db.collection("hospitals").insertOne({
            uid: hospitalIdReg,
            hospitalId: hospitalIdReg,
            hospitalName: "Lifeline Specialty Hospital (Regression Node)",
            latitude: 18.5250,
            longitude: 73.8550,
            specialties: ["Cardiology", "Trauma", "Critical Care"],
            capacity: {
                totalBeds: 50,
                availableBeds: 25,
                occupiedBeds: 20,
                reservedBeds: 5,
                icuBeds: 20,
                availableIcuBeds: 10,
                occupiedIcuBeds: 8,
                reservedIcuBeds: 2,
                updatedAt: now
            }
        });

        await db.collection("emergencyRequests").insertOne({
            emergencyId: regEmgId,
            ambulanceId: regAmbId,
            emergencyType: "CARDIAC",
            priority: "RED",
            allocatedHospitalId: hospitalIdReg,
            receivingHospitalId: hospitalIdReg,
            status: "TRANSPORTING",
            transportStatus: null,
            createdAt: now
        });
        await db.collection("ambulances").insertOne({
            ambulanceId: regAmbId,
            callSign: "EMS-REG",
            status: "TRANSPORTING",
            transportStatus: null,
            currentEmergencyId: regEmgId,
            destinationHospitalId: hospitalIdReg,
            createdAt: now
        });

        // 2. Reserve & Confirm
        const regResv = await reserveResource({
            hospitalId: hospitalIdReg,
            emergencyId: regEmgId,
            resourceType: "ICU_BED",
            quantity: 1,
            allocatedBy: "MANUAL_DISPATCH"
        }, db);
        assert(regResv.outcome === "SUCCESS", "Flow 10: Setup reservation created in PENDING status");
        const confirmRegRes = await confirmReservation({ reservationId: regResv.reservationId! }, db);
        assert(confirmRegRes.outcome === "SUCCESS", "Flow 10: Setup reservation confirmed");
        await db.collection("emergencyRequests").updateOne(
            { emergencyId: regEmgId },
            { $set: { reservationId: regResv.reservationId } }
        );

        // 3. Start Transport
        const tStart = await callAmbulanceAction({
            emergencyId: regEmgId,
            ambulanceId: regAmbId,
            action: "START_TRANSPORT"
        });
        assert(tStart.status === 200 && tStart.data.transportStatus === "EN_ROUTE", "Flow 10: Transport started (EN_ROUTE)");

        // 4. Arrive at Hospital
        const tArrive = await callAmbulanceAction({
            emergencyId: regEmgId,
            ambulanceId: regAmbId,
            action: "ARRIVED_HOSPITAL"
        });
        assert(tArrive.status === 200 && tArrive.data.transportStatus === "ARRIVED", "Flow 10: Arrived at hospital (ARRIVED)");

        // 5. Start Handoff
        const hStart = await callHandoffAction({
            emergencyId: regEmgId,
            action: "START_HANDOFF",
            hospitalId: hospitalIdReg,
            ambulanceId: regAmbId,
            reservationId: regResv.reservationId
        });
        assert(hStart.status === 200 && hStart.data.handoffStatus === "IN_PROGRESS", "Flow 10: Handoff started (IN_PROGRESS)");

        // 6. Complete Handoff & Admit
        const hComplete = await callHandoffAction({
            emergencyId: regEmgId,
            action: "COMPLETE_HANDOFF",
            hospitalId: hospitalIdReg,
            ambulanceId: regAmbId,
            reservationId: regResv.reservationId
        });
        assert(hComplete.status === 200 && hComplete.data.status === "ADMITTED", "Flow 10: Patient admitted (ADMITTED)");

        // 7. Verify final states
        const regFinalEmg = await db.collection("emergencyRequests").findOne({ emergencyId: regEmgId });
        const regFinalAmb = await db.collection("ambulances").findOne({ ambulanceId: regAmbId });
        const regFinalResv = await db.collection("reservations").findOne({ reservationId: regResv.reservationId });

        assert(regFinalEmg?.status === "ADMITTED", "Flow 10: Final emergency status is ADMITTED");
        assert(regFinalAmb?.status === "AVAILABLE", "Flow 10: Final ambulance status is AVAILABLE");
        assert(regFinalResv?.status === "ADMITTED", "Flow 10: Final reservation status is ADMITTED");
        console.log("  ✓ Flow 10 full lifecycle regression verified.\n");

    } finally {
        // Cleanup test fixtures
        console.log("--- CLEANUP: REMOVING RUN FIXTURES ---");
        await db.collection("hospitals").deleteMany({ uid: { $regex: runId } });
        await db.collection("ambulances").deleteMany({ ambulanceId: { $regex: runId } });
        await db.collection("emergencyRequests").deleteMany({ emergencyId: { $regex: runId } });
        await db.collection("reservations").deleteMany({ emergencyId: { $regex: runId } });
        await db.collection("handoffs").deleteMany({ emergencyId: { $regex: runId } });
        await db.collection("hospitalEvents").deleteMany({ emergencyId: { $regex: runId } });
        console.log("  ✓ Test fixtures cleaned up from operational database.\n");

        await client.close();
    }

    console.log("=========================================================================");
    console.log(`TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=========================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runPhase3BTestSuite().catch(err => {
    console.error("Test suite fatal error:", err);
    process.exit(1);
});
