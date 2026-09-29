# Emergency Demo Architecture

## 1. What Is Real vs Simulated

This document describes the complete data flow of the Real-Time Emergency Resource Allocator
and clearly separates **real** production-grade operations from **simulated** inputs.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        REAL  (production-grade)                          │
├──────────────────────────────────────────────────────────────────────────┤
│  • MongoDB Atlas — meddecision database                                  │
│  • hospitals collection — DEMO_OPERATIONAL_SEED records (5 hospitals)   │
│  • emergencyRequests collection — one document per dispatch event        │
│  • ambulances collection — real documents, simulated GPS data labelled  │
│  • reservations collection — atomic conditional writes                   │
│  • hospitalEvents collection — audit trail                               │
│  • handoffs collection — patient transfer records                        │
│  • ems_events collection — historical Kaggle import                      │
│  • hospital_capacity_benchmarks — historical Kaggle import               │
│  • Triage classifier (vitals-based, deterministic)                       │
│  • Allocation scoring engine (weighted multi-criteria)                   │
│  • Atomic reservation (MongoDB findOneAndUpdate with capacity guard)     │
│  • Four-bucket capacity invariant: available=total-occupied-reserved     │
├──────────────────────────────────────────────────────────────────────────┤
│                      SIMULATED  (labelled telemetrySource:"SIMULATION") │
├──────────────────────────────────────────────────────────────────────────┤
│  • EMS dispatch trigger (no real 112/911 CAD feed connected)            │
│  • Ambulance GPS coordinates (random offset from incident location)      │
│  • Ambulance speed & heading                                             │
│  • Traffic-adjusted ETA (deterministic model: 45 km/h + 2 min turnout) │
│  • Paramedic crew names                                                  │
│  • Simulated capacity mutations (ICU_SCARCITY scenario override)        │
│  • External hospital telemetry feed                                      │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Collections

| Collection | Purpose | Data Source |
|---|---|---|
| `hospitals` | Live hospital capacity & capability records | DEMO seed (5 records) |
| `emergencyRequests` | One document per emergency dispatch | Real (written by simulator/API) |
| `ambulances` | Ambulance fleet records | Real documents, simulated GPS |
| `reservations` | Active and historical bed/resource reservations | Real atomic writes |
| `hospitalEvents` | Immutable audit log of capacity events | Real audit trail |
| `handoffs` | Patient transfer records on arrival | Real documents |
| `ems_events` | Historical Kaggle EMS incidents (20 000 rows) | Historical import |
| `hospital_capacity_benchmarks` | Weekly US hospital capacity 2020–2024 | Historical import |

---

## 3. Demo Hospital Profiles

| UID | Hospital | Profile | Key Capability |
|---|---|---|---|
| `DEMO-HOSP-CARDIAC-001` | Apex Heart & Vascular Institute | CARDIAC_SPECIALIST | Cath Lab, ECMO, Cardiology |
| `DEMO-HOSP-TRAUMA-002` | CityGuard Trauma & Emergency Centre | TRAUMA_SPECIALIST | Trauma Bay, 6 OTs, Neurosurgery |
| `DEMO-HOSP-NEURO-003` | NeuroShield Brain & Spine Hospital | STROKE_SPECIALIST | CT/MRI, Neurology, tPA protocol |
| `DEMO-HOSP-GENERAL-004` | SafeHaven Multi-Specialty Hospital | GENERAL_EMERGENCY | Broad capability, 300 beds |
| `DEMO-HOSP-CONSTRAINED-005` | Riverside District Hospital | CONSTRAINED_CAPACITY | 4 ICU beds, no Cath Lab/CT |

All documents are marked `isDemo: true` and `dataSource: "DEMO_OPERATIONAL_SEED"`.

---

## 4. Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW                                      │
└─────────────────────────────────────────────────────────────────────────┘

 Historical Kaggle Data
 ─────────────────────
  Datasets/ems_events_20000.csv
      └─→ scripts/import_ems_data.py
              └─→ MongoDB: ems_events (20 000 records)

  Datasets/raw_weekly_hospital_respiratory_data_2020_2024.csv
      └─→ scripts/import_hospital_capacity.py
              └─→ MongoDB: hospital_capacity_benchmarks


 EMS Simulation Flow (POST /api/emergency/simulate)
 ──────────────────────────────────────────────────
  1. SCENARIO selected (NORMAL_CARDIAC / TRAUMA / STROKE / ICU_SCARCITY / etc.)
        │
        ▼
  2. ScenarioConfig → EmergencyIntakeDTO assembled
        │
        ▼
  3. classifyEmergencyTriage()  ← REAL triage engine
        │   Returns: priority, emergencyType, requiredSpecialty, requiredResources
        ▼
  4. EmergencyRequest inserted → MongoDB: emergencyRequests   ← REAL write
        │
        ▼
  5. Ambulance upserted → MongoDB: ambulances                 ← REAL write
        │   (GPS coords labelled telemetrySource: "SIMULATION")
        ▼
  6. [Optional] Scenario state patch (ICU_SCARCITY / STALE_HOSPITAL_DATA)
        │   → temporarily modify hospital document
        │   → restore after allocation
        ▼
  7. allocateEmergencyHospital()  ← REAL allocator, REAL MongoDB hospital data
        │   Queries hospitals collection
        │   Applies: resource match (40%) + travel (35%) + freshness (15%) + capacity (10%)
        │   Returns: ranked CandidateEvaluation[]
        ▼
  8. Top suitable hospital selected
        │
        ▼
  9. reserveResource()  ← REAL atomic reservation
        │   MongoDB findOneAndUpdate with capacity guard: { availableIcuBeds: { $gte: 1 } }
        │   Capacity mutation + reservation document creation = atomic
        │   Returns: SUCCESS | RESOURCE_UNAVAILABLE | HOSPITAL_NOT_FOUND
        ▼
 10. EmergencyRequest updated: status=ALLOCATED, allocatedHospitalId, reservationId ← REAL
        │
        ▼
 11. Ambulance updated: destinationHospitalId, ETA, status=TRANSPORTING  ← REAL write
        │
        ▼
 12. SimulationResult returned with full audit trail


 Ambulance Movement (advanceAmbulance)
 ─────────────────────────────────────
  DISPATCHED → EN_ROUTE → ARRIVED → HANDOFF

  On ARRIVED:
    → Handoff document created → MongoDB: handoffs         ← REAL write
    → EmergencyRequest status = ARRIVED                    ← REAL write

  On HANDOFF:
    → Handoff.status = COMPLETED                           ← REAL write
    → EmergencyRequest.status = HANDED_OFF                 ← REAL write
    → HospitalEvent: PATIENT_ADMITTED                      ← REAL audit


 Reservation Lifecycle
 ─────────────────────
  PENDING → CONFIRMED (patient admitted: reserved→occupied)
  PENDING → RELEASED  (ambulance diverted or cancelled)
  PENDING → EXPIRED   (TTL sweep, capacity returned)
  PENDING → REJECTED  (hospital override)
  CONFIRMED → RELEASED (patient discharged)
```

---

## 5. Simulation Scenarios

| Scenario | What It Tests | Real Behaviour Exercised |
|---|---|---|
| `NORMAL_CARDIAC` | Standard STEMI allocation | Triage → Cath Lab match → reservation at CARDIAC-001 |
| `TRAUMA` | MVA polytrauma dispatch | Trauma Bay match → OT reservation at TRAUMA-002 |
| `STROKE` | Acute ischaemic stroke | CT/Neurology match → ICU reservation at NEURO-003 |
| `ICU_SCARCITY` | Respiratory failure, very few ICU beds | Allocation scores constrained hospital last; real `RESOURCE_UNAVAILABLE` if last bed taken |
| `NO_SUITABLE_HOSPITAL` | Paediatric PICU case | Allocator correctly returns 0 suitable hospitals |
| `STALE_HOSPITAL_DATA` | Hospital with old telemetry | Freshness penalty reduces score; STALE label in results |

---

## 6. Capacity Invariant

```
available = total − occupied − reserved
```

This is enforced atomically in MongoDB. No read-then-write race is possible.
All simulations verify this invariant after the reservation step.

---

## 7. Files

| File | Role |
|---|---|
| `scripts/seed_demo_hospitals.ts` | One-time idempotent seed for 5 demo hospitals |
| `scripts/import_ems_data.py` | Historical EMS events import |
| `scripts/import_hospital_capacity.py` | Historical capacity benchmarks import |
| `lib/emergency/ems-simulator.ts` | EMS simulation service |
| `lib/emergency/emergency-allocator.ts` | Deterministic allocation engine |
| `lib/emergency/emergency-reservation.ts` | Atomic reservation service |
| `lib/emergency/triage-intake.ts` | Clinical triage classifier |
| `lib/emergency/emergency-types.ts` | Domain type definitions |
| `lib/emergency/emergency-repository.ts` | Collection getters + index setup |
| `app/api/emergency/simulate/route.ts` | POST /api/emergency/simulate |
| `app/api/emergency/allocate/route.ts` | POST /api/emergency/allocate |
| `app/api/emergency/reserve/route.ts` | POST /api/emergency/reserve |
| `app/api/emergency/reservations/[id]/action/route.ts` | POST confirm/release/reject/expire |
| `docs/emergency-allocation.md` | Allocator scoring formula documentation |
| `docs/emergency-reservations.md` | Resource accounting + state machine documentation |
| `docs/emergency-demo-architecture.md` | This document |
