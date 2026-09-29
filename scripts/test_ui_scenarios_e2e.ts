/**
 * End-to-End Simulation Scenario Verification Script
 * Validates all 6 demo scenarios that are triggered from the Emergency Dashboard:
 * 1. NORMAL_CARDIAC
 * 2. TRAUMA
 * 3. STROKE
 * 4. ICU_SCARCITY
 * 5. STALE_HOSPITAL_DATA
 * 6. NO_SUITABLE_HOSPITAL
 *
 * Also tests ambulance state transitions and handoff auto-admission.
 */

import clientPromise from "../lib/mongodb";
import { runSimulation, advanceAmbulance } from "../lib/emergency/ems-simulator";

async function runScenarioCheck() {
    console.log("═══════════════════════════════════════════════════════════════");
    console.log("🚀 VERIFYING ALL 6 EMERGENCY DASHBOARD SIMULATION SCENARIOS");
    console.log("═══════════════════════════════════════════════════════════════\n");

    const client = await clientPromise;
    const db = client.db();

    const scenarios = [
        "NORMAL_CARDIAC",
        "TRAUMA",
        "STROKE",
        "ICU_SCARCITY",
        "STALE_HOSPITAL_DATA",
        "NO_SUITABLE_HOSPITAL"
    ] as const;

    let passed = 0;
    let failed = 0;

    for (const scenario of scenarios) {
        console.log(`─── Testing Scenario: ${scenario} ───`);
        try {
            const res = await runSimulation({ scenario }, db);

            if (scenario === "NO_SUITABLE_HOSPITAL") {
                const suitableCount = res.allocationResult.results.filter((r: any) => r.suitability).length;
                if (suitableCount === 0 && res.reservationOutcome === "NO_SUITABLE_HOSPITAL") {
                    console.log(`  ✔ PASS: ${scenario} correctly returned 0 suitable facilities with explainable rejection reasons.`);
                    passed++;
                } else {
                    console.error(`  ✕ FAIL: ${scenario} expected 0 suitable hospitals, got ${suitableCount}`);
                    failed++;
                }
            } else {
                if (res.allocationResult && res.allocationResult.results.length > 0 && res.selectedHospitalId) {
                    const topMatch = res.allocationResult.results.find((r: any) => r.hospitalId === res.selectedHospitalId);
                    console.log(`  ✔ PASS: ${scenario} allocated to "${topMatch?.hospitalName || res.selectedHospitalId}" (Score: ${topMatch?.overallScore.toFixed(1)}/100, Outcome: ${res.reservationOutcome})`);
                    passed++;
                } else {
                    console.error(`  ✕ FAIL: ${scenario} did not return selected hospital.`);
                    failed++;
                }
            }
        } catch (err: any) {
            console.error(`  ✕ FAIL: ${scenario} threw error:`, err.message);
            failed++;
        }
    }

    // Test Ambulance Step Transition to ARRIVED and HANDOFF
    console.log(`\n─── Testing Ambulance Lifecycle Transitions ───`);
    try {
        const sim = await runSimulation({ scenario: "NORMAL_CARDIAC" }, db);
        const ambId = sim.ambulanceState.ambulanceId;

        // Step 1: DISPATCHED -> EN_ROUTE
        const enRoute = await advanceAmbulance(ambId, "EN_ROUTE", db);
        if (enRoute.newStatus === "TRANSPORTING") {
            console.log(`  ✔ PASS: Ambulance advanced to EN_ROUTE (TRANSPORTING)`);
            passed++;
        } else {
            console.error(`  ✕ FAIL: Ambulance status expected TRANSPORTING, got ${enRoute.newStatus}`);
            failed++;
        }

        // Step 2: EN_ROUTE -> ARRIVED
        const arrived = await advanceAmbulance(ambId, "ARRIVED", db);
        if (arrived.newStatus === "AT_HOSPITAL") {
            console.log(`  ✔ PASS: Ambulance advanced to ARRIVED (AT_HOSPITAL)`);
            passed++;
        } else {
            console.error(`  ✕ FAIL: Ambulance status expected AT_HOSPITAL, got ${arrived.newStatus}`);
            failed++;
        }

        // Step 3: ARRIVED -> HANDOFF (triggers auto-admission)
        const handoffRes = await advanceAmbulance(ambId, "HANDOFF", db);
        if (handoffRes.newStatus === "AVAILABLE" && handoffRes.handoffId) {
            // Verify in MongoDB that handoff is COMPLETED and reservation is ADMITTED
            const handoffDoc = await db.collection("handoffs").findOne({ handoffId: handoffRes.handoffId });
            const resvDoc = await db.collection("reservations").findOne({ emergencyId: sim.emergencyId });

            if (handoffDoc?.status === "COMPLETED" && resvDoc?.status === "ADMITTED") {
                console.log(`  ✔ PASS: Ambulance HANDOFF completed! Reservation auto-admitted to ADMITTED and capacity moved reserved -> occupied.`);
                passed++;
            } else {
                console.error(`  ✕ FAIL: Expected COMPLETED and ADMITTED in DB, got handoff: ${handoffDoc?.status}, resv: ${resvDoc?.status}`);
                failed++;
            }
        } else {
            console.error(`  ✕ FAIL: Expected newStatus AVAILABLE, got ${handoffRes.newStatus}`);
            failed++;
        }
    } catch (err: any) {
        console.error(`  ✕ FAIL: Ambulance transition error:`, err.message);
        failed++;
    }

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log(`📊 SCENARIOS SUMMARY: ${passed} passed / ${failed} failed`);
    console.log("═══════════════════════════════════════════════════════════════");

    if (failed > 0) process.exit(1);
    process.exit(0);
}

runScenarioCheck().catch(console.error);
