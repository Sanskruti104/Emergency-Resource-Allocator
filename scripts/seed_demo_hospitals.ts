/**
 * DEMO Hospital Seed Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates 5 realistic DEMO hospital operational records in the `hospitals`
 * collection of the `meddecision` database.
 *
 * IMPORTANT:
 *  - These are NOT real hospitals. They exist purely for demo / hackathon use.
 *  - Every document is marked with dataSource: "DEMO_OPERATIONAL_SEED" and isDemo: true.
 *  - The script is fully IDEMPOTENT (uses upsert on stable uid keys).
 *    Running it twice will NOT create duplicate records.
 *  - Documents are fully compatible with the existing hospital dashboard schema
 *    AND with the four-bucket reservation capacity model.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed_demo_hospitals.ts
 *   npx tsx --env-file=.env.local scripts/seed_demo_hospitals.ts --dry-run
 */

import { MongoClient } from "mongodb";

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Stable hospital IDs (never change these — idempotency relies on them) ──
const HOSPITALS: Record<string, any>[] = [

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 1. Strong Cardiac / Cath-Lab Hospital
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        uid: "DEMO-HOSP-CARDIAC-001",
        hospitalName: "Apex Heart & Vascular Institute (Demo)",
        email: "admin@apex-heart-demo.local",
        address: "12, Baner Road, Pune – 411045",
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        latitude: 18.5620,
        longitude: 73.7769,
        phone: "+91-20-12340001",
        website: "https://demo.apexheart.local",
        registrationNumber: "DEMO-MH-CARDIAC-001",
        specialties: [
            "Cardiology",
            "Interventional Cardiology",
            "Cardiac Surgery",
            "Critical Care",
            "Emergency Medicine"
        ],
        capacity: {
            // Existing schema fields (preserved for dashboard compatibility)
            totalBeds: 180,
            availableBeds: 42,
            icuBeds: 24,
            operationTheatres: 4,
            onDutySpecialist: 6,
            emergencyAvailable: true,
            // Extended four-bucket reservation fields
            availableIcuBeds: 8,
            occupiedIcuBeds: 16,
            reservedIcuBeds: 0,
            occupiedBeds: 138,
            reservedBeds: 0,
            availableOTs: 2,
            reservedOTs: 0,
            totalVentilators: 18,
            availableVentilators: 6,
            occupiedVentilators: 12,
            reservedVentilators: 0,
            updatedAt: new Date()
        },
        instruments: {
            available: [
                "cath_lab_system",
                "angiography_system",
                "ecmo_machine",
                "intra_aortic_balloon_pump",
                "icu_monitor",
                "multipara_monitor",
                "ventilator",
                "defibrillator",
                "ct_scanner",
                "echocardiography"
            ]
        },
        doctors: [],
        insurance: { accepted: ["ESI", "CGHS", "Star Health", "HDFC Ergo"] },
        treatments: [],
        media: [],
        isDemo: true,
        dataSource: "DEMO_OPERATIONAL_SEED",
        simulationProfile: "CARDIAC_SPECIALIST",
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 2. Strong Trauma / Surgery Hospital
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        uid: "DEMO-HOSP-TRAUMA-002",
        hospitalName: "CityGuard Trauma & Emergency Centre (Demo)",
        email: "admin@cityguard-trauma-demo.local",
        address: "88, Nagar Road, Yerwada, Pune – 411006",
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        latitude: 18.5524,
        longitude: 73.8866,
        phone: "+91-20-12340002",
        website: "https://demo.cityguardtrauma.local",
        registrationNumber: "DEMO-MH-TRAUMA-002",
        specialties: [
            "Trauma Surgery",
            "Orthopaedic Surgery",
            "General Surgery",
            "Neurosurgery",
            "Emergency Medicine",
            "Critical Care",
            "Burn Care"
        ],
        capacity: {
            totalBeds: 250,
            availableBeds: 68,
            icuBeds: 30,
            operationTheatres: 6,
            onDutySpecialist: 8,
            emergencyAvailable: true,
            availableIcuBeds: 10,
            occupiedIcuBeds: 20,
            reservedIcuBeds: 0,
            occupiedBeds: 182,
            reservedBeds: 0,
            availableOTs: 3,
            reservedOTs: 0,
            totalVentilators: 22,
            availableVentilators: 8,
            occupiedVentilators: 14,
            reservedVentilators: 0,
            updatedAt: new Date()
        },
        instruments: {
            available: [
                "trauma_bay",
                "emergency_resuscitation",
                "icu_monitor",
                "multipara_monitor",
                "ventilator",
                "ct_scanner",
                "imaging_suite",
                "anesthesia_workstation",
                "surgical_suite",
                "oxygen_supply",
                "defibrillator"
            ]
        },
        doctors: [],
        insurance: { accepted: ["ESI", "CGHS", "PMJAY", "Niva Bupa", "HDFC Ergo"] },
        treatments: [],
        media: [],
        isDemo: true,
        dataSource: "DEMO_OPERATIONAL_SEED",
        simulationProfile: "TRAUMA_SPECIALIST",
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 3. Stroke / Neurology Centre
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        uid: "DEMO-HOSP-NEURO-003",
        hospitalName: "NeuroShield Brain & Spine Hospital (Demo)",
        email: "admin@neuroshield-demo.local",
        address: "34, Senapati Bapat Road, Pune – 411016",
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        latitude: 18.5260,
        longitude: 73.8366,
        phone: "+91-20-12340003",
        website: "https://demo.neuroshield.local",
        registrationNumber: "DEMO-MH-NEURO-003",
        specialties: [
            "Neurology",
            "Neurosurgery",
            "Stroke Care",
            "Critical Care",
            "Emergency Medicine",
            "Interventional Neurology"
        ],
        capacity: {
            totalBeds: 150,
            availableBeds: 35,
            icuBeds: 20,
            operationTheatres: 3,
            onDutySpecialist: 5,
            emergencyAvailable: true,
            availableIcuBeds: 7,
            occupiedIcuBeds: 13,
            reservedIcuBeds: 0,
            occupiedBeds: 115,
            reservedBeds: 0,
            availableOTs: 1,
            reservedOTs: 0,
            totalVentilators: 14,
            availableVentilators: 5,
            occupiedVentilators: 9,
            reservedVentilators: 0,
            updatedAt: new Date()
        },
        instruments: {
            available: [
                "ct_scanner",
                "mri",
                "imaging_suite",
                "icu_monitor",
                "multipara_monitor",
                "ventilator",
                "anesthesia_workstation",
                "surgical_suite",
                "oxygen_supply",
                "defibrillator",
                "eeg_machine",
                "tpa_protocol_kit"
            ]
        },
        doctors: [],
        insurance: { accepted: ["ESI", "CGHS", "Star Health", "PMJAY"] },
        treatments: [],
        media: [],
        isDemo: true,
        dataSource: "DEMO_OPERATIONAL_SEED",
        simulationProfile: "STROKE_SPECIALIST",
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 4. General Emergency Hospital
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        uid: "DEMO-HOSP-GENERAL-004",
        hospitalName: "SafeHaven Multi-Specialty Hospital (Demo)",
        email: "admin@safehaven-demo.local",
        address: "210, Karve Road, Kothrud, Pune – 411038",
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        latitude: 18.5070,
        longitude: 73.8205,
        phone: "+91-20-12340004",
        website: "https://demo.safehaven.local",
        registrationNumber: "DEMO-MH-GENERAL-004",
        specialties: [
            "Emergency Medicine",
            "General Surgery",
            "Internal Medicine",
            "Orthopaedics",
            "Obstetrics",
            "Paediatrics",
            "Critical Care"
        ],
        capacity: {
            totalBeds: 300,
            availableBeds: 90,
            icuBeds: 25,
            operationTheatres: 5,
            onDutySpecialist: 7,
            emergencyAvailable: true,
            availableIcuBeds: 9,
            occupiedIcuBeds: 16,
            reservedIcuBeds: 0,
            occupiedBeds: 210,
            reservedBeds: 0,
            availableOTs: 2,
            reservedOTs: 0,
            totalVentilators: 20,
            availableVentilators: 7,
            occupiedVentilators: 13,
            reservedVentilators: 0,
            updatedAt: new Date()
        },
        instruments: {
            available: [
                "icu_monitor",
                "multipara_monitor",
                "ventilator",
                "ct_scanner",
                "imaging_suite",
                "oxygen_supply",
                "defibrillator",
                "anesthesia_workstation",
                "surgical_suite",
                "trauma_bay"
            ]
        },
        doctors: [],
        insurance: { accepted: ["ESI", "CGHS", "PMJAY", "HDFC Ergo", "Bajaj Allianz", "Niva Bupa"] },
        treatments: [],
        media: [],
        isDemo: true,
        dataSource: "DEMO_OPERATIONAL_SEED",
        simulationProfile: "GENERAL_EMERGENCY",
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 5. Constrained Capacity Hospital
    //    (Intentionally low ICU + limited equipment)
    //    Used for ICU_SCARCITY and allocation stress tests
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        uid: "DEMO-HOSP-CONSTRAINED-005",
        hospitalName: "Riverside District Hospital (Demo)",
        email: "admin@riverside-demo.local",
        address: "5, Sinhagad Road, Dhayari, Pune – 411041",
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        latitude: 18.4673,
        longitude: 73.8123,
        phone: "+91-20-12340005",
        website: "https://demo.riversidedist.local",
        registrationNumber: "DEMO-MH-CONSTRAINED-005",
        specialties: [
            "Emergency Medicine",
            "General Medicine",
            "General Surgery"
        ],
        capacity: {
            totalBeds: 80,
            availableBeds: 12,
            icuBeds: 4,          // ← intentionally constrained ICU
            operationTheatres: 1,
            onDutySpecialist: 2,
            emergencyAvailable: true,
            availableIcuBeds: 1, // ← only 1 ICU bed available — scarcity scenario
            occupiedIcuBeds: 3,
            reservedIcuBeds: 0,
            occupiedBeds: 68,
            reservedBeds: 0,
            availableOTs: 1,
            reservedOTs: 0,
            totalVentilators: 3,
            availableVentilators: 1,   // ← constrained
            occupiedVentilators: 2,
            reservedVentilators: 0,
            updatedAt: new Date()
        },
        instruments: {
            available: [
                "icu_monitor",
                "oxygen_supply",
                "defibrillator",
                "multipara_monitor"
                // No cath_lab, no trauma_bay, no ct_scanner
            ]
        },
        doctors: [],
        insurance: { accepted: ["PMJAY", "ESI"] },
        treatments: [],
        media: [],
        isDemo: true,
        dataSource: "DEMO_OPERATIONAL_SEED",
        simulationProfile: "CONSTRAINED_CAPACITY",
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

async function seedDemoHospitals() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("ERROR: MONGODB_URI not set");
        process.exit(1);
    }

    console.log("\n═══════════════════════════════════════════════════════════");
    console.log("🏥 DEMO HOSPITAL SEED SCRIPT");
    console.log("   dataSource: DEMO_OPERATIONAL_SEED | isDemo: true");
    if (DRY_RUN) console.log("   ⚠  DRY RUN — no data will be written");
    console.log("═══════════════════════════════════════════════════════════\n");

    if (DRY_RUN) {
        console.log(`Would upsert ${HOSPITALS.length} demo hospitals:`);
        HOSPITALS.forEach(h => console.log(`  • ${h.uid}  —  ${h.hospitalName}`));
        console.log("\n[DRY RUN COMPLETE] No records written.");
        return;
    }

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 });
    await client.connect();
    const db = client.db();
    const col = db.collection("hospitals");

    // Ensure index on uid (used by allocator)
    await col.createIndex({ uid: 1 }, { unique: true, sparse: true });

    let upserted = 0;
    let existing = 0;

    for (const hospital of HOSPITALS) {
        const result = await col.updateOne(
            { uid: hospital.uid },
            { $setOnInsert: hospital },
            { upsert: true }
        );

        if (result.upsertedCount > 0) {
            console.log(`  ✔ INSERTED  ${hospital.uid}  —  ${hospital.hospitalName}`);
            upserted++;
        } else {
            console.log(`  ─ SKIPPED   ${hospital.uid}  (already exists)`);
            existing++;
        }
    }

    const finalCount = await col.countDocuments({ dataSource: "DEMO_OPERATIONAL_SEED" });

    console.log("\n─── Summary ───────────────────────────────────────────────");
    console.log(`  Inserted : ${upserted}`);
    console.log(`  Skipped  : ${existing} (idempotent — already present)`);
    console.log(`  Total demo hospital docs in DB : ${finalCount}`);
    console.log("───────────────────────────────────────────────────────────");
    console.log("✅ Seed complete. No production records were modified.\n");

    await client.close();
    process.exit(0);
}

seedDemoHospitals().catch(err => {
    console.error("Seed script failed:", err);
    process.exit(1);
});
