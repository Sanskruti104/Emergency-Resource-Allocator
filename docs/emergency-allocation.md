# Real-Time Emergency Resource Allocation Engine

## 1. Overview & Architecture

The **Real-Time Emergency Resource Allocator** is a deterministic, explainable clinical decision-support engine designed to match emergency patients (from 911/EMS dispatch, manual triage intake, or live simulation) with the optimal receiving hospital facility.

Unlike elective recommendation algorithms that optimize for patient financial preference, insurance network tier, or elective doctor reviews, the **Emergency Allocator** operates under strict critical-care imperatives:

1. **Patient Survival & Time-to-Treatment**: The "Golden Hour" in trauma, ischemic stroke window (thrombolytic/EVT), and STEMI door-to-balloon time (PCI) mandate minimum transit times.
2. **Hard Clinical Feasibility**: If a hospital lacks an open cardiac catheterization lab, zero open ICU beds, or an active operating theatre, it is **unsuitable**, regardless of proximity or rating.
3. **Operational Telemetry Freshness**: Hospital capacity fluctuates minute-by-minute. Outdated telemetry creates dangerous "phantom capacity" that leads to ED diversion or ambulance turnaways.

```
Emergency Intake / EMS Vitals / Scene Location
                    │
                    ▼
     [ Clinical Triage Evaluation ]
    (Determines Priority: RED / YELLOW,
     Required Specialty, Required Equipment)
                    │
                    ▼
   [ Candidate Hospitals (MongoDB Live) ]
                    │
   ┌────────────────┴────────────────┐
   │                                 │
   ▼                                 ▼
[ 1. Hard Compatibility Gate ]   [ Disqualified Facilities ]
• Active Emergency Dept?          • Reason: "0 ICU Beds"
• Required Specialty present?     • Reason: "Lacks Cath Lab"
• Required Beds/ICU open?         • Suitability = FALSE
• Required Instruments ready?     • Overall Score = 0
   │
   ▼
[ 2. Multi-Criteria Deterministic Scoring ]
• Resource Match Score   (40% Weight)
• Travel Time & ETA      (35% Weight)
• Telemetry Freshness    (15% Weight)
• Capacity Resilience    (10% Weight)
   │
   ▼
[ Ranked & Explained Hospital Recommendations ]
(Top-ranked facility with transparent component breakdown)
```

---

## 2. Hard Capability & Resource Compatibility

Before calculating any ranking scores, every candidate hospital is screened against **non-negotiable hard clinical constraints**. If any condition is violated, the facility is classified as `suitability: false`, assigned `overallScore: 0`, and moved to the disqualified section with explicit clinical justifications.

| Hard Rule | Clinical Constraint | Rejection Justification |
| :--- | :--- | :--- |
| **Emergency Department Status** | `capacity.emergencyAvailable !== false` | `"Facility Emergency Department is currently closed / offline."` |
| **Mandatory Specialty Coverage** | Hospital must have certified department for `requiredSpecialty` (e.g. Cardiology, Trauma Surgery, Neurology) | `"Lacks required clinical specialty (${requiredSpecialty})."` |
| **Mandatory ICU Headroom** | If `requiresIcu` is true (Triage RED, GCS $\le 8$, shock, or respiratory failure), `availableIcuBeds > 0` | `"Mandatory critical care required, but 0 ICU beds are currently available."` |
| **General Inpatient Headroom** | If `GENERAL_BED` is required, `availableBeds > 0` | `"No general inpatient beds available (0 beds open)."` |
| **Surgical Operating Theatre** | If `OPERATION_THEATRE` is required (severe trauma/hemorrhage), `operationTheatres > 0` | `"Emergency surgical capability required, but no operation theatre is currently available."` |
| **Specialized Equipment** | Hospital instruments must contain explicit life-support equipment (`VENTILATOR`, `CATH_LAB`, `CT_SCAN`, `TRAUMA_BAY`) | `"Essential medical instrument missing: ${equipment}."` |

---

## 3. Multi-Criteria Deterministic Scoring Formula

For all facilities that satisfy the hard compatibility gate (`suitability: true`), the allocator computes an explainable composite score on a scale from **0 to 100**:

$$\text{OverallScore} = 0.40 \times S_{\text{resource}} + 0.35 \times S_{\text{travel}} + 0.15 \times S_{\text{freshness}} + 0.10 \times S_{\text{capacity}}$$

### Component Breakdown

#### A. Resource Match Score ($S_{\text{resource}}$) — Weight: 40%
Evaluates clinical readiness and resource depth (Max 100 points):
* **Emergency Department Online**: `+20 pts` if active.
* **ICU Availability Headroom**:
  * $\ge 3$ available ICU beds: `+25 pts` (robust buffer)
  * $2$ available ICU beds: `+20 pts` (adequate)
  * $1$ available ICU bed: `+12 pts` (tight constraint)
  * $0$ available ICU beds: `0 pts` (disqualification if ICU required)
* **General Inpatient Headroom**:
  * $\ge 10$ available beds: `+20 pts`
  * $1 \text{ to } 9$ available beds: $\text{round}\left(\frac{\text{availableBeds}}{10} \times 20\right)$ `pts`
  * $0$ beds: `0 pts`
* **Specialty Match & Staffing**:
  * Certified specialty matched: `+15 pts`
  * On-duty specialist present on floor: `+5 pts`
* **Equipment Verification Depth**:
  * $\text{round}\left(\frac{\text{matchedInstruments}}{\text{requiredInstruments}} \times 15\right)$ `pts`

#### B. Travel Time & Proximity Score ($S_{\text{travel}}$) — Weight: 35%
Uses the Haversine distance formula with a deterministic ambulance transit model:
* **Average Speed ($v$)**: $45.0 \text{ km/h}$ (urban/suburban emergency transit)
* **Turnout / Mobilization Buffer ($t_{\text{turnout}}$)**: $2.0 \text{ minutes}$
* **Estimated Travel Time**:
  $$\text{TravelMinutes} = \frac{\text{DistanceKm}}{45.0} \times 60 + 2.0$$
* **Travel Score Formula**:
  $$\text{TravelScore} = \begin{cases}
  100, & \text{if } \text{TravelMinutes} \le 5.0 \\
  \max(0, 100 - (\text{TravelMinutes} - 5.0) \times 1.5), & \text{if } \text{TravelMinutes} > 5.0
  \end{cases}$$

#### C. Telemetry Freshness Score ($S_{\text{freshness}}$) — Weight: 15%
Prevents routing ambulances to hospitals based on obsolete or unverified capacity:
$$\text{AgeMinutes} = \frac{\text{CurrentTimestamp} - \text{LastUpdatedAt}}{60 \times 1000}$$

| Classification | Telemetry Age | Score Range | Operational Meaning |
| :--- | :--- | :--- | :--- |
| **`FRESH`** | $\le 15.0 \text{ minutes}$ | $85 - 100 \text{ pts}$ | Real-time live data; high confidence for automated dispatch. |
| **`AGING`** | $15.1 - 60.0 \text{ minutes}$ | $40 - 75 \text{ pts}$ | Moderately reliable; system flags for paramedic/dispatch verbal check. |
| **`STALE`** | $> 60.0 \text{ minutes}$ or missing | $20 \text{ pts}$ (or 10 if missing) | High risk of capacity drift; heavily penalized in ranking. |

#### D. Capacity Resilience Score ($S_{\text{capacity}}$) — Weight: 10%
Measures hospital operational buffer against sudden overcrowding or diversion:
* **Occupancy $< 60\%$**: `100 pts` (ideal reserve)
* **Occupancy $60\% - 80\%$**: `85 pts` (standard operational load)
* **Occupancy $80\% - 90\%$**: `60 pts` (busy ED)
* **Occupancy $90\% - 95\%$**: `30 pts` (near diversion)
* **Occupancy $> 95\%$**: `10 pts` (diverting)
* **Surge Bonus**: `+10 pts` if $\ge 2$ operation theatres are currently clear.

---

## 4. Worked Comparative Examples

### Scenario: Code STEMI (Acute Myocardial Infarction)
* **Patient**: 58-year-old male with crushing substernal chest pain radiating to left arm.
* **Vitals**: SBP 85 mmHg (Shock), Heart Rate 135 bpm, SpO2 88%, GCS 14.
* **Triage Priority**: **RED (Critical)**
* **Required Specialty**: `Cardiology & Interventional Cath Lab`
* **Required Resources**: `ICU_BED`, `CATH_LAB`, `VENTILATOR`, `GENERAL_BED`

---

### Candidate Evaluations

#### Hospital A: "Metro Heart & Trauma Institute"
* **Distance**: 6.2 km ($\text{TravelMinutes} = 10.3 \text{ mins}$)
* **Capacity**: Available Beds: 18, ICU Beds: 4, OTs: 3, Emergency Dept: Active.
* **Instruments**: Cath Lab, Ventilator, ICU Monitors.
* **Telemetry**: Updated 3 minutes ago (`FRESH`).
* **Evaluation**:
  * **Hard Gate**: PASSED (All specialties, ICU, and cath lab verified).
  * **Resource Score**: $20 \text{ (ED)} + 25 \text{ (ICU)} + 20 \text{ (Beds)} + 20 \text{ (Specialty)} + 15 \text{ (Instruments)} = 100/100$
  * **Travel Score**: $100 - (10.3 - 5.0) \times 1.5 = 92.05/100$
  * **Freshness Score**: $100 - 3 = 97/100$ (`FRESH`)
  * **Capacity Resilience**: 85/100 (Occupancy 68%)
  * **Overall Composite Score**:
    $$\text{OverallScore} = 0.40(100) + 0.35(92.05) + 0.15(97) + 0.10(85) = 40.0 + 32.22 + 14.55 + 8.5 = \mathbf{95.27}$$
  * **Outcome**: **RANK #1 — Optimal Destination**

#### Hospital B: "Apex City Hospital"
* **Distance**: 2.5 km ($\text{TravelMinutes} = 5.3 \text{ mins}$)
* **Capacity**: Available Beds: 25, ICU Beds: 6, Emergency Dept: Active.
* **Instruments**: General OT, Ventilator, ICU Monitors (**NO Cath Lab**).
* **Telemetry**: Updated 8 minutes ago (`FRESH`).
* **Evaluation**:
  * **Hard Gate**: **FAILED**
  * **Reason**: Missing critical equipment: `CATH_LAB`.
  * **Suitability**: `false`
  * **Overall Composite Score**: $\mathbf{0.0}$
  * **Outcome**: **DISQUALIFIED**. Despite being only 2.5 km away, transporting a STEMI patient here would result in secondary inter-facility transfer delay.

#### Hospital C: "St. Jude Super Specialty"
* **Distance**: 4.1 km ($\text{TravelMinutes} = 7.5 \text{ mins}$)
* **Capacity**: Available Beds: 8, ICU Beds: 2, Emergency Dept: Active.
* **Instruments**: Cath Lab, Ventilator, ICU Monitors.
* **Telemetry**: Updated 140 minutes ago (`STALE`).
* **Evaluation**:
  * **Hard Gate**: PASSED.
  * **Resource Score**: $20 + 20 + 16 + 20 + 15 = 91/100$
  * **Travel Score**: $100 - (7.5 - 5.0) \times 1.5 = 96.25/100$
  * **Freshness Score**: $20/100$ (`STALE`, penalizes ranking confidence)
  * **Capacity Resilience**: 60/100
  * **Overall Composite Score**:
    $$\text{OverallScore} = 0.40(91) + 0.35(96.25) + 0.15(20) + 0.10(60) = 36.4 + 33.69 + 3.0 + 6.0 = \mathbf{79.09}$$
  * **Outcome**: **RANK #2 — Suitable with Stale Telemetry Warning**

---

## 5. API Response Contract (`POST /api/emergency/allocate`)

```json
{
  "success": true,
  "timestamp": "2026-09-27T01:45:00.000Z",
  "emergency": {
    "condition": "cardiac",
    "chiefComplaint": "Crushing chest pain radiating to left arm",
    "priority": "RED",
    "requiredSpecialty": "Cardiology & Interventional Cath Lab",
    "requiredResources": ["GENERAL_BED", "CATH_LAB", "ICU_BED", "VENTILATOR"],
    "incidentLocation": { "latitude": 18.5204, "longitude": 73.8567 }
  },
  "totalCandidatesEvaluated": 3,
  "suitableCount": 2,
  "results": [
    {
      "hospitalId": "HOSP-001",
      "hospitalName": "Metro Heart & Trauma Institute",
      "suitability": true,
      "overallScore": 95.27,
      "resourceMatchScore": 100,
      "travelScore": 92.05,
      "freshnessScore": 97,
      "capacityScore": 85,
      "distanceKm": 6.2,
      "estimatedTravelMinutes": 10.3,
      "eta": "2026-09-27T01:55:18.000Z",
      "freshnessStatus": "FRESH",
      "lastUpdatedAt": "2026-09-27T01:42:00.000Z",
      "matchedResources": ["EMERGENCY_DEPT_ACTIVE", "ICU_HEADROOM_EXCELLENT (4 beds)", "EQUIPMENT: CATH_LAB", "EQUIPMENT: VENTILATOR"],
      "missingResources": [],
      "reasons": [
        "6.2 km away. Estimated ETA: 10.3 mins (Score: 92.1/100).",
        "Telemetry FRESH (updated 3m ago, score 97/100).",
        "Clinical specialty confirmed for Cardiology & Interventional Cath Lab (+15 pts)."
      ]
    },
    {
      "hospitalId": "HOSP-003",
      "hospitalName": "St. Jude Super Specialty",
      "suitability": true,
      "overallScore": 79.09,
      "resourceMatchScore": 91,
      "travelScore": 96.25,
      "freshnessScore": 20,
      "capacityScore": 60,
      "distanceKm": 4.1,
      "estimatedTravelMinutes": 7.5,
      "eta": "2026-09-27T01:52:30.000Z",
      "freshnessStatus": "STALE",
      "lastUpdatedAt": "2026-09-26T23:25:00.000Z",
      "matchedResources": ["EMERGENCY_DEPT_ACTIVE", "EQUIPMENT: CATH_LAB"],
      "missingResources": [],
      "reasons": [
        "4.1 km away. Estimated ETA: 7.5 mins (Score: 96.3/100).",
        "Telemetry STALE (updated 140m ago; high risk of capacity drift, score 20/100)."
      ]
    },
    {
      "hospitalId": "HOSP-002",
      "hospitalName": "Apex City Hospital",
      "suitability": false,
      "overallScore": 0,
      "resourceMatchScore": 60,
      "travelScore": 99.5,
      "freshnessScore": 92,
      "capacityScore": 85,
      "distanceKm": 2.5,
      "estimatedTravelMinutes": 5.3,
      "eta": "2026-09-27T01:50:18.000Z",
      "freshnessStatus": "FRESH",
      "matchedResources": ["EMERGENCY_DEPT_ACTIVE", "ICU_HEADROOM_EXCELLENT (6 beds)"],
      "missingResources": ["EQUIPMENT: CATH_LAB"],
      "reasons": [
        "Essential medical instrument missing: CATH_LAB."
      ]
    }
  ],
  "explanationSummary": "Optimal match identified: Metro Heart & Trauma Institute (Overall Score: 95.27/100, Travel: 10.3 mins / 6.2 km, Freshness: FRESH). 2 of 3 facilities verified suitable."
}
```
