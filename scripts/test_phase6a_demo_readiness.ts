/**
 * PHASE 6A — MEDDECISION END-TO-END DEMO READINESS TEST SUITE
 *
 * Validates ONE complete emergency journey from beginning to end using
 * the existing application route handlers and live MongoDB Atlas operational data.
 *
 * Flow:
 * PATIENT (Create emergency)
 *   ↓
 * AMBULANCE (Receive emergency → Mark scene arrival → Patient secured)
 *   ↓
 * ALLOCATOR (Run live hospital allocation → Recommended hospital displayed)
 *   ↓
 * AMBULANCE (Request hospital bed reservation)
 *   ↓
 * HOSPITAL (Incoming reservation appears → Hospital accepts)
 *   ↓
 * AMBULANCE (Start hospital transport → Confirm arrival at hospital → Start handoff)
 *   ↓
 * HOSPITAL (Complete handoff & admit)
 *   ↓
 * PATIENT (Shows ADMITTED)
 *   ↓
 * MONGODB (Capacity verified at each step: before, during, after)
 *
 * Plus:
 * - Controlled Negative Path (NO_SUITABLE_HOSPITAL)
 * - Stale Hospital Data Check (STALE_HOSPITAL_DATA)
 * - Cross-Panel Synchronization verification
 *
 * Run:
 *   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/test_phase6a_demo_readiness.ts
 */

import { MongoClient, Db } from "mongodb";
import {
    allocateEmergencyHospital,
    CandidateEvaluation,
    AllocationResult
} from "../lib/emergency/emergency-allocator";
import {
    reserveResource,
    confirmReservation,
    rejectReservation
} from "../lib/emergency/emergency-reservation";
import { POST as handleEmergencyRequest } from "../app/api/emergency/request/route";
import { GET as handleActiveState } from "../app/api/emergency/active/route";
import { GET as handleAmbulanceRequests } from "../app/api/emergency/ambulance/requests/route";
import { POST as handleAmbulanceAction } from "../app/api/emergency/ambulance/action/route";
import { POST as handleReserve } from "../app/api/emergency/reserve/route";
import { POST as handleReservationAction } from "../app/api/emergency/reservations/[reservationId]/action/route";
import { POST as handleHandoffAction } from "../app/api/emergency/handoff/action/route";

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

function printCapacity(label: string, cap: any) {
    console.log(`  ${label}:`);
    console.log(`    ICU:     total=${cap.icuBeds}, occupied=${cap.occupiedIcuBeds}, reserved=${cap.reservedIcuBeds}, available=${cap.availableIcuBeds}`);
    console.log(`    General: total=${cap.totalBeds}, occupied=${cap.occupiedBeds}, reserved=${cap.reservedBeds}, available=${cap.availableBeds}`);
}

async function runDemoReadinessTestSuite() {
    printHeader("PHASE 6A: END-TO-END DEMO READINESS VALIDATION");
    console.log("Connecting to MongoDB Atlas operational database...");

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    console.log(`Connected to database: ${db.databaseName}\n`);

    const runId = `P6A-${Date.now().toString(36).toUpperCase()}`;

    // Test Fixture IDs
    const primaryHospitalId = `HOSP-P6A-CARDIAC-${runId}`;
    const secondaryHospitalId = `HOSP-P6A-TRAUMA-${runId}`;
    const ambulanceId = `AMB-P6A-01-${runId}`;

    try {
        // ─────────────────────────────────────────────────────────────────────
        // SETUP: Seed Operational Hospital & Ambulance Fixtures
        // ─────────────────────────────────────────────────────────────────────
        console.log("--- SETUP: Seeding live operational hospital & ambulance fixtures ---");

        await db.collection("hospitals").insertOne({
            uid: primaryHospitalId,
            hospitalId: primaryHospitalId,
            hospitalName: "Apex Cardiac Care (Phase 6A)",
            latitude: 18.5204,
            longitude: 73.8567,
            specialties: ["Cardiology & Interventional Cath Lab", "Cardiac Surgery", "Emergency Medicine"],
            instruments: ["CATH_LAB", "VENTILATOR", "ICU_MONITOR", "DEFIBRILLATOR"],
            capacity: {
                totalBeds: 100, occupiedBeds: 70, reservedBeds: 5, availableBeds: 25,
                icuBeds: 20, occupiedIcuBeds: 14, reservedIcuBeds: 1, availableIcuBeds: 5,
                operationTheatres: 4, availableOTs: 2
            },
            operationalCapacity: {
                totalBeds: 100, occupiedBeds: 70, reservedBeds: 5, availableBeds: 25,
                icuBeds: 20, occupiedIcuBeds: 14, reservedIcuBeds: 1, availableIcuBeds: 5,
                operationTheatres: 4, availableOTs: 2
            },
            emergencyDepartment: { isActive: true, status: "ACTIVE" },
            doctors: [{ name: "Dr. A. Sharma", specialty: "Cardiology", onDuty: true }],
            telemetryLastUpdated: new Date(),
            updatedAt: new Date(),
            source: "PHASE_6A_TEST"
        });

        await db.collection("hospitals").insertOne({
            uid: secondaryHospitalId,
            hospitalId: secondaryHospitalId,
            hospitalName: "CityGuard Emergency (Phase 6A)",
            latitude: 18.5600,
            longitude: 73.8100,
            specialties: ["Trauma Surgery & Critical Care", "Emergency Medicine"],
            instruments: ["TRAUMA_BAY", "CT_SCANNER", "VENTILATOR", "ICU_MONITOR"],
            capacity: {
                totalBeds: 150, occupiedBeds: 100, reservedBeds: 5, availableBeds: 45,
                icuBeds: 25, occupiedIcuBeds: 18, reservedIcuBeds: 2, availableIcuBeds: 5,
                operationTheatres: 6, availableOTs: 3
            },
            operationalCapacity: {
                totalBeds: 150, occupiedBeds: 100, reservedBeds: 5, availableBeds: 45,
                icuBeds: 25, occupiedIcuBeds: 18, reservedIcuBeds: 2, availableIcuBeds: 5,
                operationTheatres: 6, availableOTs: 3
            },
            emergencyDepartment: { isActive: true, status: "ACTIVE" },
            doctors: [{ name: "Dr. B. Kulkarni", specialty: "Trauma Surgery", onDuty: true }],
            telemetryLastUpdated: new Date(),
            updatedAt: new Date(),
            source: "PHASE_6A_TEST"
        });

        await db.collection("ambulances").insertOne({
            ambulanceId,
            vehicleNumber: "MH-12-P6A-01",
            status: "AVAILABLE",
            assignedEmergencyId: null,
            currentEmergencyId: null,
            destinationHospitalId: null,
            transportStatus: null,
            handoffStatus: null,
            currentLocation: { latitude: 18.5150, longitude: 73.8500 },
            etaMinutes: 4,
            speedKmH: 45,
            telemetrySource: "SIMULATED_GPS",
            updatedAt: new Date(),
            source: "PHASE_6A_TEST"
        });

        console.log("  ✓ Seeded primary hospital, secondary hospital, and ambulance unit.\n");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 1: PATIENT CREATES EMERGENCY (POST /api/emergency/request)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 1: PATIENT CREATES EMERGENCY REQUEST");

        const emgReq = new Request("http://localhost:3000/api/emergency/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emergencyType: "CARDIAC",
                chiefComplaint: "Crushing chest pain radiating to left arm, diaphoretic, BP 85/55",
                incidentLocation: {
                    latitude: 18.5180,
                    longitude: 73.8530,
                    address: "Pune Central Junction",
                    isSimulated: true
                },
                patient: {
                    name: "Rahul Verma",
                    age: 58,
                    gender: "male",
                    contactNumber: "+91-9876543210"
                },
                vitals: {
                    sbp: 85,
                    heartRate: 115,
                    spo2: 92
                }
            })
        });

        const emgRes = await handleEmergencyRequest(emgReq);
        const emgData = await emgRes.json();

        assert(emgRes.status === 201 || (emgRes.status === 200 && emgData.success), "Step 1: Emergency request accepted by API");
        assert(!!emgData.emergencyId, `Step 1: Generated Emergency ID: ${emgData.emergencyId}`);

        const createdEmergencyId = emgData.emergencyId;

        // Verify patient view endpoint (GET /api/emergency/active)
        const patientActiveReq = new Request("http://localhost:3000/api/emergency/active");
        const patientActiveRes = await handleActiveState(patientActiveReq);
        const patientActiveData = await patientActiveRes.json();

        assert(patientActiveRes.status === 200, "Step 2: Patient active endpoint returns HTTP 200");
        const activeEmgInPatient = patientActiveData.data?.emergencies?.find((e: any) => e.emergencyId === createdEmergencyId);
        assert(!!activeEmgInPatient, "Step 2: Patient view sees newly registered emergency");
        assert(activeEmgInPatient?.priority === "RED", "Step 2: Priority is RED");
        assert(activeEmgInPatient?.emergencyType === "CARDIAC", "Step 2: Emergency type is CARDIAC");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 2: AMBULANCE DISPATCH & SCENE ARRIVAL
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 2: AMBULANCE DISPATCH, SCENE ARRIVAL & PATIENT PICKUP");

        // Emergency was created in PENDING status by POST /api/emergency/request
        // Ambulance requests feed checks for status === 'PENDING'
        const ambReq = new Request(`http://localhost:3000/api/emergency/ambulance/requests?ambulanceId=${encodeURIComponent(ambulanceId)}`);
        const ambRes = await handleAmbulanceRequests(ambReq);
        const ambData = await ambRes.json();

        assert(ambRes.status === 200, "Ambulance CAD endpoint returns HTTP 200");
        const foundPending = (ambData.pendingRequests || []).find((r: any) => r.emergencyId === createdEmergencyId);
        assert(!!foundPending, "Ambulance CAD feed receives incoming emergency alert");

        // Action 1: Ambulance ACCEPTS mission
        const acceptReq = new Request("http://localhost:3000/api/emergency/ambulance/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emergencyId: createdEmergencyId,
                ambulanceId,
                action: "ACCEPT"
            })
        });
        const acceptRes = await handleAmbulanceAction(acceptReq);
        const acceptData = await acceptRes.json();
        assert(acceptRes.status === 200 && acceptData.success, "Ambulance ACCEPT action succeeds");

        const emgAfterAccept = await db.collection("emergencyRequests").findOne({ emergencyId: createdEmergencyId });
        assert(emgAfterAccept?.status === "DISPATCHED", "Emergency status = DISPATCHED");

        // Action 2: Ambulance arrives at scene
        const sceneReq = new Request("http://localhost:3000/api/emergency/ambulance/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emergencyId: createdEmergencyId,
                ambulanceId,
                action: "ARRIVED_SCENE"
            })
        });
        const sceneRes = await handleAmbulanceAction(sceneReq);
        const sceneData = await sceneRes.json();
        assert(sceneRes.status === 200 && sceneData.success, "Ambulance ARRIVED_SCENE action succeeds");

        const emgAfterScene = await db.collection("emergencyRequests").findOne({ emergencyId: createdEmergencyId });
        assert(emgAfterScene?.status === "ON_SCENE", "Emergency status = ON_SCENE");

        // Action 3: Patient Secured (PICKUP)
        const pickupReq = new Request("http://localhost:3000/api/emergency/ambulance/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emergencyId: createdEmergencyId,
                ambulanceId,
                action: "PICKUP"
            })
        });
        const pickupRes = await handleAmbulanceAction(pickupReq);
        const pickupData = await pickupRes.json();
        assert(pickupRes.status === 200 && pickupData.success, "Ambulance PICKUP action succeeds");

        const emgAfterPickup = await db.collection("emergencyRequests").findOne({ emergencyId: createdEmergencyId });
        assert(emgAfterPickup?.status === "TRANSPORTING", "Emergency status = TRANSPORTING (patient onboard)");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 3: LIVE HOSPITAL ALLOCATION & CAPACITY ACCOUNTING
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 3: LIVE HOSPITAL ALLOCATION & CAPACITY PRE-CHECK");

        const allocResult: AllocationResult = await allocateEmergencyHospital({
            emergencyId: createdEmergencyId,
            condition: "cardiac",
            chiefComplaint: "Crushing chest pain, BP 85/55",
            priority: "RED",
            requiredSpecialty: "Cardiology & Interventional Cath Lab",
            requiredResources: ["ICU_BED", "CATH_LAB", "VENTILATOR"],
            incidentLocation: { latitude: 18.5180, longitude: 73.8530 }
        });

        assert(allocResult.success === true, "Live Allocator returns success");
        assert(allocResult.suitableCount > 0, `Allocator found suitable hospitals (count: ${allocResult.suitableCount})`);

        const topCandidate = allocResult.results.find((c) => c.suitability && c.hospitalId === primaryHospitalId) || allocResult.results[0];
        assert(!!topCandidate, `Recommended receiving hospital identified: ${topCandidate.hospitalName}`);
        console.log(`  Recommended Receiving Hospital: ${topCandidate.hospitalName} (Score: ${topCandidate.overallScore}/100)`);
        console.log(`  Distance: ${topCandidate.distanceKm.toFixed(1)} km, ETA: ${topCandidate.estimatedTravelMinutes} min`);
        console.log(`  Available ICU: ${topCandidate.availableCapacity.availableIcuBeds}, General Beds: ${topCandidate.availableCapacity.availableBeds}`);

        // Capture Hospital Capacity BEFORE Reservation
        const hospBefore = await db.collection("hospitals").findOne({ uid: primaryHospitalId });
        const capBefore = hospBefore!.capacity;
        console.log("\nCapacity BEFORE Reservation:");
        printCapacity(hospBefore!.hospitalName, capBefore);

        assert(
            capBefore.totalBeds - capBefore.occupiedBeds - capBefore.reservedBeds === capBefore.availableBeds,
            "Invariant check before reservation: total - occupied - reserved === available"
        );


        // ─────────────────────────────────────────────────────────────────────
        // STEP 4: AMBULANCE REQUESTS RESERVATION (POST /api/emergency/reserve)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 4: AMBULANCE REQUESTS BED RESERVATION");

        const resvReq = new Request("http://localhost:3000/api/emergency/reserve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                hospitalId: primaryHospitalId,
                emergencyId: createdEmergencyId,
                resourceType: "ICU_BED",
                quantity: 1,
                ttlMinutes: 30,
                allocatedBy: "AUTO_ALLOCATOR"
            })
        });

        const resvRes = await handleReserve(resvReq);
        const resvData = await resvRes.json();

        assert(resvRes.status === 201 || (resvRes.status === 200 && resvData.success), "Reservation API returns HTTP 201 Created");
        const reservationId = resvData.reservationId || resvData.reservation?.reservationId;
        assert(!!reservationId, `Reservation ID generated: ${reservationId}`);

        // Check Capacity AFTER Reservation (quantity = 1)
        const hospAfterResv = await db.collection("hospitals").findOne({ uid: primaryHospitalId });
        const capAfterResv = hospAfterResv!.capacity;
        console.log("\nCapacity AFTER Reservation:");
        printCapacity(hospAfterResv!.hospitalName, capAfterResv);

        assert(capAfterResv.reservedIcuBeds === capBefore.reservedIcuBeds + 1, "Reserved ICU beds increased by exactly 1");
        assert(capAfterResv.availableIcuBeds === capBefore.availableIcuBeds - 1, "Available ICU beds decreased by exactly 1");
        assert(capAfterResv.occupiedIcuBeds === capBefore.occupiedIcuBeds, "Occupied ICU beds strictly unchanged during reservation");
        assert(
            capAfterResv.icuBeds - capAfterResv.occupiedIcuBeds - capAfterResv.reservedIcuBeds === capAfterResv.availableIcuBeds,
            "Invariant check after reservation: total - occupied - reserved === available"
        );


        // ─────────────────────────────────────────────────────────────────────
        // STEP 5: HOSPITAL EMERGENCY BOARD ACCEPTS RESERVATION
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 5: HOSPITAL OPERATOR CONFIRMS BED RESERVATION");

        // Verify incoming reservation appears on hospital board
        const hospBoardReq = new Request(`http://localhost:3000/api/emergency/active?hospitalId=${encodeURIComponent(primaryHospitalId)}`);
        const hospBoardRes = await handleActiveState(hospBoardReq);
        const hospBoardData = await hospBoardRes.json();

        assert(hospBoardRes.status === 200, "Hospital active board returns HTTP 200");
        const boardResv = (hospBoardData.data?.reservations || []).find((r: any) => r.reservationId === reservationId);
        assert(!!boardResv, "Hospital board sees incoming reservation request");
        assert(boardResv?.status === "PENDING", "Reservation status on board is PENDING");

        // Hospital clicks ACCEPT (confirm)
        const confirmReq = new Request(`http://localhost:3000/api/emergency/reservations/${reservationId}/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "confirm" })
        });
        const confirmRes = await handleReservationAction(confirmReq, {
            params: Promise.resolve({ reservationId })
        });
        const confirmData = await confirmRes.json();

        assert(confirmRes.status === 200 && confirmData.success, "Hospital ACCEPT (confirm) action succeeds");

        // Capacity AFTER Acceptance: strictly unchanged
        const hospAfterConfirm = await db.collection("hospitals").findOne({ uid: primaryHospitalId });
        const capAfterConfirm = hospAfterConfirm!.capacity;

        assert(capAfterConfirm.reservedIcuBeds === capAfterResv.reservedIcuBeds, "Reserved beds unchanged by acceptance");
        assert(capAfterConfirm.occupiedIcuBeds === capAfterResv.occupiedIcuBeds, "Occupied beds unchanged by acceptance");
        assert(capAfterConfirm.availableIcuBeds === capAfterResv.availableIcuBeds, "Available beds unchanged by acceptance");

        // Cross-panel check: Emergency request document reflects confirmed hospital
        const emgAfterConfirm = await db.collection("emergencyRequests").findOne({ emergencyId: createdEmergencyId });
        assert(emgAfterConfirm?.receivingHospitalId === primaryHospitalId, "Emergency record reflects confirmed receiving hospital ID");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 6: AMBULANCE HOSPITAL TRANSPORT & ARRIVAL
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 6: AMBULANCE TRANSPORT & ARRIVAL AT HOSPITAL");

        // Action 1: START_TRANSPORT
        const transportReq = new Request("http://localhost:3000/api/emergency/ambulance/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emergencyId: createdEmergencyId,
                ambulanceId,
                action: "START_TRANSPORT"
            })
        });
        const transportRes = await handleAmbulanceAction(transportReq);
        const transportData = await transportRes.json();
        assert(transportRes.status === 200 && transportData.success, "Ambulance START_TRANSPORT succeeds");

        const emgTransporting = await db.collection("emergencyRequests").findOne({ emergencyId: createdEmergencyId });
        assert(emgTransporting?.transportStatus === "EN_ROUTE", "Emergency transportStatus = EN_ROUTE");

        // Action 2: ARRIVED_HOSPITAL
        const arrivedReq = new Request("http://localhost:3000/api/emergency/ambulance/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emergencyId: createdEmergencyId,
                ambulanceId,
                action: "ARRIVED_HOSPITAL"
            })
        });
        const arrivedRes = await handleAmbulanceAction(arrivedReq);
        const arrivedData = await arrivedRes.json();
        assert(arrivedRes.status === 200 && arrivedData.success, "Ambulance ARRIVED_HOSPITAL succeeds");

        const emgArrived = await db.collection("emergencyRequests").findOne({ emergencyId: createdEmergencyId });
        assert(emgArrived?.transportStatus === "ARRIVED", "Emergency transportStatus = ARRIVED");
        assert(emgArrived?.status === "ARRIVED", "Emergency status = ARRIVED");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 7: CLINICAL HANDOFF & PATIENT ADMISSION
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 7: CLINICAL HANDOFF & FORMAL PATIENT ADMISSION");

        // Action 1: START_HANDOFF
        const startHandoffReq = new Request("http://localhost:3000/api/emergency/handoff/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emergencyId: createdEmergencyId,
                action: "START_HANDOFF",
                hospitalId: primaryHospitalId,
                reservationId
            })
        });
        const startHandoffRes = await handleHandoffAction(startHandoffReq);
        const startHandoffData = await startHandoffRes.json();
        assert(startHandoffRes.status === 200 && startHandoffData.success, "START_HANDOFF action succeeds");

        const emgInHandoff = await db.collection("emergencyRequests").findOne({ emergencyId: createdEmergencyId });
        assert(emgInHandoff?.handoffStatus === "IN_PROGRESS", "Emergency handoffStatus = IN_PROGRESS");

        // Action 2: COMPLETE_HANDOFF (Formal Admission)
        const completeHandoffReq = new Request("http://localhost:3000/api/emergency/handoff/action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                emergencyId: createdEmergencyId,
                action: "COMPLETE_HANDOFF",
                hospitalId: primaryHospitalId,
                reservationId
            })
        });
        const completeHandoffRes = await handleHandoffAction(completeHandoffReq);
        const completeHandoffData = await completeHandoffRes.json();
        assert(completeHandoffRes.status === 200 && completeHandoffData.success, "COMPLETE_HANDOFF action succeeds (ADMITTED)");

        // Verify Emergency Record Final State
        const emgFinal = await db.collection("emergencyRequests").findOne({ emergencyId: createdEmergencyId });
        assert(emgFinal?.status === "ADMITTED", "Emergency final status = ADMITTED");
        assert(emgFinal?.handoffStatus === "COMPLETED", "Emergency final handoffStatus = COMPLETED");
        assert(!!emgFinal?.admittedAt, "Emergency admittedAt timestamp recorded");

        // Verify Ambulance Released
        const ambFinal = await db.collection("ambulances").findOne({ ambulanceId });
        assert(ambFinal?.status === "AVAILABLE", "Ambulance status released to AVAILABLE");
        assert(ambFinal?.currentEmergencyId === null, "Ambulance currentEmergencyId cleared to null");

        // Verify Capacity AFTER Admission (reserved -= 1, occupied += 1, available unchanged from resv state)
        const hospFinal = await db.collection("hospitals").findOne({ uid: primaryHospitalId });
        const capFinal = hospFinal!.capacity;
        console.log("\nCapacity AFTER Admission:");
        printCapacity(hospFinal!.hospitalName, capFinal);

        assert(capFinal.reservedIcuBeds === capBefore.reservedIcuBeds, "Reserved ICU beds restored to baseline");
        assert(capFinal.occupiedIcuBeds === capBefore.occupiedIcuBeds + 1, "Occupied ICU beds incremented by exactly 1");
        assert(capFinal.availableIcuBeds === capAfterResv.availableIcuBeds, "Available ICU beds remains consistent with reservation state");
        assert(
            capFinal.icuBeds - capFinal.occupiedIcuBeds - capFinal.reservedIcuBeds === capFinal.availableIcuBeds,
            "Invariant strictly holds: total - occupied - reserved === available"
        );
        assert(capFinal.availableIcuBeds >= 0 && capFinal.reservedIcuBeds >= 0 && capFinal.occupiedIcuBeds >= 0, "Zero negative capacity values");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 8: CROSS-PANEL SYNCHRONIZATION VERIFICATION
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 8: CROSS-PANEL SYNCHRONIZATION CHECK");

        // 8A: Patient panel check
        const patientSyncRes = await handleActiveState(new Request("http://localhost:3000/api/emergency/active"));
        const patientSyncData = await patientSyncRes.json();
        const pEmg = patientSyncData.data?.emergencies?.find((e: any) => e.emergencyId === createdEmergencyId);
        assert(pEmg?.status === "ADMITTED", "Patient panel reflects ADMITTED");

        // 8B: Ambulance panel check
        const ambSyncRes = await handleAmbulanceRequests(new Request(`http://localhost:3000/api/emergency/ambulance/requests?ambulanceId=${encodeURIComponent(ambulanceId)}`));
        const ambSyncData = await ambSyncRes.json();
        assert(ambSyncData.activeMission === null, "Ambulance panel cleared of active mission");

        // 8C: Hospital board check
        const hospSyncRes = await handleActiveState(new Request(`http://localhost:3000/api/emergency/active?hospitalId=${encodeURIComponent(primaryHospitalId)}`));
        const hospSyncData = await hospSyncRes.json();
        const hResv = (hospSyncData.data?.reservations || []).find((r: any) => r.reservationId === reservationId);
        assert(hResv?.status === "ADMITTED", "Hospital board reflects reservation status ADMITTED");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 9: CONTROLLED NEGATIVE PATH CHECK (NO_SUITABLE_HOSPITAL)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 9: CONTROLLED NEGATIVE PATH (NO_SUITABLE_HOSPITAL)");

        const negativeHospId = `HOSP-P6A-FULL-${runId}`;
        await db.collection("hospitals").insertOne({
            uid: negativeHospId,
            hospitalId: negativeHospId,
            hospitalName: "Full Facility (Phase 6A Negative Path)",
            latitude: 18.5204,
            longitude: 73.8567,
            specialties: ["Cardiology & Interventional Cath Lab"],
            instruments: ["CATH_LAB"],
            capacity: {
                totalBeds: 50, occupiedBeds: 50, reservedBeds: 0, availableBeds: 0,
                icuBeds: 10, occupiedIcuBeds: 10, reservedIcuBeds: 0, availableIcuBeds: 0,
                operationTheatres: 2, availableOTs: 0
            },
            operationalCapacity: {
                totalBeds: 50, occupiedBeds: 50, reservedBeds: 0, availableBeds: 0,
                icuBeds: 10, occupiedIcuBeds: 10, reservedIcuBeds: 0, availableIcuBeds: 0,
                operationTheatres: 2, availableOTs: 0
            },
            emergencyDepartment: { isActive: true, status: "ACTIVE" },
            updatedAt: new Date(),
            source: "PHASE_6A_TEST"
        });

        const negativeAlloc = await allocateEmergencyHospital({
            emergencyId: `EMG-NEG-${runId}`,
            condition: "cardiac",
            chiefComplaint: "Severe cardiac collapse needing immediate ICU bed",
            priority: "RED",
            requiredSpecialty: "Cardiology & Interventional Cath Lab",
            requiredResources: ["ICU_BED", "CATH_LAB"],
            incidentLocation: { latitude: 18.5200, longitude: 73.8500 },
            candidateHospitals: [await db.collection("hospitals").findOne({ uid: negativeHospId }) as any]
        });

        assert(negativeAlloc.success === true, "Negative path: Allocator returns success (no crash)");
        assert(negativeAlloc.suitableCount === 0, "Negative path: Zero suitable hospitals returned (suitableCount === 0)");
        assert(negativeAlloc.results[0]?.suitability === false, "Negative path: Hospital marked UNSUITABLE");
        assert(
            negativeAlloc.results[0]?.missingResources.includes("ICU_BED"),
            "Negative path: Missing resource reason explicitly identifies ICU_BED"
        );

        // Verify capacity untouched
        const negCapAfter = await db.collection("hospitals").findOne({ uid: negativeHospId });
        assert(negCapAfter!.capacity.availableIcuBeds === 0, "Negative path: Hospital capacity strictly unchanged");


        // ─────────────────────────────────────────────────────────────────────
        // STEP 10: STALE HOSPITAL DATA CHECK (STALE_HOSPITAL_DATA)
        // ─────────────────────────────────────────────────────────────────────
        printHeader("STEP 10: STALE HOSPITAL DATA TELEMETRY CHECK");

        const staleHospId = `HOSP-P6A-STALE-${runId}`;
        const staleTime = new Date(Date.now() - 120 * 60 * 1000); // 2 hours ago

        await db.collection("hospitals").insertOne({
            uid: staleHospId,
            hospitalId: staleHospId,
            hospitalName: "Stale Telemetry Centre (Phase 6A)",
            latitude: 18.5210,
            longitude: 73.8570,
            specialties: ["Cardiology & Interventional Cath Lab"],
            instruments: ["CATH_LAB", "ICU_MONITOR"],
            capacity: {
                totalBeds: 100, occupiedBeds: 70, reservedBeds: 5, availableBeds: 25,
                icuBeds: 20, occupiedIcuBeds: 10, reservedIcuBeds: 0, availableIcuBeds: 10
            },
            operationalCapacity: {
                totalBeds: 100, occupiedBeds: 70, reservedBeds: 5, availableBeds: 25,
                icuBeds: 20, occupiedIcuBeds: 10, reservedIcuBeds: 0, availableIcuBeds: 10
            },
            emergencyDepartment: { isActive: true, status: "ACTIVE" },
            telemetryLastUpdated: staleTime,
            updatedAt: staleTime,
            source: "PHASE_6A_TEST"
        });

        const staleCandidates = [
            await db.collection("hospitals").findOne({ uid: primaryHospitalId }) as any,
            await db.collection("hospitals").findOne({ uid: staleHospId }) as any
        ];

        const staleAlloc = await allocateEmergencyHospital({
            emergencyId: `EMG-STALE-${runId}`,
            condition: "cardiac",
            chiefComplaint: "Telemetry freshness evaluation",
            priority: "RED",
            requiredSpecialty: "Cardiology & Interventional Cath Lab",
            requiredResources: ["ICU_BED", "CATH_LAB"],
            incidentLocation: { latitude: 18.5204, longitude: 73.8567 },
            candidateHospitals: staleCandidates
        });

        const staleEval = staleAlloc.results.find((c) => c.hospitalId === staleHospId);
        const freshEval = staleAlloc.results.find((c) => c.hospitalId === primaryHospitalId);

        assert(staleEval?.freshnessStatus === "STALE", "Stale hospital telemetry classified as STALE (>60 min)");
        assert(staleEval?.freshnessScore !== undefined && staleEval.freshnessScore <= 20, "Stale hospital receives penalized freshness score (<= 20)");
        assert(freshEval?.freshnessStatus === "FRESH", "Fresh hospital telemetry classified as FRESH");
        assert(freshEval?.overallScore! > staleEval?.overallScore!, "Fresh hospital ranked higher than stale hospital due to telemetry reliability");

    } catch (err: any) {
        console.error("\nFATAL ERROR during Phase 6A test suite:", err?.message || err);
        totalFailed++;
    } finally {
        // ─────────────────────────────────────────────────────────────────────
        // CLEANUP
        // ─────────────────────────────────────────────────────────────────────
        console.log("\n--- CLEANUP: Removing Phase 6A test fixtures ---");
        await db.collection("hospitals").deleteMany({ uid: { $regex: runId } });
        await db.collection("ambulances").deleteMany({ ambulanceId: { $regex: runId } });
        await db.collection("emergencyRequests").deleteMany({ emergencyId: { $regex: runId } });
        await db.collection("reservations").deleteMany({ emergencyId: { $regex: runId } });
        await db.collection("handoffs").deleteMany({ emergencyId: { $regex: runId } });
        await db.collection("hospitalEvents").deleteMany({ emergencyId: { $regex: runId } });
        console.log("  ✓ Test fixtures cleaned up from operational database.\n");

        await client.close();
    }

    printHeader(`PHASE 6A TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    if (totalFailed > 0) {
        process.exit(1);
    }
    process.exit(0);
}

runDemoReadinessTestSuite().catch((err) => {
    console.error("Test suite crashed:", err);
    process.exit(1);
});
