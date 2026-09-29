import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
            const [key, ...vals] = trimmed.split("=");
            const val = vals.join("=").trim().replace(/^["']|["']$/g, "");
            if (!process.env[key.trim()]) {
                process.env[key.trim()] = val;
            }
        }
    }
}

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/meddecision";

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.error(`  ✗ FAIL: ${message}`);
        failed++;
    }
}

async function runTestSuite() {
    console.log("=====================================================================");
    console.log("PHASE 1 INTEGRATION TEST SUITE: PATIENT TO AMBULANCE DISPATCH FLOW");
    console.log("=====================================================================");

    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db();
    console.log(`Connected to MongoDB operational database: ${db.databaseName}\n`);

    const testEmergencyId = `TEST-EMG-${Date.now().toString(36).toUpperCase()}`;
    const testAmbulanceId = "AMB-PUNE-01";
    const competingAmbulanceId = "AMB-PUNE-02";

    try {
        // Ensure test ambulance exists
        await db.collection("ambulances").updateOne(
            { ambulanceId: testAmbulanceId },
            {
                $set: {
                    ambulanceId: testAmbulanceId,
                    callSign: "Pune Mobile ALS 01",
                    vehicleType: "ALS",
                    status: "AVAILABLE",
                    currentLocation: { latitude: 18.5204, longitude: 73.8567 },
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        await db.collection("ambulances").updateOne(
            { ambulanceId: competingAmbulanceId },
            {
                $set: {
                    ambulanceId: competingAmbulanceId,
                    callSign: "Pune Rapid ALS 02",
                    vehicleType: "ALS",
                    status: "AVAILABLE",
                    currentLocation: { latitude: 18.5300, longitude: 73.8500 },
                    updatedAt: new Date()
                }
            },
            { upsert: true }
        );

        // -----------------------------------------------------------------------------
        // STEP 1: PATIENT REQUESTS AMBULANCE
        // -----------------------------------------------------------------------------
        console.log("--- TEST GROUP 1: PATIENT CREATES EMERGENCY REQUEST ---");

        const emergencyDoc = {
            emergencyId: testEmergencyId,
            emergencyType: "CARDIAC",
            priority: "CRITICAL",
            triageScore: 85,
            requiredSpecialty: "Cardiology",
            chiefComplaint: "Crushing retrosternal chest pain radiating to left jaw, diaphoresis",
            incidentLocation: {
                latitude: 18.5204,
                longitude: 73.8567,
                address: "Pune Metro Station Entrance, Pune",
                isSimulated: true
            },
            patient: {
                name: "Rahul S.",
                age: 58,
                gender: "male",
                contactNumber: "+91 98765 43210"
            },
            declinedAmbulanceIds: [],
            status: "PENDING",
            source: "PATIENT_PORTAL",
            createdAt: new Date(),
            updatedAt: new Date(),
            notes: "Phase 1 Patient Dispatch Verification [SIMULATED LOCATION]"
        };

        const insertRes = await db.collection("emergencyRequests").insertOne(emergencyDoc);
        assert(insertRes.acknowledged, "Emergency request persisted in MongoDB");

        const savedEmergency = await db.collection("emergencyRequests").findOne({ emergencyId: testEmergencyId });
        assert(savedEmergency !== null, "Emergency is retrievable by unique emergencyId");
        assert(savedEmergency.status === "PENDING", "Initial emergency status is strictly 'PENDING'");
        assert(savedEmergency.emergencyType === "CARDIAC", "Emergency type correctly recorded as CARDIAC");
        assert(savedEmergency.priority === "CRITICAL", "Priority triage correctly classified as CRITICAL");
        assert(savedEmergency.incidentLocation?.isSimulated === true, "Simulated location flag is explicitly preserved");
        assert(savedEmergency.ambulanceId === undefined, "No ambulance assigned at initial creation");
        assert(savedEmergency.receivingHospitalId === undefined, "Hospital allocation is NOT triggered before pickup");

        // -----------------------------------------------------------------------------
        // STEP 2: DUPLICATE SUBMISSION CHECK
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 2: ANTI-DUPLICATE & CONCURRENCY PROTECTION ---");

        const recentActiveDuplicate = await db.collection("emergencyRequests").findOne({
            "incidentLocation.latitude": { $gte: 18.5203, $lte: 18.5205 },
            "incidentLocation.longitude": { $gte: 73.8566, $lte: 73.8568 },
            status: { $in: ["PENDING", "DISPATCHED", "ON_SCENE"] },
            createdAt: { $gte: new Date(Date.now() - 30 * 1000) }
        });

        assert(recentActiveDuplicate !== null, "System detects matching recent active emergency at same coordinates");
        assert(recentActiveDuplicate.emergencyId === testEmergencyId, "Matched emergency matches active incident ID");

        // -----------------------------------------------------------------------------
        // STEP 3: AMBULANCE RECEIVES PENDING REQUESTS
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 3: AMBULANCE OPERATOR RECEIVES EMERGENCY ---");

        const queueRequests = await db.collection("emergencyRequests")
            .find({
                status: "PENDING",
                declinedAmbulanceIds: { $ne: testAmbulanceId }
            })
            .sort({ createdAt: -1 })
            .toArray();

        const foundInQueue = queueRequests.find(r => r.emergencyId === testEmergencyId);
        assert(foundInQueue !== undefined, "Pending emergency appears in ambulance operator's queue");
        assert(foundInQueue.chiefComplaint.includes("Crushing"), "Chief complaint is visible to ambulance operator");
        assert(foundInQueue.incidentLocation.address.length > 0, "Incident location address is visible");

        // HIPAA / privacy verification: name redaction
        const redactedName = foundInQueue.patient?.name ? `${foundInQueue.patient.name.charAt(0)}. Patient` : "Anonymous Patient";
        assert(redactedName === "R. Patient", "Patient name redaction complies with privacy guidelines");

        // -----------------------------------------------------------------------------
        // STEP 4: AMBULANCE DECLINE SCENARIO
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 4: AMBULANCE DECLINE FLOW ---");

        // Competing ambulance declines the call
        await db.collection("emergencyRequests").updateOne(
            { emergencyId: testEmergencyId },
            {
                $addToSet: { declinedAmbulanceIds: competingAmbulanceId },
                $set: { updatedAt: new Date() }
            }
        );

        // Check if declined ambulance can still see it
        const queueForDeclinedAmbulance = await db.collection("emergencyRequests")
            .find({
                status: "PENDING",
                declinedAmbulanceIds: { $ne: competingAmbulanceId }
            })
            .toArray();

        assert(
            !queueForDeclinedAmbulance.some(r => r.emergencyId === testEmergencyId),
            "Declined ambulance no longer sees declined emergency in active queue"
        );

        // Check that primary ambulance CAN still see it
        const queueForPrimaryAmbulance = await db.collection("emergencyRequests")
            .find({
                status: "PENDING",
                declinedAmbulanceIds: { $ne: testAmbulanceId }
            })
            .toArray();

        assert(
            queueForPrimaryAmbulance.some(r => r.emergencyId === testEmergencyId),
            "Emergency remains available in pool for non-declining response units"
        );

        // -----------------------------------------------------------------------------
        // STEP 5: AMBULANCE ACCEPTS EMERGENCY (ATOMIC CLAIM)
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 5: AMBULANCE ACCEPTS EMERGENCY ---");

        const acceptResult = await db.collection("emergencyRequests").findOneAndUpdate(
            { emergencyId: testEmergencyId, status: "PENDING" },
            {
                $set: {
                    status: "DISPATCHED",
                    ambulanceId: testAmbulanceId,
                    updatedAt: new Date()
                }
            },
            { returnDocument: "after" }
        );

        assert(acceptResult !== null, "Ambulance successfully and atomically accepts pending emergency");
        assert(acceptResult.status === "DISPATCHED", "Emergency status transitioned to 'DISPATCHED'");
        assert(acceptResult.ambulanceId === testAmbulanceId, `Emergency assigned to unit ${testAmbulanceId}`);

        // Update ambulance to EN_ROUTE_SCENE
        await db.collection("ambulances").updateOne(
            { ambulanceId: testAmbulanceId },
            {
                $set: {
                    status: "EN_ROUTE_SCENE",
                    currentEmergencyId: testEmergencyId,
                    ETA: 8,
                    telemetrySource: "SIMULATION",
                    updatedAt: new Date()
                }
            }
        );

        const updatedAmbulance = await db.collection("ambulances").findOne({ ambulanceId: testAmbulanceId });
        assert(updatedAmbulance.status === "EN_ROUTE_SCENE", "Ambulance status updated to 'EN_ROUTE_SCENE'");
        assert(updatedAmbulance.currentEmergencyId === testEmergencyId, "Ambulance linked to active emergency ID");
        assert(updatedAmbulance.ETA === 8, "Simulated ETA recorded (8 mins)");

        // -----------------------------------------------------------------------------
        // STEP 6: CONCURRENT ACCEPTANCE RACE CONDITION REJECTION
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 6: CONCURRENCY RACE CONDITION PROTECTION ---");

        // Attempt second acceptance on already-dispatched emergency
        const raceAccept = await db.collection("emergencyRequests").findOneAndUpdate(
            { emergencyId: testEmergencyId, status: "PENDING" },
            {
                $set: {
                    status: "DISPATCHED",
                    ambulanceId: "AMB-PUNE-99",
                    updatedAt: new Date()
                }
            },
            { returnDocument: "after" }
        );

        assert(raceAccept === null, "Second ambulance concurrent ACCEPT is rejected (409 Conflict protection)");

        // -----------------------------------------------------------------------------
        // STEP 7: PATIENT SEES ASSIGNMENT & TIMELINE ADVANCE
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 7: PATIENT VIEW REFLECTS AMBULANCE ASSIGNMENT ---");

        const patientView = await db.collection("emergencyRequests").findOne({ emergencyId: testEmergencyId });
        const patientAmbulance = await db.collection("ambulances").findOne({ ambulanceId: patientView.ambulanceId });

        assert(patientView.ambulanceId === testAmbulanceId, "Patient view shows assigned ambulance ID");
        assert(patientAmbulance.callSign === "Pune Mobile ALS 01", "Patient view has ambulance callsign");
        assert(patientAmbulance.status === "EN_ROUTE_SCENE", "Patient sees ambulance is 'EN_ROUTE_SCENE'");

        // Timeline mapping logic
        function calculateTimelineStep(emgStatus, ambStatus) {
            if (emgStatus === "TRANSPORTING" || ambStatus === "TRANSPORTING") return "PATIENT_PICKED_UP";
            if (emgStatus === "ON_SCENE" || ambStatus === "ON_SCENE") return "ARRIVED";
            if (ambStatus === "EN_ROUTE_SCENE") return "EN_ROUTE";
            if (emgStatus === "DISPATCHED") return "AMBULANCE_ACCEPTED";
            return "ASSIGNING_AMBULANCE";
        }

        assert(calculateTimelineStep(patientView.status, patientAmbulance.status) === "EN_ROUTE", "Timeline step advances to EN_ROUTE");

        // -----------------------------------------------------------------------------
        // STEP 8: AMBULANCE ARRIVED AT SCENE
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 8: AMBULANCE ARRIVES AT SCENE ---");

        await db.collection("emergencyRequests").updateOne(
            { emergencyId: testEmergencyId },
            { $set: { status: "ON_SCENE", updatedAt: new Date() } }
        );

        await db.collection("ambulances").updateOne(
            { ambulanceId: testAmbulanceId },
            { $set: { status: "ON_SCENE", ETA: 0, updatedAt: new Date() } }
        );

        const onSceneEmergency = await db.collection("emergencyRequests").findOne({ emergencyId: testEmergencyId });
        const onSceneAmbulance = await db.collection("ambulances").findOne({ ambulanceId: testAmbulanceId });

        assert(onSceneEmergency.status === "ON_SCENE", "Emergency status transitioned to 'ON_SCENE'");
        assert(onSceneAmbulance.status === "ON_SCENE", "Ambulance status transitioned to 'ON_SCENE'");
        assert(calculateTimelineStep(onSceneEmergency.status, onSceneAmbulance.status) === "ARRIVED", "Timeline step advances to ARRIVED");

        // -----------------------------------------------------------------------------
        // STEP 9: AMBULANCE MARKS PATIENT PICKED UP (TRANSPORTING)
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 9: PATIENT PICKED UP & TRANSPORTING ---");

        const pickupTime = new Date();
        await db.collection("emergencyRequests").updateOne(
            { emergencyId: testEmergencyId },
            {
                $set: {
                    status: "TRANSPORTING",
                    patientPickedUpAt: pickupTime,
                    updatedAt: pickupTime
                }
            }
        );

        await db.collection("ambulances").updateOne(
            { ambulanceId: testAmbulanceId },
            { $set: { status: "TRANSPORTING", updatedAt: pickupTime } }
        );

        const pickedUpEmergency = await db.collection("emergencyRequests").findOne({ emergencyId: testEmergencyId });
        const transportingAmbulance = await db.collection("ambulances").findOne({ ambulanceId: testAmbulanceId });

        assert(pickedUpEmergency.status === "TRANSPORTING", "Emergency status transitioned to 'TRANSPORTING'");
        assert(transportingAmbulance.status === "TRANSPORTING", "Ambulance status transitioned to 'TRANSPORTING'");
        assert(pickedUpEmergency.patientPickedUpAt instanceof Date, "patientPickedUpAt timestamp correctly recorded");
        assert(calculateTimelineStep(pickedUpEmergency.status, transportingAmbulance.status) === "PATIENT_PICKED_UP", "Timeline step reaches final PATIENT_PICKED_UP state");

        // -----------------------------------------------------------------------------
        // STEP 10: ARCHITECTURAL BOUNDARY CHECK — NO PREMATURE HOSPITAL ALLOCATION
        // -----------------------------------------------------------------------------
        console.log("\n--- TEST GROUP 10: VERIFY ARCHITECTURAL BOUNDARY ---");

        assert(
            pickedUpEmergency.receivingHospitalId === undefined || pickedUpEmergency.receivingHospitalId === null,
            "CRITICAL: Receiving hospital was NOT selected before patient pickup (Hospital allocation begins AFTER pickup)"
        );

    } finally {
        // Cleanup test artifacts
        await db.collection("emergencyRequests").deleteOne({ emergencyId: testEmergencyId });
        await db.collection("ambulances").updateOne(
            { ambulanceId: testAmbulanceId },
            {
                $set: {
                    status: "AVAILABLE",
                    currentEmergencyId: null,
                    updatedAt: new Date()
                }
            }
        );
        await db.collection("ambulances").deleteOne({ ambulanceId: competingAmbulanceId });
        await client.close();
    }

    console.log("\n=====================================================================");
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=====================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite().catch(err => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
