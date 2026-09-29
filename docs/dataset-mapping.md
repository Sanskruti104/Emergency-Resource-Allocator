# Dataset Mapping & Transformation Specification

**Project:** MedDecision: Real-Time Emergency Resource Allocator  
**Document:** Dataset to MongoDB Ingestion and Transformation Specification  
**Architecture:**  
```
Kaggle CSV → Import / Transform Pipeline → MongoDB (Atlas) → Live Simulation Engine → Emergency Allocator
```

---

## 1. Dataset 1: `Datasets/ems_events_20000.csv`

### 1.1 Dataset Profile
* **File Size:** ~2.1 MB
* **Total Rows:** 20,000 incident events
* **Total Columns:** 13
* **Missing Values:** 0 across all 20,000 rows (100% complete)
* **Date Range:** `2026-01-01` to `2026-05-31` (Synthesized real-time scenario timestamps)
* **Target MongoDB Collection:** `ems_events` (historical events collection powering live simulation)

### 1.2 Column Mapping & Transformation Table

| Dataset Column | MongoDB Collection / Field | Data Type & Transformation | Purpose |
| :--- | :--- | :--- | :--- |
| `event_id` | `ems_events.eventId` | `string` (trimmed, unique indexed) | Unique identifier for historical EMS event tracking and simulation lookup. |
| `timestamp` | `ems_events.timestamp` | `Date` (converted from ISO-8601 string `YYYY-MM-DDTHH:MM:SS`) | Chronological sequencing for time-series incident replay and surge simulation. |
| `condition` | `ems_events.condition` | `string` (normalized lowercase: `trauma`, `cardiac`, `stroke`) | High-level clinical condition used by allocation engine to match specialty centers. |
| `chief_complaint` | `ems_events.chiefComplaint` | `string` (cleaned text) | Detailed patient narrative used for NLP classification, voice replay, and clinical intake. |
| `age` | `ems_events.patient.age` | `integer` (1 to 90) | Patient demographic; informs pediatric vs. adult triage pathways. |
| `gender` | `ems_events.patient.gender` | `string` (normalized lowercase: `male`, `female`) | Demographic record. |
| `sbp` | `ems_events.vitals.sbp` | `integer` (Systolic BP, mmHg: 70–180) | Hemodynamic instability indicator; SBP < 90 triggers critical trauma/cardiac alert. |
| `heart_rate` | `ems_events.vitals.heartRate` | `integer` (Pulse, bpm: 40–160) | Tachycardia (>120) or bradycardia (<50) triage flag. |
| `spo2` | `ems_events.vitals.spo2` | `integer` (Blood Oxygen Saturation, %: 82–100) | Hypoxia indicator; SpO2 < 90 triggers immediate ventilator/oxygen requirement. |
| `gcs` | `ems_events.vitals.gcs` | `integer` (Glasgow Coma Scale: 6–15) | Neurological trauma indicator; GCS <= 8 indicates severe brain injury requiring ICU. |
| `triage_priority` | `ems_events.triagePriority` | `string` (uppercase: `RED`, `YELLOW`) | Standard emergency severity index (Red = Immediate/Resuscitation, Yellow = Urgent). |
| `hospital_type` | `ems_events.targetHospitalType` | `string` (`level1_trauma_center`, `cardiac_center`, `stroke_center`, `general_emergency`) | Benchmark hospital classification for validating allocator matching accuracy. |
| `hospital_id` | `ems_events.benchmarkHospitalId` | `string` (e.g. `H001`, `H002`, `H003`, `H004`) | Historical assigned destination for simulation benchmarking. |

---

## 2. Dataset 2: `Datasets/raw_weekly_hospital_respiratory_data_2020_2024.csv`

### 2.1 Dataset Profile
* **File Size:** ~6.2 MB
* **Total Rows:** 12,769 weekly reporting periods across 57 geographic territories
* **Total Columns:** 157
* **Missing Values:** Sparse reporting for RSV (<10%), dense reporting for Inpatient/ICU bed occupancy (>98%)
* **Date Range:** `2020-08-08` to `2024-11-16`
* **Target MongoDB Collection:** `hospital_capacity_benchmarks` (historical baseline for capacity modeling & surge stress-testing)

### 2.2 Key Column Mapping & Transformation Table

| Dataset Column | MongoDB Collection / Field | Data Type & Transformation | Purpose |
| :--- | :--- | :--- | :--- |
| `Week Ending Date` | `hospital_capacity_benchmarks.weekEndingDate` | `Date` (converted from `YYYY-MM-DD`) | Time-series indexing for historical trend analysis. |
| `Geographic aggregation` | `hospital_capacity_benchmarks.region` | `string` (e.g. `WA`, `WI`, `NY`, indexed) | Regional grouping for territory-level bed availability baselines. |
| `Number of Inpatient Beds` | `hospital_capacity_benchmarks.totalInpatientBeds` | `integer` (null-safe fallback to 0) | Regional aggregate inpatient capacity baseline. |
| `Number of Inpatient Beds Occupied` | `hospital_capacity_benchmarks.occupiedInpatientBeds` | `integer` (null-safe fallback to 0) | Baseline bed consumption. |
| `Number of ICU Beds` | `hospital_capacity_benchmarks.totalIcuBeds` | `integer` (null-safe fallback to 0) | Regional critical care capacity baseline. |
| `Number of ICU Beds Occupied` | `hospital_capacity_benchmarks.occupiedIcuBeds` | `integer` (null-safe fallback to 0) | Critical care demand tracking. |
| `Percent Inpatient Beds Occupied` | `hospital_capacity_benchmarks.inpatientOccupancyRate` | `float` (0.0 to 1.0, null-safe) | Standard utilization ratio to simulate hospital capacity pressure. |
| `Percent ICU Beds Occupied` | `hospital_capacity_benchmarks.icuOccupancyRate` | `float` (0.0 to 1.0, null-safe) | ICU saturation metric used for diversion stress-testing. |
| `Total Patients Hospitalized with COVID-19` | `hospital_capacity_benchmarks.respiratorySurge.covid` | `integer` (null-safe fallback to 0) | Epidemic surge factor for stress-testing resource allocation. |
| `Total Patients Hospitalized with Influenza` | `hospital_capacity_benchmarks.respiratorySurge.influenza` | `integer` (null-safe fallback to 0) | Seasonal surge component. |
| `Total Patients Hospitalized with RSV` | `hospital_capacity_benchmarks.respiratorySurge.rsv` | `integer` (null-safe fallback to 0) | Pediatric respiratory strain metric. |

---

## 3. Operational Integrity & Security Guidelines
1. **Source of Truth:** Kaggle CSVs remain immutable in the `Datasets/` directory. They are never rewritten.
2. **MongoDB Independence:** Data is ingested into dedicated collections (`ems_events` and `hospital_capacity_benchmarks`) that sit alongside the live operational collections (`hospitals`, `emergencyRequests`, `ambulances`, `reservations`, `hospitalEvents`, `handoffs`).
3. **Credentials:** The ingestion scripts read `MONGODB_URI` from `.env.local` using `dotenv` / `os.environ` and never contain hardcoded connection strings.
4. **Idempotency:** Unique indexes on `eventId` and compound index on `{ region: 1, weekEndingDate: 1 }` prevent duplicate records during re-runs.
