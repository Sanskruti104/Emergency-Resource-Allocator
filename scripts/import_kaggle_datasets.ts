/**
 * MedDecision — Real-Time Emergency Resource Allocator
 * Kaggle Datasets to MongoDB Atlas Ingestion & Hospital Enrichment Pipeline
 *
 * Requirements:
 * - Reads Datasets/ems_events_20000.csv and Datasets/raw_weekly_hospital_respiratory_data_2020_2024.csv
 * - Idempotent upserts via bulkWrite (running twice will NOT duplicate records)
 * - Source metadata on every record (sourceDataset, sourceFile, importedAt, sourceRecordId)
 * - Enriches operational MongoDB hospitals with benchmark linkages (WITHOUT overwriting live capacity)
 * - Strict MongoDB Atlas usage (no mock DBs, no Firebase)
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { MongoClient, AnyBulkWriteOperation } from "mongodb";

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://riyawankhede24_db_user:0FStgjz5aMwj60hI@cluster0.atxl8em.mongodb.net/meddecision?appName=Cluster0";
const DB_NAME = "meddecision";

const DATASETS_DIR = path.resolve(process.cwd(), "Datasets");
const EMS_CSV_PATH = path.join(DATASETS_DIR, "ems_events_20000.csv");
const RESP_CSV_PATH = path.join(DATASETS_DIR, "raw_weekly_hospital_respiratory_data_2020_2024.csv");

const BATCH_SIZE = 2000;

// RFC 4180 CSV line parser
function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === "," && !inQuotes) {
            result.push(cur);
            cur = "";
        } else {
            cur += c;
        }
    }
    result.push(cur);
    return result;
}

function safeInt(val: any, fallback = 0): number {
    if (val === undefined || val === null || val === "") return fallback;
    const n = parseInt(String(val).replace(/,/g, "").trim(), 10);
    return isNaN(n) ? fallback : n;
}

function safeFloat(val: any, fallback = 0.0): number {
    if (val === undefined || val === null || val === "") return fallback;
    const n = parseFloat(String(val).replace(/,/g, "").trim());
    return isNaN(n) ? fallback : n;
}

export async function importKaggleDatasets() {
    console.log("======================================================================");
    console.log("PHASE 7: KAGGLE DATASETS → MONGODB OPERATIONAL INGESTION PIPELINE");
    console.log("======================================================================");
    console.log(`Connecting to MongoDB Atlas: ${DB_NAME}...`);

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    console.log("Connected to MongoDB successfully.\n");

    const importTimestamp = new Date();

    // ───────────────────────────────────────────────────────────────────
    // STEP 1: VERIFY DATASET FILES EXIST
    // ───────────────────────────────────────────────────────────────────
    console.log("--- STEP 1: VERIFY SOURCE FILES ---");
    if (!fs.existsSync(EMS_CSV_PATH)) {
        throw new Error(`EMS dataset file not found at: ${EMS_CSV_PATH}`);
    }
    const emsStats = fs.statSync(EMS_CSV_PATH);
    console.log(`  ✓ EMS dataset found: ${EMS_CSV_PATH} (${(emsStats.size / (1024 * 1024)).toFixed(2)} MB)`);

    if (!fs.existsSync(RESP_CSV_PATH)) {
        throw new Error(`Respiratory dataset file not found at: ${RESP_CSV_PATH}`);
    }
    const respStats = fs.statSync(RESP_CSV_PATH);
    console.log(`  ✓ Weekly respiratory dataset found: ${RESP_CSV_PATH} (${(respStats.size / (1024 * 1024)).toFixed(2)} MB)\n`);

    // ───────────────────────────────────────────────────────────────────
    // STEP 2: CREATE INDEXES ON DATASET COLLECTIONS (IDEMPOTENT)
    // ───────────────────────────────────────────────────────────────────
    console.log("--- STEP 2: ENSURE IDEMPOTENCY INDEXES ---");
    const emsCol = db.collection("ems_events");
    await emsCol.createIndex({ eventId: 1 }, { unique: true });
    await emsCol.createIndex({ condition: 1, triagePriority: 1 });
    await emsCol.createIndex({ timestamp: -1 });
    console.log("  ✓ ems_events indexes verified: { eventId: 1 } (unique)");

    const respCol = db.collection("hospital_capacity_benchmarks");
    await respCol.createIndex({ region: 1, weekEndingDate: 1 }, { unique: true });
    await respCol.createIndex({ weekEndingDate: -1 });
    await respCol.createIndex({ region: 1 });
    console.log("  ✓ hospital_capacity_benchmarks indexes verified: { region: 1, weekEndingDate: 1 } (unique)\n");

    // ───────────────────────────────────────────────────────────────────
    // STEP 3: INGEST EMS EVENTS DATASET
    // ───────────────────────────────────────────────────────────────────
    console.log("--- STEP 3: INGESTING EMS EVENTS DATASET (ems_events_20000.csv) ---");
    const emsRl = readline.createInterface({
        input: fs.createReadStream(EMS_CSV_PATH),
        crlfDelay: Infinity
    });

    let emsHeader: string[] = [];
    let emsLineIndex = 0;
    let emsOperations: AnyBulkWriteOperation[] = [];
    let emsTotalUpserted = 0;
    let emsTotalProcessed = 0;

    for await (const line of emsRl) {
        emsLineIndex++;
        if (!line.trim()) continue;

        if (emsLineIndex === 1) {
            emsHeader = parseCsvLine(line).map(h => h.trim());
            continue;
        }

        const cols = parseCsvLine(line);
        const eventId = cols[0]?.trim();
        if (!eventId) continue;

        const rawTs = cols[1]?.trim();
        let timestamp: Date;
        try {
            timestamp = new Date(rawTs);
            if (isNaN(timestamp.getTime())) timestamp = new Date();
        } catch {
            timestamp = new Date();
        }

        const condition = cols[2]?.trim().toLowerCase() || "emergency";
        const chiefComplaint = cols[3]?.trim() || "Acute emergency";
        const age = safeInt(cols[4], 45);
        const gender = (cols[5]?.trim().toLowerCase() || "unknown") as any;
        const sbp = safeInt(cols[6], 120);
        const heartRate = safeInt(cols[7], 80);
        const spo2 = safeInt(cols[8], 98);
        const gcs = safeInt(cols[9], 15);
        const triagePriority = cols[10]?.trim().toUpperCase() || "YELLOW";
        const targetHospitalType = cols[11]?.trim() || "general_emergency";
        const benchmarkHospitalId = cols[12]?.trim() || "H001";

        const doc = {
            eventId,
            timestamp,
            condition,
            chiefComplaint,
            patient: { age, gender },
            vitals: { sbp, heartRate, spo2, gcs },
            triagePriority,
            targetHospitalType,
            benchmarkHospitalId,
            metadata: {
                sourceDataset: "Emergency Medical Response Mapping Dataset",
                sourceFile: "ems_events_20000.csv",
                importedAt: importTimestamp,
                sourceRecordId: eventId
            }
        };

        emsOperations.push({
            updateOne: {
                filter: { eventId },
                update: { $set: doc },
                upsert: true
            }
        });

        emsTotalProcessed++;

        if (emsOperations.length >= BATCH_SIZE) {
            const res = await emsCol.bulkWrite(emsOperations, { ordered: false });
            emsTotalUpserted += (res.upsertedCount + res.modifiedCount);
            emsOperations = [];
            process.stdout.write(`  Processed ${emsTotalProcessed}/20000 EMS records...\r`);
        }
    }

    if (emsOperations.length > 0) {
        const res = await emsCol.bulkWrite(emsOperations, { ordered: false });
        emsTotalUpserted += (res.upsertedCount + res.modifiedCount);
        emsOperations = [];
    }

    const emsDbCount = await emsCol.countDocuments();
    console.log(`\n  ✓ EMS records processed: ${emsTotalProcessed}, Total in DB: ${emsDbCount}\n`);

    // ───────────────────────────────────────────────────────────────────
    // STEP 4: INGEST WEEKLY HOSPITAL RESPIRATORY DATASET
    // ───────────────────────────────────────────────────────────────────
    console.log("--- STEP 4: INGESTING WEEKLY RESPIRATORY BENCHMARKS (raw_weekly_hospital_respiratory_data_2020_2024.csv) ---");
    const respRl = readline.createInterface({
        input: fs.createReadStream(RESP_CSV_PATH),
        crlfDelay: Infinity
    });

    let respHeader: string[] = [];
    let respLineIndex = 0;
    let respOperations: AnyBulkWriteOperation[] = [];
    let respTotalProcessed = 0;

    // Header index lookup
    let idxDate = -1;
    let idxRegion = -1;
    let idxInpatientTotal = -1;
    let idxInpatientOcc = -1;
    let idxIcuTotal = -1;
    let idxIcuOcc = -1;
    let idxInpatientPct = -1;
    let idxIcuPct = -1;
    let idxCovid = -1;
    let idxFlu = -1;
    let idxRsv = -1;
    let idxInpatientRep = -1;
    let idxIcuRep = -1;

    for await (const line of respRl) {
        respLineIndex++;
        if (!line.trim()) continue;

        if (respLineIndex === 1) {
            respHeader = parseCsvLine(line).map(h => h.trim());
            idxDate = respHeader.indexOf("Week Ending Date");
            idxRegion = respHeader.indexOf("Geographic aggregation");
            idxInpatientTotal = respHeader.indexOf("Number of Inpatient Beds");
            idxInpatientOcc = respHeader.indexOf("Number of Inpatient Beds Occupied");
            idxIcuTotal = respHeader.indexOf("Number of ICU Beds");
            idxIcuOcc = respHeader.indexOf("Number of ICU Beds Occupied");
            idxInpatientPct = respHeader.indexOf("Percent Inpatient Beds Occupied");
            idxIcuPct = respHeader.indexOf("Percent ICU Beds Occupied");
            idxCovid = respHeader.indexOf("Total Patients Hospitalized with COVID-19");
            idxFlu = respHeader.indexOf("Total Patients Hospitalized with Influenza");
            idxRsv = respHeader.indexOf("Total Patients Hospitalized with RSV");
            idxInpatientRep = respHeader.indexOf("Number of Hospitals Reporting Inpatient Beds");
            idxIcuRep = respHeader.indexOf("Number of Hospitals Reporting ICU Beds");
            continue;
        }

        const cols = parseCsvLine(line);
        const rawDate = cols[idxDate]?.trim();
        const region = cols[idxRegion]?.trim().toUpperCase();
        if (!rawDate || !region) continue;

        let weekEndingDate: Date;
        try {
            weekEndingDate = new Date(rawDate);
            if (isNaN(weekEndingDate.getTime())) continue;
        } catch {
            continue;
        }

        const totalInpatientBeds = safeInt(cols[idxInpatientTotal]);
        const occupiedInpatientBeds = safeInt(cols[idxInpatientOcc]);
        const totalIcuBeds = safeInt(cols[idxIcuTotal]);
        const occupiedIcuBeds = safeInt(cols[idxIcuOcc]);
        const inpatientOccupancyRate = safeFloat(cols[idxInpatientPct]);
        const icuOccupancyRate = safeFloat(cols[idxIcuPct]);
        const covid = safeInt(cols[idxCovid]);
        const influenza = safeInt(cols[idxFlu]);
        const rsv = safeInt(cols[idxRsv]);
        const totalRespiratory = covid + influenza + rsv;

        const doc = {
            region,
            weekEndingDate,
            totalInpatientBeds,
            occupiedInpatientBeds,
            totalIcuBeds,
            occupiedIcuBeds,
            inpatientOccupancyRate: Math.round(inpatientOccupancyRate * 10000) / 10000,
            icuOccupancyRate: Math.round(icuOccupancyRate * 10000) / 10000,
            reportingHospitals: {
                inpatientReporting: safeInt(cols[idxInpatientRep]),
                icuReporting: safeInt(cols[idxIcuRep])
            },
            respiratorySurge: {
                covid,
                influenza,
                rsv,
                totalRespiratory
            },
            metadata: {
                sourceDataset: "Weekly Hospital Respiratory Data and Metrics",
                sourceFile: "raw_weekly_hospital_respiratory_data_2020_2024.csv",
                importedAt: importTimestamp,
                sourceRecordId: `${region}_${rawDate}`
            }
        };

        respOperations.push({
            updateOne: {
                filter: { region, weekEndingDate },
                update: { $set: doc },
                upsert: true
            }
        });

        respTotalProcessed++;

        if (respOperations.length >= BATCH_SIZE) {
            await respCol.bulkWrite(respOperations, { ordered: false });
            respOperations = [];
            process.stdout.write(`  Processed ${respTotalProcessed}/12768 weekly benchmark records...\r`);
        }
    }

    if (respOperations.length > 0) {
        await respCol.bulkWrite(respOperations, { ordered: false });
        respOperations = [];
    }

    const respDbCount = await respCol.countDocuments();
    console.log(`\n  ✓ Weekly benchmark records processed: ${respTotalProcessed}, Total in DB: ${respDbCount}\n`);

    // ───────────────────────────────────────────────────────────────────
    // STEP 5: ENRICH OPERATIONAL HOSPITALS WITH DATASET BENCHMARK METRICS
    // ───────────────────────────────────────────────────────────────────
    console.log("--- STEP 5: ENRICHING OPERATIONAL HOSPITALS (HISTORICAL REFERENCE) ---");
    console.log("  Policy: Adding reference historical baseline while strictly preserving live operational capacity.");

    const hospitalsCol = db.collection("hospitals");
    const operationalHospitals = await hospitalsCol.find({}).toArray();
    console.log(`  Found ${operationalHospitals.length} operational hospitals in MongoDB.`);

    // Mapping definition: Links operational hospitals to Kaggle dataset benchmark types
    const BENCHMARK_MAP: Record<string, {
        benchmarkHospitalId: string;
        targetHospitalType: string;
        benchmarkRegion: string;
        clinicalFocus: string;
    }> = {
        "DEMO-HOSP-CARDIAC-001": {
            benchmarkHospitalId: "H001",
            targetHospitalType: "cardiac_center",
            benchmarkRegion: "WA",
            clinicalFocus: "Cardiology & Interventional Cath Lab"
        },
        "DEMO-HOSP-TRAUMA-002": {
            benchmarkHospitalId: "H002",
            targetHospitalType: "level1_trauma_center",
            benchmarkRegion: "CA",
            clinicalFocus: "Trauma Surgery & Critical Care"
        },
        "DEMO-HOSP-NEURO-003": {
            benchmarkHospitalId: "H003",
            targetHospitalType: "stroke_center",
            benchmarkRegion: "NY",
            clinicalFocus: "Neurology & Comprehensive Stroke"
        },
        "DEMO-HOSP-GENERAL-004": {
            benchmarkHospitalId: "H004",
            targetHospitalType: "general_emergency",
            benchmarkRegion: "TX",
            clinicalFocus: "General Emergency Medicine"
        },
        "DEMO-HOSP-CONSTRAINED-005": {
            benchmarkHospitalId: "H005",
            targetHospitalType: "district_constrained_hospital",
            benchmarkRegion: "IL",
            clinicalFocus: "General Community Care & First Aid"
        }
    };

    let enrichedCount = 0;
    for (const hosp of operationalHospitals) {
        const hospId = hosp.uid || hosp.hospitalId;
        const mapping = BENCHMARK_MAP[hospId];

        if (mapping) {
            // Find recent average benchmark metrics from hospital_capacity_benchmarks
            const latestBenchmarks = await respCol.find({ region: mapping.benchmarkRegion })
                .sort({ weekEndingDate: -1 })
                .limit(10)
                .toArray();

            let avgIcuOcc = 0.75;
            let avgInpatientOcc = 0.78;
            let avgCovid = 15;
            let avgFlu = 5;

            if (latestBenchmarks.length > 0) {
                avgIcuOcc = latestBenchmarks.reduce((acc, b) => acc + (b.icuOccupancyRate || 0), 0) / latestBenchmarks.length;
                avgInpatientOcc = latestBenchmarks.reduce((acc, b) => acc + (b.inpatientOccupancyRate || 0), 0) / latestBenchmarks.length;
                avgCovid = Math.round(latestBenchmarks.reduce((acc, b) => acc + (b.respiratorySurge?.covid || 0), 0) / latestBenchmarks.length);
                avgFlu = Math.round(latestBenchmarks.reduce((acc, b) => acc + (b.respiratorySurge?.influenza || 0), 0) / latestBenchmarks.length);
            }

            // Count historical EMS incidents matching this hospital's clinical category
            const incidentConditionMap: Record<string, string> = {
                cardiac_center: "cardiac",
                level1_trauma_center: "trauma",
                stroke_center: "stroke",
                general_emergency: "emergency",
                critical_care_respiratory: "respiratory failure",
                district_constrained_hospital: "trauma"
            };

            const targetCondition = incidentConditionMap[mapping.targetHospitalType] || "cardiac";
            const historicalIncidentCount = await emsCol.countDocuments({ condition: targetCondition });

            const historicalBenchmark = {
                benchmarkHospitalId: mapping.benchmarkHospitalId,
                targetHospitalType: mapping.targetHospitalType,
                clinicalFocus: mapping.clinicalFocus,
                benchmarkRegion: mapping.benchmarkRegion,
                historicalOccupancyBaseline: {
                    inpatientOccupancyRate: Math.round(avgInpatientOcc * 100) / 100,
                    icuOccupancyRate: Math.round(avgIcuOcc * 100) / 100
                },
                respiratorySurgeBaseline: {
                    avgCovidPatients: avgCovid,
                    avgFluPatients: avgFlu
                },
                historicalEmsIncidentVolume: historicalIncidentCount,
                sourceDatasets: [
                    "Emergency Medical Response Mapping Dataset (ems_events_20000.csv)",
                    "Weekly Hospital Respiratory Data and Metrics (raw_weekly_hospital_respiratory_data_2020_2024.csv)"
                ],
                linkedAt: importTimestamp
            };

            // Update only historicalBenchmark field, keeping capacity untouched!
            await hospitalsCol.updateOne(
                { _id: hosp._id },
                { $set: { historicalBenchmark } }
            );

            console.log(`  ✓ Enriched: ${hosp.hospitalName} [${hospId}] → Benchmark ${mapping.benchmarkHospitalId} (${mapping.targetHospitalType})`);
            enrichedCount++;
        }
    }

    // ───────────────────────────────────────────────────────────────────
    // STEP 6: MONGODB AUDITABILITY REPORT
    // ───────────────────────────────────────────────────────────────────
    const finalHospitalCount = await hospitalsCol.countDocuments();
    const finalEmsCount = await emsCol.countDocuments();
    const finalRespCount = await respCol.countDocuments();
    const emergencyReqCount = await db.collection("emergencyRequests").countDocuments();
    const resCount = await db.collection("reservations").countDocuments();
    const ambCount = await db.collection("ambulances").countDocuments();

    console.log("\n======================================================================");
    console.log("MONGODB ATLAS DATASET INTEGRATION AUDIT REPORT");
    console.log("======================================================================");
    console.log(`MongoDB database:                   ${DB_NAME}`);
    console.log("Dataset collections created/updated:");
    console.log(`  - ems_events:                     ${finalEmsCount} documents`);
    console.log(`  - hospital_capacity_benchmarks:   ${finalRespCount} documents`);
    console.log("Operational collections (PRESERVED):");
    console.log(`  - hospitals:                      ${finalHospitalCount} documents`);
    console.log(`  - emergencyRequests:              ${emergencyReqCount} documents`);
    console.log(`  - reservations:                   ${resCount} documents`);
    console.log(`  - ambulances:                     ${ambCount} documents`);
    console.log("\nImported records:");
    console.log(`  - Dataset 1 (EMS Events):         ${finalEmsCount}`);
    console.log(`  - Dataset 2 (Weekly Respiratory): ${finalRespCount}`);
    console.log(`Hospital records linked/enriched:   ${enrichedCount} / ${finalHospitalCount}`);
    console.log(`Unmatched dataset records:          ${finalEmsCount - enrichedCount} (used for historical lookup / replay)`);
    console.log(`Operational hospital records:       ${finalHospitalCount}`);
    console.log("======================================================================\n");

    await client.close();
    return {
        success: true,
        finalEmsCount,
        finalRespCount,
        enrichedCount,
        finalHospitalCount
    };
}

if (require.main === module) {
    importKaggleDatasets()
        .then(() => {
            console.log("Ingestion completed successfully.");
            process.exit(0);
        })
        .catch(err => {
            console.error("Ingestion failed:", err);
            process.exit(1);
        });
}
