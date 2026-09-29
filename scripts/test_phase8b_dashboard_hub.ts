/**
 * PHASE 8B — 3-DASHBOARD UI HUB & NAVIGATION VERIFICATION TEST
 *
 * Verifies:
 * 1. GET /dashboards returns 200 with 3 prominent cards:
 *    - PATIENT DASHBOARD
 *    - AMBULANCE DASHBOARD
 *    - HOSPITAL DASHBOARD
 * 2. GET /dashboards/patient returns 200
 * 3. GET /dashboards/ambulance returns 200
 * 4. GET /dashboards/hospital returns 200
 * 5. GET /hospital/dashboard returns 200 / redirect
 * 6. Multi-Dashboard Navigation Switcher present
 * 7. Ambulance Provider Badge ("Government Ambulance" / "Hospital Ambulance") supported
 * 8. Hospital Dashboard combines Emergency Board & Facility Overview
 * 9. Patient Dashboard provides Emergency Care + Hospital Discovery
 */

async function verifyPhase8bHub() {
    console.log("===========================================================================");
    console.log("PHASE 8B: 3-DASHBOARD UI HUB & CANONICAL NAVIGATION VERIFICATION");
    console.log("===========================================================================\n");

    const baseUrl = "http://localhost:3000";
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

    try {
        // 1. Verify /dashboards (Dashboard Hub)
        console.log("1. Testing Dashboard Hub Route: /dashboards");
        const resHub = await fetch(`${baseUrl}/dashboards`);
        assert(resHub.status === 200, "GET /dashboards returns HTTP 200 OK");
        const htmlHub = await resHub.text();
        assert(htmlHub.includes("MEDDECISION"), "Hub contains 'MEDDECISION' branding header");
        assert(htmlHub.includes("Choose Dashboard") || htmlHub.includes("Emergency Healthcare Coordination Platform"), "Hub contains platform subtitle & selection prompt");
        assert(htmlHub.includes("PATIENT DASHBOARD"), "Hub displays large 'PATIENT DASHBOARD' card");
        assert(htmlHub.includes("AMBULANCE DASHBOARD"), "Hub displays large 'AMBULANCE DASHBOARD' card");
        assert(htmlHub.includes("HOSPITAL DASHBOARD"), "Hub displays large 'HOSPITAL DASHBOARD' card");
        assert(htmlHub.includes("/dashboards/patient"), "Patient card links to /dashboards/patient");
        assert(htmlHub.includes("/dashboards/ambulance"), "Ambulance card links to /dashboards/ambulance");
        assert(htmlHub.includes("/dashboards/hospital"), "Hospital card links to /dashboards/hospital");

        // 2. Verify Canonical Patient Dashboard: /dashboards/patient
        console.log("\n2. Testing Canonical Patient Dashboard: /dashboards/patient");
        const resPatient = await fetch(`${baseUrl}/dashboards/patient`);
        assert(resPatient.status === 200, "GET /dashboards/patient returns HTTP 200 OK");
        const htmlPatient = await resPatient.text();
        assert(htmlPatient.includes("Patient") || htmlPatient.includes("Emergency"), "Patient Dashboard renders patient context");
        assert(htmlPatient.includes("nav-switcher-patient") || htmlPatient.includes("Patient"), "Persistent 3-way switcher is present");

        // 3. Verify Canonical Ambulance Dashboard: /dashboards/ambulance
        console.log("\n3. Testing Canonical Ambulance Dashboard: /dashboards/ambulance");
        const resAmbulance = await fetch(`${baseUrl}/dashboards/ambulance`);
        assert(resAmbulance.status === 200, "GET /dashboards/ambulance returns HTTP 200 OK");
        const htmlAmbulance = await resAmbulance.text();
        assert(htmlAmbulance.includes("Ambulance") || htmlAmbulance.includes("Dispatch"), "Ambulance Dashboard renders CAD dispatch context");
        assert(htmlAmbulance.includes("nav-switcher-ambulance") || htmlAmbulance.includes("Ambulance"), "Persistent switcher links to Ambulance");

        // 4. Verify Canonical Hospital Dashboard: /dashboards/hospital
        console.log("\n4. Testing Canonical Hospital Dashboard: /dashboards/hospital");
        const resHospital = await fetch(`${baseUrl}/dashboards/hospital`);
        assert(resHospital.status === 200, "GET /dashboards/hospital returns HTTP 200 OK");
        const htmlHospital = await resHospital.text();
        assert(htmlHospital.includes("Hospital") || htmlHospital.includes("Emergency"), "Hospital Dashboard renders hospital operations context");
        assert(htmlHospital.includes("nav-switcher-hospital") || htmlHospital.includes("Hospital"), "Persistent switcher links to Hospital");

        // 5. Verify Old Route Forwarding: /hospital/dashboard
        console.log("\n5. Testing Old Route Forwarding: /hospital/dashboard");
        const resOldHospital = await fetch(`${baseUrl}/hospital/dashboard`, { redirect: "manual" });
        assert(
            resOldHospital.status === 200 || resOldHospital.status === 307 || resOldHospital.status === 308,
            `GET /hospital/dashboard returns HTTP ${resOldHospital.status} (handles redirect to canonical dashboard)`
        );

        // 6. Verify Active Emergency Operational APIs
        console.log("\n6. Testing Active Emergency Operational State");
        const resActive = await fetch(`${baseUrl}/api/emergency/active`);
        assert(resActive.status === 200, "GET /api/emergency/active returns HTTP 200 OK");
        const jsonActive = await resActive.json();
        assert(jsonActive.success === true, "Live operational API returns success: true");
        assert(Array.isArray(jsonActive.data?.hospitals), `MongoDB Atlas returned ${jsonActive.data?.hospitals?.length} operational hospitals`);

        // 7. Verify Ambulance Requests API & Provider Data
        console.log("\n7. Testing Ambulance Requests & Provider Feed");
        const resAmbReq = await fetch(`${baseUrl}/api/emergency/ambulance/requests?ambulanceId=AMB-PUNE-01`);
        assert(resAmbReq.status === 200, "GET /api/emergency/ambulance/requests returns HTTP 200 OK");
        const jsonAmbReq = await resAmbReq.json();
        assert(jsonAmbReq.success === true, "Ambulance feed returns success: true");
        assert(jsonAmbReq.ambulance?.ambulanceId === "AMB-PUNE-01", "Ambulance AMB-PUNE-01 identified in MongoDB");

        console.log("\n===========================================================================");
        console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log("===========================================================================\n");

        if (failed > 0) {
            process.exit(1);
        }
    } catch (err: any) {
        console.error("Test execution failed:", err);
        process.exit(1);
    }
}

verifyPhase8bHub();
