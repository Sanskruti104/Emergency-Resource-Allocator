# Emergency Resource Reservation Model

## 1. Overview

The reservation system enforces **atomic, race-free resource management** for critical
medical resources (ICU beds, general beds, ventilators, operation theatres) during
real-time emergency allocation.

It deliberately separates **reserved** capacity from **occupied** capacity so that the
allocator can see true availability even when resources are temporarily held for
in-transit ambulances that have not yet arrived.

---

## 2. Resource Accounting Model

### 2.1 Four-Bucket Invariant

For every reservable resource at a hospital, the system tracks four values:

```
total     = physical units installed / operational
occupied  = units currently in use by admitted patients
reserved  = units held by active (PENDING/CONFIRMED) reservations
available = total - occupied - reserved
```

The invariant **`available = total − occupied − reserved`** must hold at all times.
MongoDB atomic operations enforce this: no read-then-write race is possible.

### 2.2 Backward Compatibility with Existing Hospital Schema

The existing `hospitals` collection stores capacity in a nested `capacity` sub-document:

```jsonc
{
  "capacity": {
    "totalBeds":          100,   // physical general beds
    "availableBeds":      25,    // existing field — kept for dashboard compatibility
    "icuBeds":            10,    // physical ICU beds (total)
    "operationTheatres":  3,
    "onDutySpecialist":   2,
    "emergencyAvailable": true
  }
}
```

The reservation system **extends** this schema by adding reservation-tracking fields
without removing or renaming existing ones:

```jsonc
{
  "capacity": {
    // --- existing fields (unchanged) ---
    "totalBeds":            100,
    "availableBeds":        22,   // kept; = totalBeds - occupiedBeds - reservedBeds
    "icuBeds":              10,   // kept as physical total
    "operationTheatres":    3,
    "onDutySpecialist":     2,
    "emergencyAvailable":   true,

    // --- new reservation-tracking fields ---
    "occupiedBeds":         3,    // general beds occupied by admitted patients
    "reservedBeds":         0,    // general beds held by active reservations
    // availableBeds = totalBeds - occupiedBeds - reservedBeds

    "availableIcuBeds":     8,    // derived: icuBeds - occupiedIcuBeds - reservedIcuBeds
    "occupiedIcuBeds":      2,    // ICU beds occupied by admitted patients
    "reservedIcuBeds":      0,    // ICU beds held by active reservations
    // availableIcuBeds = icuBeds - occupiedIcuBeds - reservedIcuBeds

    "availableVentilators": 4,
    "totalVentilators":     5,
    "occupiedVentilators":  1,
    "reservedVentilators":  0,

    "reservedOTs":          0,    // OTs held by active reservations
    // availableOTs = operationTheatres - reservedOTs (OTs don't "occupy" same way)

    "updatedAt":            "ISO timestamp"
  }
}
```

**Migration rule:** If `occupiedBeds` / `reservedBeds` are absent on an existing
hospital document, they are treated as `0` (conservative default — all missing capacity
is assumed available for display purposes, but reservations will insert these fields
on first write).

### 2.3 Resource Type → Capacity Field Mapping

| `ResourceType` | Total field | Occupied field | Reserved field | Available field |
|---|---|---|---|---|
| `ICU_BED` | `capacity.icuBeds` | `capacity.occupiedIcuBeds` | `capacity.reservedIcuBeds` | `capacity.availableIcuBeds` |
| `GENERAL_BED` | `capacity.totalBeds` | `capacity.occupiedBeds` | `capacity.reservedBeds` | `capacity.availableBeds` |
| `VENTILATOR` | `capacity.totalVentilators` | `capacity.occupiedVentilators` | `capacity.reservedVentilators` | `capacity.availableVentilators` |
| `OPERATION_THEATRE` | `capacity.operationTheatres` | *(not tracked)* | `capacity.reservedOTs` | derived |

---

## 3. Reservation State Machine

```
                    ┌──────────────────────┐
              ┌────▶│       PENDING         │─────┐
              │     └──────────────────────┘     │
              │       │          │         │     │
              │   CONFIRM     REJECT    EXPIRE   │
              │       │          │         │     │
              │       ▼          ▼         ▼     │
              │  CONFIRMED   REJECTED   EXPIRED  │RELEASE
              │       │                          │
              │    RELEASE                       │
              │       │                          │
              │       ▼                          ▼
              │    RELEASED ◀────────────────────┘
              │
              └─── ❌ RELEASED → CONFIRMED  (forbidden)
                   ❌ EXPIRED  → CONFIRMED  (forbidden)
                   ❌ REJECTED → CONFIRMED  (forbidden)
```

### Valid Transitions

| From | To | Trigger | Capacity Effect |
|---|---|---|---|
| `PENDING` | `CONFIRMED` | Patient arrived, admitted | `reserved↓`, `occupied↑`, `available` unchanged |
| `PENDING` | `REJECTED` | Allocation overridden / hospital declined | `reserved↓`, `available↑` |
| `PENDING` | `EXPIRED` | TTL exceeded (auto-sweep) | `reserved↓`, `available↑` |
| `PENDING` | `RELEASED` | Emergency cancelled | `reserved↓`, `available↑` |
| `CONFIRMED` | `RELEASED` | Patient discharged | `occupied↓`, `available↑` |

### Forbidden Transitions (rejected with `INVALID_TRANSITION`)

- `RELEASED → CONFIRMED`
- `EXPIRED → CONFIRMED`
- `REJECTED → CONFIRMED`
- Any terminal state → any other state (terminal = RELEASED, EXPIRED, REJECTED)

---

## 4. Atomic MongoDB Strategy

### 4.1 Reserve (PENDING creation)

Uses a **single `findOneAndUpdate`** with a **conditional filter** that only matches
when available capacity is sufficient:

```js
db.collection("hospitals").findOneAndUpdate(
  {
    uid: hospitalId,
    "capacity.availableIcuBeds": { $gte: quantity }   // ← atomic guard
  },
  {
    $inc: {
      "capacity.reservedIcuBeds":   quantity,
      "capacity.availableIcuBeds": -quantity
    },
    $set: { "capacity.updatedAt": new Date() }
  },
  { returnDocument: "after" }
)
```

If no document matches (because `availableIcuBeds < quantity`), the operation returns
`null` — interpreted as `RESOURCE_UNAVAILABLE`. Two concurrent requests for the last
bed will both execute this atomically; MongoDB's document-level locking guarantees only
one can match the condition when `availableIcuBeds = 1`.

### 4.2 Release / Expire (capacity return)

Also atomic, and **guarded to prevent double-release**:

```js
// First: transition reservation status in one atomic op
db.collection("reservations").findOneAndUpdate(
  { reservationId, status: "PENDING" },   // ← only matches if still PENDING
  { $set: { status: "RELEASED", releasedAt: now } }
)
// Only if that succeeded, return capacity:
db.collection("hospitals").updateOne(
  { uid: hospitalId },
  { $inc: { "capacity.reservedIcuBeds": -quantity, "capacity.availableIcuBeds": quantity } }
)
```

The reservation status flip is atomic and idempotent — a second call with `status: "PENDING"` filter will not match an already-RELEASED reservation, so the capacity increment will not be applied twice.

### 4.3 Confirm Admission (reserved → occupied)

```js
$inc: {
  "capacity.reservedIcuBeds":   -quantity,   // no longer reserved
  "capacity.occupiedIcuBeds":    quantity    // now physically occupied
  // availableIcuBeds stays the same — it was already decremented on reserve
}
```

---

## 5. Hospital Events Recorded

| Event | Trigger |
|---|---|
| `ICU_RESERVED` | Successful ICU reservation |
| `ICU_RELEASED` | ICU reservation released or expired |
| `PATIENT_ADMITTED` | Reservation confirmed (patient handed over) |
| `PATIENT_DISCHARGED` | Confirmed reservation released after discharge |
| `VENTILATOR_ASSIGNED` | Ventilator reserved |
| `VENTILATOR_RELEASED` | Ventilator reservation released |
