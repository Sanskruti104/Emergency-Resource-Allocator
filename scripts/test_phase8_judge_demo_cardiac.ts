/**
 * PHASE 8 — JUDGE DEMO CARDIAC END-TO-END VALIDATION TEST
 *
 * Validates the primary judge scenario:
 * 1. Demo reset & baseline verification
 * 2. Launch JUDGE_DEMO_CARDIAC
 * 3. Clinical triage: STEMI, shock, Cardiology + Cath Lab + ICU + Ventilator
 * 4. Multi-criteria allocation:
 *    - Closer hospitals (NeuroShield, SafeHaven, CityGuard) rejected (missing Cardiology/Cath Lab)
 *    - Farther hospital (Apex Heart & Vascular) selected (all mandatory resources verified)
 *    - Nearest unsuitable (< 3 km) ≠ Recommended hospital (~9.6 km)
 * 5. Reservation request (PENDING) -> Hospital acceptance (CONFIRMED)
 * 6. Capacity before admission (reserved = 1)
 * 7. Transport -> Arrival -> Handoff -> Admission
 * 8. Capacity after admission (reserved = 0, occupied += 1, available = total - occupied)
 * 9. Ambulance release to AVAILABLE
 * 10. Multi-view synchronization (Patient, Ambulance, Hospital)
 * 11. Reproducibility check: reset and re-launch
 */

import { MongoClient } from "mongodb";
import { GET as handleGetScenario, POST as handleStartScenario } from "../app/api/demo/scenario/route";
import { POST as handleResetDemo } from "../app/api/demo/reset/route";
import { POST as handleAdvanceDemo } from "../app/api/demo/advance/route";
import { GET as handleActiveState } from "../app/api/emergency/active/route";
import { GET as handleAmbulanceRequests } from "../app/api/emergency/ambulance/requests/route";
import { evaluateHospitals } from "../lib/emergency/emergency-allocator";
import { triageEmergency } from "../lib/emergency/triage-intake";

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

export async function runJudgeDemoCardiacTest() {
    header("PHASE 8: JUDGE DEMO CARDIAC END-TO-END VALIDATION");
    console.log("Connecting to live MongoDB database...");

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(DB_NAME);
    console.log(`Connected to database: ${db.databaseName}\n`);

    const initialHospitalsCount = await db.collection("hospitals").countDocuments();
    const emsEventsCount = await db.collection("ems_events").countDocuments();
    const benchmarksCount = await db.collection("hospital_capacity_benchmarks").countDocuments();

    console.log(`Database State:`);
    console.log(`  - Operational Hospitals:             ${initialHospitalsCount}`);
    console.log(`  - Historical EMS Events (Kaggle):    ${emsEventsCount}`);
    console.log(`  - Capacity Benchmarks (Kaggle):      ${benchmarksCount}\n`);

    try {
        // ─────────────────────────────────────────────────────────────────
        // 1. CLEAN RESET
        // ─────────────────────────────────────────────────────────────────
        header("1. DEMO RESET & INITIAL STATE");
        const resetRes = await handleResetDemo();
        const resetData = await resetRes.json();
        assert(resetRes.status === 200 && resetData.success, "POST /api/demo/reset executed successfully");

        const scenarioRes = await handleGetScenario();
        const scenarioData = await scenarioRes.json();
        assert(scenarioData.activeScenario === null, "Active scenario is null after reset");

        const hospitalsCountAfterReset = await db.collection("hospitals").countDocuments();
        assert(hospitalsCountAfterReset === initialHospitalsCount, "Hospital master data untouched by reset");

        const emsCountAfterReset = await db.collection("ems_events").countDocuments();
        assert(emsCountAfterReset === emsEventsCount, "Kaggle historical ems_events collection untouched by reset");

        const benchCountAfterReset = await db.collection("hospital_capacity_benchmarks").countDocuments();
        assert(benchCountAfterReset === benchmarksCount, "Kaggle hospital_capacity_benchmarks collection untouched by reset");

        // ─────────────────────────────────────────────────────────────────
        // 2. LAUNCH PRIMARY JUDGE SCENARIO: JUDGE_DEMO_CARDIAC
        // ─────────────────────────────────────────────────────────────────
        header("2. LAUNCH PRIMARY JUDGE SCENARIO: JUDGE_DEMO_CARDIAC");
        const startReq = new Request("http://localhost:3000/api/demo/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "JUDGE_DEMO_CARDIAC" })
        });
        const startRes = await handleStartScenario(startReq);
        const startData = await startRes.json();

        assert(startRes.status === 200 && startData.success, "Started JUDGE_DEMO_CARDIAC successfully");
        const active = startData.activeScenario;
        assert(active.scenario === "JUDGE_DEMO_CARDIAC", "Active scenario is JUDGE_DEMO_CARDIAC");
        assert(active.priority === "RED", "Triage priority is RED (Emergency)");
        assert(active.status === "PENDING", "Initial lifecycle stage is PENDING");
        assert(!!active.emergencyId, `Emergency ID generated: ${active.emergencyId}`);
        assert(active.ambulanceId === "AMB-PUNE-01", "Assigned canonical demo ambulance AMB-PUNE-01");

        // ─────────────────────────────────────────────────────────────────
        // 3. CLINICAL TRIAGE REQUIREMENTS
        // ─────────────────────────────────────────────────────────────────
        header("3. CLINICAL TRIAGE REQUIREMENTS");
        const emgDoc = await db.collection("emergencyRequests").findOne({ emergencyId: active.emergencyId });
        assert(emgDoc !== null, "Emergency record exists in MongoDB emergencyRequests collection");

        const condition = emgDoc?.condition || "cardiac";
        const chiefComplaint = emgDoc?.chiefComplaint || "Acute STEMI with cardiogenic shock";
        const vitals = emgDoc?.vitals || { sbp: 85, heartRate: 118, spo2: 88, gcs: 14 };

        const triage = triageEmergency(condition, chiefComplaint, vitals, "RED");
        console.log(`Condition:           ${condition}`);
        console.log(`Priority:            ${triage.priority}`);
        console.log(`Required Specialty:  ${triage.requiredSpecialty}`);
        console.log(`Mandatory Resources: ${triage.requiredResources.join(", ")}`);

        assert(triage.priority === "RED", "Triage classifies case as RED");
        assert(triage.requiredResources.includes("ICU_BED"), "Requires ICU_BED");
        assert(triage.requiredResources.includes("VENTILATOR"), "Requires VENTILATOR");
        assert(triage.requiredResources.includes("CATH_LAB"), "Requires CATH_LAB");

        // ─────────────────────────────────────────────────────────────────
        // 4. ALLOCATION: NEAREST VS SUITABLE EVALUATION
        // ─────────────────────────────────────────────────────────────────
        header("4. ALLOCATION: NEAREST VS SUITABLE EVALUATION");
        const allocResult = await evaluateHospitals({
            condition: "cardiac",
            chiefComplaint,
            priority: triage.priority,
            requiredSpecialty: triage.requiredSpecialty,
            requiredResources: triage.requiredResources,
            incidentLocation: emgDoc?.incidentLocation || { latitude: 18.5204, longitude: 73.8567, address: "Shivajinagar Central Corridor, Pune" },
            vitals
        });

        assert(allocResult.success === true, "evaluateHospitals returned success");
        assert(allocResult.totalCandidatesEvaluated >= 5, `Evaluated operational hospitals (count: ${allocResult.totalCandidatesEvaluated})`);

        const suitable = allocResult.results.filter(r => r.suitability);
        const unsuitable = allocResult.results.filter(r => !r.suitability);

        assert(suitable.length >= 1, `Found suitable hospital(s): ${suitable.map(s => s.hospitalName).join(", ")}`);
        assert(unsuitable.length >= 1, `Found unsuitable hospital(s): ${unsuitable.map(u => u.hospitalName).join(", ")}`);

        const recommended = suitable[0];
        const closestUnsuitable = [...unsuitable].sort((a, b) => a.distanceKm - b.distanceKm)[0];

        console.log("\nClosest Facility (Unsuitable):");
        console.log(`  Name:             ${closestUnsuitable.hospitalName} [${closestUnsuitable.hospitalId}]`);
        console.log(`  Distance:         ${closestUnsuitable.distanceKm.toFixed(2)} km`);
        console.log(`  Suitability:      ${closestUnsuitable.suitability ? "SUITABLE" : "❌ NOT SUITABLE"}`);
        console.log(`  Missing:          ${closestUnsuitable.missingResources.join(", ")}`);
        console.log(`  Rejection Reason: ${closestUnsuitable.reasons[0]}`);

        console.log("\nRecommended Destination (Suitable):");
        console.log(`  Name:             ${recommended.hospitalName} [${recommended.hospitalId}]`);
        console.log(`  Distance:         ${recommended.distanceKm.toFixed(2)} km`);
        console.log(`  ETA:              ${recommended.estimatedTravelMinutes} min`);
        console.log(`  Suitability:      ${recommended.suitability ? "✅ SUITABLE" : "UNSUITABLE"}`);
        console.log(`  ICU Available:    ${recommended.availableCapacity.availableIcuBeds} / ${recommended.availableCapacity.icuBeds}`);
        console.log(`  General Beds:     ${recommended.availableCapacity.availableBeds} / ${recommended.availableCapacity.totalBeds}`);
        console.log(`  Telemetry:        ${recommended.freshnessStatus}`);

        assert(closestUnsuitable.distanceKm < recommended.distanceKm, `Closer facility (${closestUnsuitable.distanceKm.toFixed(2)} km) is physically nearer than recommended facility (${recommended.distanceKm.toFixed(2)} km)`);
        assert(closestUnsuitable.suitability === false, `Closer facility is disqualified due to missing mandatory resources`);
        assert(recommended.suitability === true, `Recommended facility satisfies all mandatory capabilities`);
        assert(recommended.hospitalId === "DEMO-HOSP-CARDIAC-001", "Apex Heart & Vascular Institute is the selected suitable facility");

        // ─────────────────────────────────────────────────────────────────
        // 5. STAGE ADVANCEMENT: LIFECYCLE PROGRESSION & RESERVATION
        // ─────────────────────────────────────────────────────────────────
        header("5. LIFECYCLE ADVANCEMENT: DISPATCH, ON_SCENE & RESERVATION");

        // Baseline capacity of target hospital before any reservation
        const hospInitial = await db.collection("hospitals").findOne({ uid: "DEMO-HOSP-CARDIAC-001" });
        const capInitial = hospInitial?.capacity;
        console.log("Initial Capacity at Apex Heart & Vascular:");
        console.log(`  Available ICU: ${capInitial?.availableIcuBeds} | Reserved ICU: ${capInitial?.reservedIcuBeds} | Occupied ICU: ${capInitial?.occupiedIcuBeds}`);

        // Advance 1: PENDING -> DISPATCHED
        const adv1 = await (await handleAdvanceDemo()).json();
        assert(adv1.success && adv1.stage === "DISPATCHED", "Advance 1: Ambulance Dispatched");

        // Advance 2: DISPATCHED -> ON_SCENE
        const adv2 = await (await handleAdvanceDemo()).json();
        assert(adv2.success && adv2.stage === "ON_SCENE", "Advance 2: Ambulance On Scene");

        // Advance 3: ON_SCENE -> TRANSPORTING (Allocated to Apex)
        const adv3 = await (await handleAdvanceDemo()).json();
        assert(adv3.success && adv3.stage === "TRANSPORTING", "Advance 3: Patient Secured & Hospital Allocated");

        // Advance 4: TRANSPORTING -> RESERVATION_REQUESTED (Bed held in capacity)
        const adv4 = await (await handleAdvanceDemo()).json();
        assert(adv4.success && adv4.stage === "RESERVATION_REQUESTED", "Advance 4: Bed Reservation Requested (PENDING)");

        const resDocPending = await db.collection("reservations").findOne({ emergencyId: active.emergencyId });
        assert(resDocPending !== null, "Reservation created in MongoDB reservations collection");
        assert(resDocPending?.status === "PENDING", "Reservation status is PENDING");
        assert(resDocPending?.hospitalId === "DEMO-HOSP-CARDIAC-001", "Reservation target is Apex Heart & Vascular Institute");

        // Advance 5: RESERVATION_REQUESTED -> DESTINATION_CONFIRMED (Hospital Operator accepts)
        const adv5 = await (await handleAdvanceDemo()).json();
        assert(adv5.success && adv5.stage === "DESTINATION_CONFIRMED", "Advance 5: Hospital Operator Confirmed Reservation");

        const resDocConfirmed = await db.collection("reservations").findOne({ emergencyId: active.emergencyId });
        assert(resDocConfirmed?.status === "CONFIRMED", "Reservation status is CONFIRMED");

        // Capacity check with reservation held (reserved = 1, available decreased by 1)
        const hospBeforeAdmit = await db.collection("hospitals").findOne({ uid: "DEMO-HOSP-CARDIAC-001" });
        const capBefore = hospBeforeAdmit?.capacity;
        console.log("\nHospital Capacity (CONFIRMED reservation held):");
        console.log(`  Total Beds:       ${capBefore?.totalBeds}`);
        console.log(`  Available Beds:   ${capBefore?.availableBeds}`);
        console.log(`  Occupied Beds:    ${capBefore?.occupiedBeds}`);
        console.log(`  Reserved Beds:    ${capBefore?.reservedBeds}`);
        console.log(`  Available ICU:    ${capBefore?.availableIcuBeds} (decreased by 1 from ${capInitial?.availableIcuBeds})`);
        console.log(`  Occupied ICU:     ${capBefore?.occupiedIcuBeds}`);
        console.log(`  Reserved ICU:     ${capBefore?.reservedIcuBeds} (held = 1)`);

        assert(capBefore?.reservedIcuBeds === 1, "Reserved ICU bed count is 1");
        assert(capBefore?.availableIcuBeds === capInitial?.availableIcuBeds - 1, "Available ICU beds decremented by 1 during reservation");
        assert(
            capBefore?.icuBeds === (capBefore?.availableIcuBeds + capBefore?.occupiedIcuBeds + capBefore?.reservedIcuBeds),
            `ICU Capacity invariant holds before admission: total (${capBefore?.icuBeds}) = available (${capBefore?.availableIcuBeds}) + occupied (${capBefore?.occupiedIcuBeds}) + reserved (${capBefore?.reservedIcuBeds})`
        );

        // ─────────────────────────────────────────────────────────────────
        // 6. TRANSPORT, ARRIVAL, HANDOFF & ADMISSION
        // ─────────────────────────────────────────────────────────────────
        header("6. TRANSPORT, ARRIVAL, HANDOFF & ADMISSION");

        // Advance 6: DESTINATION_CONFIRMED -> EN_ROUTE
        const adv6 = await (await handleAdvanceDemo()).json();
        assert(adv6.success && adv6.stage === "EN_ROUTE", "Advance 6: Ambulance En Route with Emergency Escort");

        // Advance 7: EN_ROUTE -> ARRIVED
        const adv7 = await (await handleAdvanceDemo()).json();
        assert(adv7.success && adv7.stage === "ARRIVED", "Advance 7: Ambulance Arrived at Hospital Bay");

        // Advance 8: ARRIVED -> HANDOFF_IN_PROGRESS
        const adv8 = await (await handleAdvanceDemo()).json();
        assert(adv8.success && adv8.stage === "HANDOFF_IN_PROGRESS", "Advance 8: Clinical Handoff Initiated");

        // Advance 9: HANDOFF_IN_PROGRESS -> ADMITTED
        const adv9 = await (await handleAdvanceDemo()).json();
        assert(adv9.success && adv9.stage === "ADMITTED", "Advance 9: Patient Formally Admitted to Receiving Hospital");

        // ─────────────────────────────────────────────────────────────────
        // 7. CAPACITY VERIFICATION AFTER ADMISSION
        // ─────────────────────────────────────────────────────────────────
        header("7. CAPACITY TRANSITION AFTER ADMISSION");
        const hospAfterAdmit = await db.collection("hospitals").findOne({ uid: "DEMO-HOSP-CARDIAC-001" });
        const capAfter = hospAfterAdmit?.capacity;

        console.log("Hospital Capacity (ADMISSION COMPLETE):");
        console.log(`  Total ICU Beds:   ${capAfter?.icuBeds}`);
        console.log(`  Available ICU:    ${capAfter?.availableIcuBeds} (remains reserved-free)`);
        console.log(`  Occupied ICU:     ${capAfter?.occupiedIcuBeds} (increased by 1 from ${capBefore?.occupiedIcuBeds})`);
        console.log(`  Reserved ICU:     ${capAfter?.reservedIcuBeds} (transferred: was ${capBefore?.reservedIcuBeds}, now 0)`);

        assert(capAfter?.reservedIcuBeds === 0, "Reserved ICU beds decremented to 0 after admission");
        assert(capAfter?.occupiedIcuBeds === (capBefore?.occupiedIcuBeds + 1), "Occupied ICU beds incremented by 1 upon admission");
        assert(
            capAfter?.icuBeds === (capAfter?.availableIcuBeds + capAfter?.occupiedIcuBeds + capAfter?.reservedIcuBeds),
            `ICU Capacity invariant strictly holds after admission: total (${capAfter?.icuBeds}) = available (${capAfter?.availableIcuBeds}) + occupied (${capAfter?.occupiedIcuBeds}) + reserved (${capAfter?.reservedIcuBeds})`
        );

        // Ambulance status verification
        const ambDoc = await db.collection("ambulances").findOne({ ambulanceId: "AMB-PUNE-01" });
        console.log(`\nAmbulance AMB-PUNE-01 Status: ${ambDoc?.status}`);
        assert(ambDoc?.status === "AVAILABLE", "Ambulance released to AVAILABLE after complete handoff & admission");

        // Multi-view convergence check
        const emgFinal = await db.collection("emergencyRequests").findOne({ emergencyId: active.emergencyId });
        assert(emgFinal?.status === "ADMITTED", "Emergency status = ADMITTED");
        assert(emgFinal?.handoffStatus === "COMPLETED", "Emergency handoffStatus = COMPLETED");

        const activeFeed = await (await handleAmbulanceRequests(new Request("http://localhost:3000/api/emergency/ambulance/requests?ambulanceId=AMB-PUNE-01"))).json();
        assert(activeFeed.success === true, "Ambulance CAD endpoint returns success");
        assert(activeFeed.ambulance.status === "AVAILABLE", "Ambulance CAD reflects unit is AVAILABLE");

        // ─────────────────────────────────────────────────────────────────
        // 8. DEMO RESET & REPRODUCIBILITY VERIFICATION
        // ─────────────────────────────────────────────────────────────────
        header("8. DEMO RESET & REPRODUCIBILITY VERIFICATION");
        const resetRes2 = await handleResetDemo();
        const resetData2 = await resetRes2.json();
        assert(resetRes2.status === 200 && resetData2.success, "Second demo reset executed cleanly");

        const scenarioRes2 = await handleGetScenario();
        const scenarioData2 = await scenarioRes2.json();
        assert(scenarioData2.activeScenario === null, "Active scenario is null after second reset");

        // Re-launch JUDGE_DEMO_CARDIAC to verify 100% reproducibility
        const reLaunchReq = new Request("http://localhost:3000/api/demo/scenario", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: "JUDGE_DEMO_CARDIAC" })
        });
        const reLaunchRes = await handleStartScenario(reLaunchReq);
        const reLaunchData = await reLaunchRes.json();
        assert(reLaunchRes.status === 200 && reLaunchData.success, "Re-launched JUDGE_DEMO_CARDIAC successfully with fresh records");
        assert(reLaunchData.activeScenario.status === "PENDING", "Re-launched scenario starts cleanly at PENDING stage");

        // Clean up
        await handleResetDemo();
        console.log("Final reset complete.\n");

    } finally {
        await client.close();
    }

    header(`TEST SUMMARY: ${passedAssertions} PASSED, ${failedAssertions} FAILED (TOTAL: ${totalAssertions})`);
    if (failedAssertions > 0) {
        process.exit(1);
    }
}

runJudgeDemoCardiacTest().catch((err) => {
    console.error("FATAL ERROR in test_phase8_judge_demo_cardiac:", err);
    process.exit(1);
});
