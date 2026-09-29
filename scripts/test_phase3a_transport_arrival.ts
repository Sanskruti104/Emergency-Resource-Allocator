import { MongoClient } from "mongodb";
import { POST as handleAmbulanceAction } from "../app/api/emergency/ambulance/action/route";
import { GET as getAmbulanceRequests } from "../app/api/emergency/ambulance/requests/route";
import { GET as getPatientEmergency } from "../app/api/emergency/request/route";
import { GET as getHospitalActiveState } from "../app/api/emergency/active/route";
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

async function runPhase3ATestSuite() {
    console.log("=========================================================================");
    console.log("PHASE 3A INTEGRATION TEST SUITE: AMBULANCE TRANSPORT & HOSPITAL ARRIVAL");
    console.log("=========================================================================\n");

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    console.log(`Connected to MongoDB operational database: ${db.databaseName}\n`);

    const runId = `P3A-${Date.now().toString(36).toUpperCase()}`;
    const hospitalId = `HOSP-3A-${runId}`;
    const ambulanceId1 = `AMB-1-${runId}`;
    const ambulanceId2 = `AMB-2-${runId}`;
    const emergencyId1 = `EMG-1-${runId}`;
    const emergencyId2 = `EMG-2-${runId}`;

    try {
        const now = new Date();

        // -----------------------------------------------------------------------------
        // SETUP LIVE OPERATIONAL FIXTURES IN MONGODB
        // -----------------------------------------------------------------------------
        console.log("--- SETUP: SEEDING OPERATIONAL HOSPITAL & AMBULANCE FIXTURES ---");

        // Hospital: Metro Trauma Care (Total 10 ICU, Occupied 6, Reserved 1, Available 3)
        await db.collection("hospitals").insertOne({
            uid: hospitalId,
            hospitalId: hospitalId,
            hospitalName: "Metro Trauma Care & Research Center",
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

        // Seed Ambulance 1 (Assigned to emergency 1)
        await db.collection("ambulances").insertOne({
            ambulanceId: ambulanceId1,
            callSign: "EMS-Alpha-1",
            vehicleType: "MICU",
            status: "TRANSPORTING",
            currentLocation: {
                latitude: 18.5204,
                longitude: 73.8567,
                speedKmH: 0,
                updatedAt: now
            },
            currentEmergencyId: emergencyId1,
            destinationHospitalId: hospitalId,
            ETA: 15,
            assignedCrew: {
                leadParamedic: "Dr. Aryan Sharma (ALS Lead)",
                contactPhone: "+91-98765-43210"
            },
            createdAt: now,
            updatedAt: now
        });

        // Seed Ambulance 2 (Unassigned unit for invalid attempt tests)
        await db.collection("ambulances").insertOne({
            ambulanceId: ambulanceId2,
            callSign: "EMS-Beta-2",
            vehicleType: "ALS",
            status: "AVAILABLE",
            currentLocation: {
                latitude: 18.5100,
                longitude: 73.8400,
                speedKmH: 0,
                updatedAt: now
            },
            currentEmergencyId: null,
            destinationHospitalId: null,
            ETA: null,
            createdAt: now,
            updatedAt: now
        });

        // Seed Emergency 1 (Patient picked up, reservation confirmed at hospital)
        await db.collection("emergencyRequests").insertOne({
            emergencyId: emergencyId1,
            ambulanceId: ambulanceId1,
            emergencyType: "CARDIAC",
            priority: "RED",
            incidentLocation: {
                latitude: 18.5204,
                longitude: 73.8567,
                address: "Pune Railway Station Area, Pune"
            },
            chiefComplaint: "Acute STEMI with hemodynamic instability",
            condition: "cardiac",
            requiredSpecialty: "Cardiology",
            requiredResources: ["ICU_BED"],
            allocatedHospitalId: hospitalId,
            receivingHospitalId: hospitalId,
            status: "TRANSPORTING",
            patientPickedUpAt: now,
            transportStatus: null,
            source: "EMS_SIMULATION",
            createdAt: now,
            updatedAt: now
        });

        // Seed Confirmed Reservation for Emergency 1
        const reservation1 = await reserveResource({
            hospitalId,
            emergencyId: emergencyId1,
            resourceType: "ICU_BED",
            quantity: 1,
            ttlMinutes: 30,
            allocatedBy: "MANUAL_DISPATCH"
        }, db);

        assert(reservation1.outcome === "SUCCESS", "Setup: Reservation created in PENDING status");

        const confirmRes = await confirmReservation({ reservationId: reservation1.reservationId! }, db);
        assert(confirmRes.outcome === "SUCCESS", "Setup: Reservation transitioned to CONFIRMED");

        await db.collection("emergencyRequests").updateOne(
            { emergencyId: emergencyId1 },
            { $set: { reservationId: reservation1.reservationId } }
        );

        console.log("  ✓ Operational fixtures seeded successfully.\n");

        // Helper to invoke POST /api/emergency/ambulance/action
        const callActionApi = async (body: any) => {
            const req = new Request("http://localhost:3000/api/emergency/ambulance/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const res = await handleAmbulanceAction(req);
            const data = await res.json();
            return { status: res.status, data };
        };

        // -----------------------------------------------------------------------------
        // FLOW 1: END-TO-END TRANSPORT & ARRIVAL FLOW
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 1: END-TO-END CONFIRMED → START TRANSPORT → EN_ROUTE → ARRIVED ---");

        // Step 1: Pre-condition verification
        const preEmergency = await db.collection("emergencyRequests").findOne({ emergencyId: emergencyId1 });
        const preReservation = await db.collection("reservations").findOne({ reservationId: reservation1.reservationId });
        assert(preReservation?.status === "CONFIRMED", "Step 1: Reservation status is CONFIRMED in MongoDB");
        assert(preEmergency?.receivingHospitalId === hospitalId, "Step 1: Destination hospital ID is established");
        assert(preEmergency?.transportStatus == null, "Step 1: Ambulance is stationary (transportStatus is null)");

        // Step 2: START TRANSPORT action
        const startRes = await callActionApi({
            emergencyId: emergencyId1,
            ambulanceId: ambulanceId1,
            action: "START_TRANSPORT"
        });
        assert(startRes.status === 200, "Step 2: START TRANSPORT returns HTTP 200");
        assert(startRes.data.success === true, "Step 2: START TRANSPORT returns success: true");
        assert(startRes.data.transportStatus === "EN_ROUTE", "Step 2: Response returns transportStatus: 'EN_ROUTE'");

        // Step 3: Verify MongoDB state after START TRANSPORT
        const postStartEmergency = await db.collection("emergencyRequests").findOne({ emergencyId: emergencyId1 });
        const postStartAmbulance = await db.collection("ambulances").findOne({ ambulanceId: ambulanceId1 });
        assert(postStartEmergency?.transportStatus === "EN_ROUTE", "Step 3: emergencyRequests.transportStatus is 'EN_ROUTE'");
        assert(postStartEmergency?.status === "TRANSPORTING", "Step 3: emergencyRequests.status is 'TRANSPORTING'");
        assert(postStartEmergency?.transportStartedAt != null, "Step 3: transportStartedAt timestamp is recorded");
        assert(postStartAmbulance?.transportStatus === "EN_ROUTE", "Step 3: ambulances.transportStatus is 'EN_ROUTE'");
        assert(postStartAmbulance?.status === "TRANSPORTING", "Step 3: ambulances.status is 'TRANSPORTING'");

        // Step 4: ARRIVED AT HOSPITAL action
        const arriveRes = await callActionApi({
            emergencyId: emergencyId1,
            ambulanceId: ambulanceId1,
            action: "ARRIVED_HOSPITAL"
        });
        assert(arriveRes.status === 200, "Step 4: ARRIVED_HOSPITAL returns HTTP 200");
        assert(arriveRes.data.success === true, "Step 4: ARRIVED_HOSPITAL returns success: true");
        assert(arriveRes.data.transportStatus === "ARRIVED", "Step 4: Response returns transportStatus: 'ARRIVED'");

        // Step 5: Verify MongoDB state after ARRIVED
        const postArriveEmergency = await db.collection("emergencyRequests").findOne({ emergencyId: emergencyId1 });
        const postArriveAmbulance = await db.collection("ambulances").findOne({ ambulanceId: ambulanceId1 });
        assert(postArriveEmergency?.transportStatus === "ARRIVED", "Step 5: emergencyRequests.transportStatus is 'ARRIVED'");
        assert(postArriveEmergency?.status === "ARRIVED", "Step 5: emergencyRequests.status is 'ARRIVED'");
        assert(postArriveEmergency?.arrivedHospitalAt != null, "Step 5: arrivedHospitalAt timestamp is recorded");
        assert(postArriveAmbulance?.transportStatus === "ARRIVED", "Step 5: ambulances.transportStatus is 'ARRIVED'");
        assert(postArriveAmbulance?.status === "AT_HOSPITAL", "Step 5: ambulances.status is 'AT_HOSPITAL'");

        console.log("  ✓ End-to-end transport and arrival flow verified against live MongoDB!\n");

        // -----------------------------------------------------------------------------
        // FLOW 2 & 3: CONCURRENCY & IDEMPOTENCY PROTECTION
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 2 & 3: DUPLICATE TRANSITION PROTECTION ---");

        // Flow 2: Attempting START TRANSPORT when already processed / arrived
        const dupStartRes = await callActionApi({
            emergencyId: emergencyId1,
            ambulanceId: ambulanceId1,
            action: "START_TRANSPORT"
        });
        assert(dupStartRes.status === 409, "Flow 2: Second START TRANSPORT blocked with HTTP 409");
        assert(dupStartRes.data.success === false, "Flow 2: Second START TRANSPORT returns success: false");

        // Flow 3: Attempting ARRIVED_HOSPITAL when already arrived
        const dupArriveRes = await callActionApi({
            emergencyId: emergencyId1,
            ambulanceId: ambulanceId1,
            action: "ARRIVED_HOSPITAL"
        });
        assert(dupArriveRes.status === 409, "Flow 3: Second ARRIVED_HOSPITAL blocked with HTTP 409");
        assert(dupArriveRes.data.outcome === "ALREADY_PROCESSED" || dupArriveRes.data.outcome === "INVALID_TRANSITION",
            "Flow 3: Outcome is ALREADY_PROCESSED or INVALID_TRANSITION");

        console.log("  ✓ Duplicate START TRANSPORT and ARRIVED protections verified!\n");

        // -----------------------------------------------------------------------------
        // FLOW 4: INVALID TRANSITION GUARDS
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 4: INVALID TRANSITION GUARDS ---");

        // Setup Emergency 2 with PENDING reservation (unconfirmed)
        await db.collection("emergencyRequests").insertOne({
            emergencyId: emergencyId2,
            ambulanceId: ambulanceId2,
            emergencyType: "TRAUMA",
            priority: "RED",
            incidentLocation: { latitude: 18.5200, longitude: 73.8500 },
            chiefComplaint: "Multi-system trauma from MVC",
            condition: "trauma",
            requiredSpecialty: "Trauma Care",
            requiredResources: ["ICU_BED"],
            allocatedHospitalId: hospitalId,
            receivingHospitalId: null,
            status: "TRANSPORTING",
            transportStatus: null,
            source: "EMS_SIMULATION",
            createdAt: now,
            updatedAt: now
        });

        // 4a. Attempt ARRIVED_HOSPITAL before START_TRANSPORT (must be EN_ROUTE)
        const arrivedPrematureRes = await callActionApi({
            emergencyId: emergencyId2,
            ambulanceId: ambulanceId2,
            action: "ARRIVED_HOSPITAL"
        });
        assert(arrivedPrematureRes.status === 409, "4a: ARRIVED before START_TRANSPORT rejected with HTTP 409");
        assert(arrivedPrematureRes.data.outcome === "INVALID_TRANSITION", "4a: Outcome is INVALID_TRANSITION");

        // 4b. Attempt START_TRANSPORT without CONFIRMED reservation
        const startUnconfirmedRes = await callActionApi({
            emergencyId: emergencyId2,
            ambulanceId: ambulanceId2,
            action: "START_TRANSPORT"
        });
        assert(startUnconfirmedRes.status === 409, "4b: START_TRANSPORT without CONFIRMED reservation rejected with HTTP 409");
        assert(startUnconfirmedRes.data.outcome === "INVALID_TRANSITION", "4b: Outcome is INVALID_TRANSITION");

        // 4c. Wrong ambulance attempting action on Emergency 1
        const wrongAmbulanceRes = await callActionApi({
            emergencyId: emergencyId1,
            ambulanceId: ambulanceId2,
            action: "START_TRANSPORT"
        });
        assert(wrongAmbulanceRes.status === 403, "4c: Wrong ambulance attempting action rejected with HTTP 403 Forbidden");

        // 4d. Non-existent emergency
        const missingEmergencyRes = await callActionApi({
            emergencyId: "EMG-DOES-NOT-EXIST",
            ambulanceId: ambulanceId1,
            action: "START_TRANSPORT"
        });
        assert(missingEmergencyRes.status === 404, "4d: Non-existent emergency rejected with HTTP 404 Not Found");

        console.log("  ✓ All invalid transition guards verified!\n");

        // -----------------------------------------------------------------------------
        // FLOW 5: CAPACITY INVARIANT UNCHANGED THROUGHOUT PHASE 3A
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 5: CAPACITY INVARIANT VERIFICATION ---");

        const hospitalDoc = await db.collection("hospitals").findOne({ uid: hospitalId });
        const cap = hospitalDoc?.capacity;

        // Invariant: total = available + occupied + reserved
        const totalIcu = cap?.icuBeds ?? 10;
        const availableIcu = cap?.availableIcuBeds;
        const occupiedIcu = cap?.occupiedIcuBeds;
        const reservedIcu = cap?.reservedIcuBeds;

        assert(reservedIcu === 2, "Flow 5: reservedIcuBeds remains 2 (1 existing + 1 from reservation1)");
        assert(occupiedIcu === 6, "Flow 5: occupiedIcuBeds strictly UNCHANGED at 6 (NO transfer to occupied)");
        assert(availableIcu === 2, "Flow 5: availableIcuBeds strictly UNCHANGED at 2");
        assert(availableIcu + occupiedIcu + reservedIcu === totalIcu,
            `Flow 5: Invariant strictly holds: available (${availableIcu}) + occupied (${occupiedIcu}) + reserved (${reservedIcu}) === total (${totalIcu})`);

        // Verify reservation itself is still CONFIRMED (protecting the resource)
        const finalReservation = await db.collection("reservations").findOne({ reservationId: reservation1.reservationId });
        assert(finalReservation?.status === "CONFIRMED", "Flow 5: Reservation status remains CONFIRMED (protecting resource)");

        console.log("  ✓ Capacity invariant strictly preserved throughout Phase 3A!\n");

        // -----------------------------------------------------------------------------
        // FLOW 6: AUDIT EVENTS LOGGED IN hospitalEvents
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 6: AUDIT EVENT VERIFICATION ---");

        const enRouteEvent = await db.collection("hospitalEvents").findOne({
            emergencyId: emergencyId1,
            eventType: "AMBULANCE_EN_ROUTE"
        });
        assert(enRouteEvent != null, "Flow 6: Audit event 'AMBULANCE_EN_ROUTE' exists in hospitalEvents");
        assert(enRouteEvent?.hospitalId === hospitalId, "Flow 6: 'AMBULANCE_EN_ROUTE' has real receiving hospitalId");
        assert(enRouteEvent?.actorId === ambulanceId1, "Flow 6: 'AMBULANCE_EN_ROUTE' has real ambulanceId");
        assert(enRouteEvent?.reservationId === reservation1.reservationId, "Flow 6: 'AMBULANCE_EN_ROUTE' references reservationId");

        const arrivedEvent = await db.collection("hospitalEvents").findOne({
            emergencyId: emergencyId1,
            eventType: "AMBULANCE_ARRIVED"
        });
        assert(arrivedEvent != null, "Flow 6: Audit event 'AMBULANCE_ARRIVED' exists in hospitalEvents");
        assert(arrivedEvent?.hospitalId === hospitalId, "Flow 6: 'AMBULANCE_ARRIVED' has real receiving hospitalId");
        assert(arrivedEvent?.actorId === ambulanceId1, "Flow 6: 'AMBULANCE_ARRIVED' has real ambulanceId");
        assert(arrivedEvent?.reservationId === reservation1.reservationId, "Flow 6: 'AMBULANCE_ARRIVED' references reservationId");

        console.log("  ✓ Audit events verified with real operational IDs!\n");

        // -----------------------------------------------------------------------------
        // FLOW 7: AMBULANCE, HOSPITAL, PATIENT SYNCHRONIZATION
        // -----------------------------------------------------------------------------
        console.log("--- FLOW 7: CROSS-PANEL SYNCHRONIZATION ---");

        // 7a. Ambulance console polling API: GET /api/emergency/ambulance/requests?ambulanceId=...
        const ambReq = new Request(`http://localhost:3000/api/emergency/ambulance/requests?ambulanceId=${ambulanceId1}`);
        const ambRes = await getAmbulanceRequests(ambReq);
        const ambData = await ambRes.json();
        assert(ambData.success === true, "7a: Ambulance feed query succeeds");
        assert(ambData.activeMission != null, "7a: Ambulance console retains activeMission after arrival");
        assert(ambData.activeMission?.status === "ARRIVED", "7a: activeMission.status is 'ARRIVED'");
        assert(ambData.activeMission?.transportStatus === "ARRIVED", "7a: activeMission.transportStatus is 'ARRIVED'");
        assert(ambData.reservedHospital?.hospitalName === "Metro Trauma Care & Research Center",
            "7a: Ambulance console displays real hospital name");

        // 7b. Patient timeline API: GET /api/emergency/request?emergencyId=...
        const patReq = new Request(`http://localhost:3000/api/emergency/request?emergencyId=${emergencyId1}`);
        const patRes = await getPatientEmergency(patReq);
        const patData = await patRes.json();
        assert(patData.success === true, "7b: Patient emergency query succeeds");
        assert(patData.emergency?.transportStatus === "ARRIVED", "7b: Patient emergency reflects transportStatus: 'ARRIVED'");
        assert(patData.emergency?.status === "ARRIVED", "7b: Patient emergency reflects status: 'ARRIVED'");
        assert(patData.emergency?.receivingHospitalName === "Metro Trauma Care & Research Center",
            "7b: Patient UI receives real receiving hospital name");
        assert(patData.ambulance?.transportStatus === "ARRIVED", "7b: Patient UI receives ambulance transportStatus: 'ARRIVED'");

        // 7c. Hospital emergency board active query: GET /api/emergency/active?hospitalId=...
        const hospReq = new Request(`http://localhost:3000/api/emergency/active?hospitalId=${hospitalId}`);
        const hospRes = await getHospitalActiveState(hospReq);
        const hospData = await hospRes.json();
        assert(hospData.success === true, "7c: Hospital active state query succeeds");
        const activeEmgs = hospData.data?.emergencies || hospData.emergencies || [];
        const matchingEmg = activeEmgs.find((e: any) => e.emergencyId === emergencyId1);
        assert(matchingEmg != null, "7c: Hospital emergency board includes arriving emergency");
        assert(matchingEmg?.transportStatus === "ARRIVED", "7c: Hospital emergency board reflects transportStatus: 'ARRIVED'");

        console.log("  ✓ Cross-panel synchronization verified across Ambulance, Patient, and Hospital!\n");

        // -----------------------------------------------------------------------------
        // CLEANUP FIXTURES
        // -----------------------------------------------------------------------------
        console.log("--- CLEANUP: REMOVING TEST FIXTURES ---");
        await db.collection("hospitals").deleteMany({ uid: { $in: [hospitalId] } });
        await db.collection("ambulances").deleteMany({ ambulanceId: { $in: [ambulanceId1, ambulanceId2] } });
        await db.collection("emergencyRequests").deleteMany({ emergencyId: { $in: [emergencyId1, emergencyId2] } });
        await db.collection("reservations").deleteMany({ emergencyId: { $in: [emergencyId1, emergencyId2] } });
        await db.collection("hospitalEvents").deleteMany({ emergencyId: { $in: [emergencyId1, emergencyId2] } });
        console.log("  ✓ Cleaned up operational test records.\n");

    } catch (err: any) {
        console.error("Test execution error:", err);
        failed++;
    } finally {
        await client.close();
    }

    console.log("=========================================================================");
    console.log(`PHASE 3A TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=========================================================================");

    if (failed > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runPhase3ATestSuite();
