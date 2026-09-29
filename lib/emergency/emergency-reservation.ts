/**
 * Emergency Resource Reservation Service
 *
 * Provides atomic, race-free resource reservation for real-time emergency allocation.
 *
 * Core design principle:
 *   All capacity mutations are performed as a single atomic MongoDB findOneAndUpdate
 *   with a conditional filter that verifies sufficiency at mutation time.
 *   A separate read-then-write is NEVER used — that would be a race condition.
 *
 * Four-bucket invariant:
 *   available = total - occupied - reserved
 */

import { Db, MongoClient, ClientSession } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { ResourceType, ReservationStatus, HospitalEventType } from "./emergency-types";

// ==========================================
// 1. Resource → Capacity Field Mappings
// ==========================================

interface CapacityFields {
    available: string;   // field to check + decrement on reserve, increment on release
    reserved: string;    // field to increment on reserve, decrement on release/expire
    occupied: string;    // field to increment on confirm (admission)
}

const RESOURCE_CAPACITY_MAP: Record<string, CapacityFields> = {
    ICU_BED: {
        available: "capacity.availableIcuBeds",
        reserved:  "capacity.reservedIcuBeds",
        occupied:  "capacity.occupiedIcuBeds"
    },
    GENERAL_BED: {
        available: "capacity.availableBeds",
        reserved:  "capacity.reservedBeds",
        occupied:  "capacity.occupiedBeds"
    },
    VENTILATOR: {
        available: "capacity.availableVentilators",
        reserved:  "capacity.reservedVentilators",
        occupied:  "capacity.occupiedVentilators"
    },
    OPERATION_THEATRE: {
        available: "capacity.availableOTs",
        reserved:  "capacity.reservedOTs",
        occupied:  "capacity.occupiedOTs"
    },
    TRAUMA_BAY: {
        available: "capacity.availableTraumaBays",
        reserved:  "capacity.reservedTraumaBays",
        occupied:  "capacity.occupiedTraumaBays"
    },
    CT_SCAN: {
        available: "capacity.availableCtScanners",
        reserved:  "capacity.reservedCtScanners",
        occupied:  "capacity.occupiedCtScanners"
    },
    CATH_LAB: {
        available: "capacity.availableCathLabs",
        reserved:  "capacity.reservedCathLabs",
        occupied:  "capacity.occupiedCathLabs"
    },
    SPECIALIST: {
        available: "capacity.onDutySpecialist",
        reserved:  "capacity.reservedSpecialists",
        occupied:  "capacity.occupiedSpecialists"
    }
};

// ==========================================
// 2. Result Types
// ==========================================

export type ReservationOutcome =
    | "SUCCESS"
    | "RESOURCE_UNAVAILABLE"
    | "HOSPITAL_NOT_FOUND"
    | "RESERVATION_NOT_FOUND"
    | "INVALID_TRANSITION"
    | "ALREADY_PROCESSED"
    | "ERROR";

export interface ReservationResult {
    outcome: ReservationOutcome;
    reservationId?: string;
    reservation?: ReservationDoc;
    message: string;
}

// ==========================================
// 3. Reservation Document Shape
// ==========================================

export interface ReservationDoc {
    reservationId: string;
    emergencyId: string;
    hospitalId: string;
    resourceType: ResourceType;
    quantity: number;
    status: ReservationStatus;
    allocatedBy: "AUTO_ALLOCATOR" | "MANUAL_DISPATCH";
    createdAt: Date;
    expiresAt: Date;
    confirmedAt?: Date | null;
    admittedAt?: Date | null;
    dischargedAt?: Date | null;
    releasedAt?: Date | null;
    rejectedAt?: Date | null;
}

// ==========================================
// 4. ID / Event Generators
// ==========================================

function generateReservationId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `RES-${ts}-${rand}`;
}

function generateEventId(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `EVT-${ts}-${rand}`;
}

// State-machine terminal states — cannot transition out of these
const TERMINAL_STATES: ReservationStatus[] = ["RELEASED", "EXPIRED", "REJECTED", "CANCELLED", "FULFILLED", "DISCHARGED"];

// Valid transitions map — exhaustive over all ReservationStatus values
const VALID_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
    PENDING:    ["CONFIRMED", "ADMITTED", "REJECTED", "EXPIRED", "RELEASED"],
    CONFIRMED:  ["ADMITTED", "RELEASED", "REJECTED"],
    ADMITTED:   ["DISCHARGED", "RELEASED"],
    DISCHARGED: [],   // terminal
    HELD:       ["CONFIRMED", "ADMITTED", "RELEASED"],
    FULFILLED:  [],   // terminal
    EXPIRED:    [],   // terminal
    CANCELLED:  [],   // terminal
    RELEASED:   [],   // terminal — cannot re-open a released reservation
    REJECTED:   []    // terminal — cannot re-open a rejected reservation
};

// Map our simplified status to the extended type
function isTransitionValid(from: ReservationStatus, to: ReservationStatus): boolean {
    return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

async function recordHospitalEvent(
    db: Db,
    params: {
        hospitalId: string;
        eventType: HospitalEventType;
        emergencyId?: string;
        reservationId?: string;
        resourceType?: ResourceType;
        quantity?: number;
        details?: Record<string, any>;
    }
): Promise<void> {
    try {
        await db.collection("hospitalEvents").insertOne({
            eventId: generateEventId(),
            hospitalId: params.hospitalId,
            eventType: params.eventType,
            emergencyId: params.emergencyId ?? null,
            reservationId: params.reservationId ?? null,
            resourceType: params.resourceType ?? null,
            quantity: params.quantity ?? null,
            details: params.details ?? {},
            actorId: "AUTO_ALLOCATOR",
            timestamp: new Date()
        });
    } catch (err) {
        // Non-fatal — events are audit records, don't fail the main operation
        console.warn("hospitalEvents insert failed (non-fatal):", err);
    }
}

// ==========================================
// 5. reserveResource — ATOMIC
// ==========================================

export interface ReserveResourceParams {
    hospitalId: string;
    emergencyId: string;
    resourceType: ResourceType;
    quantity: number;
    ttlMinutes?: number;            // Default 30 min hold
    allocatedBy?: "AUTO_ALLOCATOR" | "MANUAL_DISPATCH";
    hospitalsCollection?: string;   // Allows test override
    reservationsCollection?: string;
}

export async function reserveResource(
    params: ReserveResourceParams,
    db?: Db
): Promise<ReservationResult> {
    const {
        hospitalId,
        emergencyId,
        resourceType,
        quantity,
        ttlMinutes = 30,
        allocatedBy = "AUTO_ALLOCATOR",
        hospitalsCollection = "hospitals",
        reservationsCollection = "reservations"
    } = params;

    const fields = RESOURCE_CAPACITY_MAP[resourceType];
    if (!fields) {
        return { outcome: "ERROR", message: `Unknown resource type: ${resourceType}` };
    }

    try {
        const resolvedDb = db ?? (await (await clientPromise).db());

        // ── ATOMIC STEP: Decrement available, increment reserved ──────────────
        // The filter includes the capacity guard. If available < quantity, no
        // document matches and the update returns null — no capacity consumed.
        // MongoDB's document-level locking guarantees two concurrent calls for
        // the same hospitalId cannot both match when quantity=1 and available=1.
        // ─────────────────────────────────────────────────────────────────────
        const capacityResult = await resolvedDb.collection(hospitalsCollection).findOneAndUpdate(
            {
                uid: hospitalId,
                [fields.available]: { $gte: quantity }   // ← atomic guard
            },
            {
                $inc: {
                    [fields.available]: -quantity,
                    [fields.reserved]:   quantity
                },
                $set: { "capacity.updatedAt": new Date() }
            },
            { returnDocument: "after" }
        );

        if (!capacityResult) {
            // Either hospital not found OR insufficient capacity
            const hospitalExists = await resolvedDb.collection(hospitalsCollection)
                .countDocuments({ uid: hospitalId }, { limit: 1 });

            if (hospitalExists === 0) {
                return { outcome: "HOSPITAL_NOT_FOUND", message: `Hospital ${hospitalId} not found.` };
            }
            return {
                outcome: "RESOURCE_UNAVAILABLE",
                message: `Insufficient ${resourceType} capacity at hospital ${hospitalId}. Requested: ${quantity}.`
            };
        }

        // ── Create reservation document ───────────────────────────────────────
        const now = new Date();
        const reservationId = generateReservationId();
        const reservation: ReservationDoc = {
            reservationId,
            emergencyId,
            hospitalId,
            resourceType,
            quantity,
            status: "PENDING",
            allocatedBy,
            createdAt: now,
            expiresAt: new Date(now.getTime() + ttlMinutes * 60 * 1000),
            confirmedAt: null,
            releasedAt: null,
            rejectedAt: null
        };

        await resolvedDb.collection(reservationsCollection).insertOne({ ...reservation });

        // ── Audit event ───────────────────────────────────────────────────────
        const eventType: HospitalEventType =
            resourceType === "ICU_BED"   ? "ICU_RESERVED" :
            resourceType === "VENTILATOR" ? "VENTILATOR_ASSIGNED" :
            "CAPACITY_OVERRIDE";

        await recordHospitalEvent(resolvedDb, {
            hospitalId,
            eventType,
            emergencyId,
            reservationId,
            resourceType,
            quantity,
            details: { action: "RESERVE", ttlMinutes }
        });

        return {
            outcome: "SUCCESS",
            reservationId,
            reservation,
            message: `${resourceType} reserved successfully (ID: ${reservationId}).`
        };

    } catch (err: any) {
        console.error("reserveResource error:", err);
        return { outcome: "ERROR", message: err?.message ?? String(err) };
    }
}

// ==========================================
// 6. releaseReservation — ATOMIC, idempotent
// ==========================================

export interface ReleaseReservationParams {
    reservationId: string;
    hospitalsCollection?: string;
    reservationsCollection?: string;
}

export async function releaseReservation(
    params: ReleaseReservationParams,
    db?: Db
): Promise<ReservationResult> {
    const {
        reservationId,
        hospitalsCollection = "hospitals",
        reservationsCollection = "reservations"
    } = params;

    try {
        const resolvedDb = db ?? (await (await clientPromise).db());
        const now = new Date();

        // ── ATOMIC STEP 1: Flip status only if currently releasable ──────────
        // The status filter is the guard against double-release.
        // A second call with the same reservationId will find status != PENDING/CONFIRMED
        // and return null — capacity will NOT be returned a second time.
        // ─────────────────────────────────────────────────────────────────────
        const updated = await resolvedDb.collection(reservationsCollection).findOneAndUpdate(
            {
                reservationId,
                status: { $in: ["PENDING", "CONFIRMED", "ADMITTED"] }  // only releasable states
            },
            { $set: { status: "RELEASED", releasedAt: now } },
            { returnDocument: "after" }
        );

        if (!updated) {
            const existing = await resolvedDb.collection(reservationsCollection)
                .findOne({ reservationId });

            if (!existing) {
                return { outcome: "RESERVATION_NOT_FOUND", message: `Reservation ${reservationId} not found.` };
            }
            // Already in a terminal state — idempotent no-op
            return {
                outcome: "ALREADY_PROCESSED",
                message: `Reservation ${reservationId} is already in terminal state: ${existing.status}.`
            };
        }

        const { hospitalId, resourceType, quantity, status: prevStatus } = updated;
        const fields = RESOURCE_CAPACITY_MAP[resourceType];

        if (!fields) {
            return { outcome: "ERROR", message: `Unknown resource type on reservation: ${resourceType}` };
        }

        // ── ATOMIC STEP 2: Return capacity ────────────────────────────────────
        // Determine which bucket to decrement based on previous state:
        // PENDING / CONFIRMED (pre-admission) → was reserved → decrement reservedField, increment availableField
        // ADMITTED / CONFIRMED (admitted)      → was occupied → decrement occupiedField, increment availableField
        const isOccupied = prevStatus === "ADMITTED" || (prevStatus === "CONFIRMED" && Boolean(updated.admittedAt));
        const decrementField = isOccupied ? fields.occupied : fields.reserved;

        await resolvedDb.collection(hospitalsCollection).updateOne(
            { uid: hospitalId },
            {
                $inc: {
                    [decrementField]:   -quantity,
                    [fields.available]:  quantity
                },
                $set: { "capacity.updatedAt": now }
            }
        );

        // ── Audit event ───────────────────────────────────────────────────────
        const eventType: HospitalEventType =
            resourceType === "ICU_BED"    ? "ICU_RELEASED" :
            resourceType === "VENTILATOR" ? "VENTILATOR_RELEASED" :
            prevStatus === "CONFIRMED"    ? "PATIENT_DISCHARGED" :
            "CAPACITY_OVERRIDE";

        await recordHospitalEvent(resolvedDb, {
            hospitalId,
            eventType,
            reservationId,
            resourceType,
            quantity,
            details: { action: "RELEASE", previousStatus: prevStatus }
        });

        return {
            outcome: "SUCCESS",
            reservationId,
            message: `Reservation ${reservationId} released. ${quantity}× ${resourceType} returned to available pool.`
        };

    } catch (err: any) {
        console.error("releaseReservation error:", err);
        return { outcome: "ERROR", message: err?.message ?? String(err) };
    }
}

// ==========================================
// 7. expireReservation — same as release, marks EXPIRED
// ==========================================

export async function expireReservation(
    params: ReleaseReservationParams,
    db?: Db
): Promise<ReservationResult> {
    const {
        reservationId,
        hospitalsCollection = "hospitals",
        reservationsCollection = "reservations"
    } = params;

    try {
        const resolvedDb = db ?? (await (await clientPromise).db());
        const now = new Date();

        const updated = await resolvedDb.collection(reservationsCollection).findOneAndUpdate(
            { reservationId, status: "PENDING" },   // only PENDING can expire
            { $set: { status: "EXPIRED", releasedAt: now } },
            { returnDocument: "after" }
        );

        if (!updated) {
            const existing = await resolvedDb.collection(reservationsCollection)
                .findOne({ reservationId });
            if (!existing) {
                return { outcome: "RESERVATION_NOT_FOUND", message: `Reservation ${reservationId} not found.` };
            }
            return {
                outcome: "ALREADY_PROCESSED",
                message: `Reservation ${reservationId} is already in state: ${existing.status}.`
            };
        }

        const { hospitalId, resourceType, quantity } = updated;
        const fields = RESOURCE_CAPACITY_MAP[resourceType];

        if (fields) {
            await resolvedDb.collection(hospitalsCollection).updateOne(
                { uid: hospitalId },
                {
                    $inc: {
                        [fields.reserved]:  -quantity,
                        [fields.available]:  quantity
                    },
                    $set: { "capacity.updatedAt": now }
                }
            );
        }

        await recordHospitalEvent(resolvedDb, {
            hospitalId,
            eventType: resourceType === "ICU_BED" ? "ICU_RELEASED" : "CAPACITY_OVERRIDE",
            reservationId,
            resourceType,
            quantity,
            details: { action: "EXPIRE" }
        });

        return {
            outcome: "SUCCESS",
            reservationId,
            message: `Reservation ${reservationId} expired. Capacity returned.`
        };

    } catch (err: any) {
        console.error("expireReservation error:", err);
        return { outcome: "ERROR", message: err?.message ?? String(err) };
    }
}

// ==========================================
// 8. rejectReservation
// ==========================================

export async function rejectReservation(
    params: ReleaseReservationParams,
    db?: Db
): Promise<ReservationResult> {
    const {
        reservationId,
        hospitalsCollection = "hospitals",
        reservationsCollection = "reservations"
    } = params;

    try {
        const resolvedDb = db ?? (await (await clientPromise).db());
        const now = new Date();

        const updated = await resolvedDb.collection(reservationsCollection).findOneAndUpdate(
            { reservationId, status: "PENDING" },
            { $set: { status: "REJECTED", rejectedAt: now } },
            { returnDocument: "after" }
        );

        if (!updated) {
            const existing = await resolvedDb.collection(reservationsCollection)
                .findOne({ reservationId });
            if (!existing) {
                return { outcome: "RESERVATION_NOT_FOUND", message: `Reservation ${reservationId} not found.` };
            }
            if (existing.status === "REJECTED" || existing.status === "RELEASED" || existing.status === "EXPIRED") {
                return {
                    outcome: "ALREADY_PROCESSED",
                    message: `Reservation ${reservationId} is already in state: ${existing.status}.`
                };
            }
            return {
                outcome: "INVALID_TRANSITION",
                message: `Cannot reject reservation from state: ${existing.status}.`
            };
        }

        const { hospitalId, resourceType, quantity } = updated;
        const fields = RESOURCE_CAPACITY_MAP[resourceType];

        if (fields) {
            await resolvedDb.collection(hospitalsCollection).updateOne(
                { uid: hospitalId },
                {
                    $inc: {
                        [fields.reserved]:  -quantity,
                        [fields.available]:  quantity
                    },
                    $set: { "capacity.updatedAt": now }
                }
            );
        }

        // Audit event: reservation rejected
        await recordHospitalEvent(resolvedDb, {
            hospitalId: updated.hospitalId,
            eventType: "RESERVATION_REJECTED",
            emergencyId: updated.emergencyId,
            reservationId,
            resourceType: updated.resourceType,
            quantity: updated.quantity,
            details: { action: "REJECT_RESERVATION" }
        });

        return {
            outcome: "SUCCESS",
            reservationId,
            message: `Reservation ${reservationId} rejected. Capacity returned.`
        };

    } catch (err: any) {
        console.error("rejectReservation error:", err);
        return { outcome: "ERROR", message: err?.message ?? String(err) };
    }
}

// ==========================================
// 9. confirmReservation — PENDING → CONFIRMED (en-route confirmation)
// ==========================================

export interface ConfirmReservationParams {
    reservationId: string;
    hospitalsCollection?: string;
    reservationsCollection?: string;
}

export async function confirmReservation(
    params: ConfirmReservationParams,
    db?: Db
): Promise<ReservationResult> {
    const {
        reservationId,
        reservationsCollection = "reservations"
    } = params;

    try {
        const resolvedDb = db ?? (await (await clientPromise).db());
        const now = new Date();

        // Atomically transition from PENDING to CONFIRMED
        // Capacity remains reserved (patient is en-route, bed held)
        const updated = await resolvedDb.collection(reservationsCollection).findOneAndUpdate(
            { reservationId, status: "PENDING" },
            { $set: { status: "CONFIRMED", confirmedAt: now } },
            { returnDocument: "after" }
        );

        if (!updated) {
            const existing = await resolvedDb.collection(reservationsCollection).findOne({ reservationId });
            if (!existing) {
                return { outcome: "RESERVATION_NOT_FOUND", message: `Reservation ${reservationId} not found.` };
            }
            if (existing.status === "CONFIRMED" || existing.status === "ADMITTED") {
                return { outcome: "ALREADY_PROCESSED", message: `Reservation ${reservationId} is already confirmed/admitted.` };
            }
            const from = existing.status as ReservationStatus;
            if (!isTransitionValid(from, "CONFIRMED")) {
                return {
                    outcome: "INVALID_TRANSITION",
                    message: `Cannot confirm reservation from state: ${from}.`
                };
            }
            return {
                outcome: "ALREADY_PROCESSED",
                message: `Reservation ${reservationId} is already in state: ${existing.status}.`
            };
        }

        await recordHospitalEvent(resolvedDb, {
            hospitalId: updated.hospitalId,
            eventType: "RESERVATION_CONFIRMED",
            emergencyId: updated.emergencyId,
            reservationId,
            resourceType: updated.resourceType,
            quantity: updated.quantity,
            details: { action: "CONFIRM_RESERVATION" }
        });

        return {
            outcome: "SUCCESS",
            reservationId,
            reservation: updated as unknown as ReservationDoc,
            message: `Reservation ${reservationId} confirmed by hospital.`
        };
    } catch (err: any) {
        console.error("confirmReservation error:", err);
        return { outcome: "ERROR", message: err?.message ?? String(err) };
    }
}

// ==========================================
// 10. admitPatient — CONFIRMED | PENDING → ADMITTED (reserved → occupied)
// ==========================================

export interface AdmitPatientParams {
    reservationId: string;
    hospitalsCollection?: string;
    reservationsCollection?: string;
}

export async function admitPatient(
    params: AdmitPatientParams,
    db?: Db
): Promise<ReservationResult> {
    const {
        reservationId,
        hospitalsCollection = "hospitals",
        reservationsCollection = "reservations"
    } = params;

    try {
        const resolvedDb = db ?? (await (await clientPromise).db());
        const now = new Date();

        // Atomically transition from PENDING or CONFIRMED to ADMITTED
        const updated = await resolvedDb.collection(reservationsCollection).findOneAndUpdate(
            { reservationId, status: { $in: ["PENDING", "CONFIRMED"] } },
            {
                $set: {
                    status: "ADMITTED",
                    admittedAt: now,
                    confirmedAt: now
                }
            },
            { returnDocument: "after" }
        );

        if (!updated) {
            const existing = await resolvedDb.collection(reservationsCollection).findOne({ reservationId });
            if (!existing) {
                return { outcome: "RESERVATION_NOT_FOUND", message: `Reservation ${reservationId} not found.` };
            }
            if (existing.status === "ADMITTED") {
                return { outcome: "ALREADY_PROCESSED", message: `Patient for reservation ${reservationId} is already ADMITTED.` };
            }
            const from = existing.status as ReservationStatus;
            if (!isTransitionValid(from, "ADMITTED")) {
                return {
                    outcome: "INVALID_TRANSITION",
                    message: `Cannot admit patient from reservation state: ${from}.`
                };
            }
            return {
                outcome: "ALREADY_PROCESSED",
                message: `Reservation ${reservationId} is already in state: ${existing.status}.`
            };
        }

        const { hospitalId, resourceType, quantity, emergencyId } = updated;
        const fields = RESOURCE_CAPACITY_MAP[resourceType];

        // Move from reserved bucket → occupied bucket
        // available stays the same (was already decremented on reserve)
        // Invariant: total - (occupied + 1) - (reserved - 1) = available holds!
        if (fields) {
            await resolvedDb.collection(hospitalsCollection).updateOne(
                { $or: [{ uid: hospitalId }, { hospitalId: hospitalId }] },
                {
                    $inc: {
                        [fields.reserved]: -quantity,
                        [fields.occupied]:  quantity
                    },
                    $set: { "capacity.updatedAt": now }
                }
            );
        }

        await recordHospitalEvent(resolvedDb, {
            hospitalId,
            eventType: "PATIENT_ADMITTED",
            emergencyId,
            reservationId,
            resourceType,
            quantity,
            details: { action: "ADMIT_PATIENT" }
        });

        return {
            outcome: "SUCCESS",
            reservationId,
            reservation: updated as unknown as ReservationDoc,
            message: `Patient admitted for reservation ${reservationId}. ${quantity}× ${resourceType} transitioned from reserved to occupied.`
        };
    } catch (err: any) {
        console.error("admitPatient error:", err);
        return { outcome: "ERROR", message: err?.message ?? String(err) };
    }
}

// ==========================================
// 11. confirmAdmission — Compatibility wrapper for admission
// ==========================================

export interface ConfirmAdmissionParams {
    reservationId: string;
    hospitalsCollection?: string;
    reservationsCollection?: string;
    targetStatus?: "CONFIRMED" | "ADMITTED";
}

export async function confirmAdmission(
    params: ConfirmAdmissionParams,
    db?: Db
): Promise<ReservationResult> {
    const {
        reservationId,
        hospitalsCollection = "hospitals",
        reservationsCollection = "reservations",
        targetStatus = "CONFIRMED"
    } = params;

    try {
        const resolvedDb = db ?? (await (await clientPromise).db());
        const now = new Date();

        const updated = await resolvedDb.collection(reservationsCollection).findOneAndUpdate(
            { reservationId, status: { $in: ["PENDING", "CONFIRMED"] } },
            {
                $set: {
                    status: targetStatus,
                    confirmedAt: now,
                    admittedAt: now
                }
            },
            { returnDocument: "after" }
        );

        if (!updated) {
            const existing = await resolvedDb.collection(reservationsCollection)
                .findOne({ reservationId });
            if (!existing) {
                return { outcome: "RESERVATION_NOT_FOUND", message: `Reservation ${reservationId} not found.` };
            }

            const from = existing.status as ReservationStatus;
            if (!isTransitionValid(from, targetStatus)) {
                return {
                    outcome: "INVALID_TRANSITION",
                    message: `Cannot confirm reservation from state: ${from}. Forbidden transition.`
                };
            }
            return {
                outcome: "ALREADY_PROCESSED",
                message: `Reservation ${reservationId} is already in state: ${existing.status}.`
            };
        }

        const { hospitalId, resourceType, quantity, emergencyId } = updated;
        const fields = RESOURCE_CAPACITY_MAP[resourceType];

        // Move from reserved bucket → occupied bucket
        if (fields) {
            await resolvedDb.collection(hospitalsCollection).updateOne(
                { uid: hospitalId },
                {
                    $inc: {
                        [fields.reserved]: -quantity,
                        [fields.occupied]:  quantity
                    },
                    $set: { "capacity.updatedAt": now }
                }
            );
        }

        await recordHospitalEvent(resolvedDb, {
            hospitalId,
            eventType: "PATIENT_ADMITTED",
            emergencyId,
            reservationId,
            resourceType,
            quantity,
            details: { action: "CONFIRM_ADMISSION", targetStatus }
        });

        return {
            outcome: "SUCCESS",
            reservationId,
            reservation: updated as unknown as ReservationDoc,
            message: `Admission confirmed for reservation ${reservationId}. Patient now occupying ${quantity}× ${resourceType}.`
        };

    } catch (err: any) {
        console.error("confirmAdmission error:", err);
        return { outcome: "ERROR", message: err?.message ?? String(err) };
    }
}

// ==========================================
// 12. dischargePatient — ADMITTED | CONFIRMED → DISCHARGED (occupied → available)
// ==========================================

export interface DischargePatientParams {
    reservationId: string;
    hospitalsCollection?: string;
    reservationsCollection?: string;
}

export async function dischargePatient(
    params: DischargePatientParams,
    db?: Db
): Promise<ReservationResult> {
    const {
        reservationId,
        hospitalsCollection = "hospitals",
        reservationsCollection = "reservations"
    } = params;

    try {
        const resolvedDb = db ?? (await (await clientPromise).db());
        const now = new Date();

        // Atomically transition from ADMITTED or CONFIRMED (where patient was admitted) to DISCHARGED
        const updated = await resolvedDb.collection(reservationsCollection).findOneAndUpdate(
            { reservationId, status: { $in: ["ADMITTED", "CONFIRMED"] } },
            { $set: { status: "DISCHARGED", dischargedAt: now } },
            { returnDocument: "after" }
        );

        if (!updated) {
            const existing = await resolvedDb.collection(reservationsCollection).findOne({ reservationId });
            if (!existing) {
                return { outcome: "RESERVATION_NOT_FOUND", message: `Reservation ${reservationId} not found.` };
            }
            if (existing.status === "DISCHARGED" || existing.status === "RELEASED") {
                return { outcome: "ALREADY_PROCESSED", message: `Reservation ${reservationId} is already DISCHARGED.` };
            }
            return {
                outcome: "INVALID_TRANSITION",
                message: `Cannot discharge patient from state: ${existing.status}.`
            };
        }

        const { hospitalId, resourceType, quantity, emergencyId } = updated;
        const fields = RESOURCE_CAPACITY_MAP[resourceType];

        // Discharge releases OCCUPIED capacity back to AVAILABLE
        // Invariant: total - (occupied - 1) - reserved = available + 1 holds!
        if (fields) {
            await resolvedDb.collection(hospitalsCollection).updateOne(
                { uid: hospitalId },
                {
                    $inc: {
                        [fields.occupied]:  -quantity,
                        [fields.available]:  quantity
                    },
                    $set: { "capacity.updatedAt": now }
                }
            );
        }

        await recordHospitalEvent(resolvedDb, {
            hospitalId,
            eventType: "PATIENT_DISCHARGED",
            emergencyId,
            reservationId,
            resourceType,
            quantity,
            details: { action: "DISCHARGE_PATIENT" }
        });

        return {
            outcome: "SUCCESS",
            reservationId,
            reservation: updated as unknown as ReservationDoc,
            message: `Patient discharged. ${quantity}× ${resourceType} returned from occupied to available pool.`
        };
    } catch (err: any) {
        console.error("dischargePatient error:", err);
        return { outcome: "ERROR", message: err?.message ?? String(err) };
    }
}
