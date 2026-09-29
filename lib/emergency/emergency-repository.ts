import { Db, Collection } from "mongodb";
import clientPromise from "@/lib/mongodb";
import {
    EmergencyRequest,
    Ambulance,
    Reservation,
    HospitalEvent,
    Handoff
} from "./emergency-types";

// ==========================================
// Collection Names Constants
// ==========================================

export const EMERGENCY_COLLECTIONS = {
    REQUESTS: "emergencyRequests",
    AMBULANCES: "ambulances",
    RESERVATIONS: "reservations",
    EVENTS: "hospitalEvents",
    HANDOFFS: "handoffs",
    EMS_DATASET: "ems_events",
    CAPACITY_BENCHMARKS: "hospital_capacity_benchmarks"
} as const;

// ==========================================
// Typed Collection Getters
// ==========================================

export function getEmergencyRequestsCollection(db: Db): Collection<EmergencyRequest> {
    return db.collection<EmergencyRequest>(EMERGENCY_COLLECTIONS.REQUESTS);
}

export function getAmbulancesCollection(db: Db): Collection<Ambulance> {
    return db.collection<Ambulance>(EMERGENCY_COLLECTIONS.AMBULANCES);
}

export function getReservationsCollection(db: Db): Collection<Reservation> {
    return db.collection<Reservation>(EMERGENCY_COLLECTIONS.RESERVATIONS);
}

export function getHospitalEventsCollection(db: Db): Collection<HospitalEvent> {
    return db.collection<HospitalEvent>(EMERGENCY_COLLECTIONS.EVENTS);
}

export function getHandoffsCollection(db: Db): Collection<Handoff> {
    return db.collection<Handoff>(EMERGENCY_COLLECTIONS.HANDOFFS);
}

/**
 * Initialize all required indexes for emergency allocator domain collections.
 * Safe to call repeatedly (idempotent).
 */
export async function initEmergencyIndexes(db: Db): Promise<{
    success: boolean;
    createdIndexes: Record<string, string[]>;
}> {
    const createdIndexes: Record<string, string[]> = {};

    try {
        // 1. emergencyRequests Indexes
        const reqCol = db.collection(EMERGENCY_COLLECTIONS.REQUESTS);
        const idx1 = await reqCol.createIndex({ emergencyId: 1 }, { unique: true });
        const idx2 = await reqCol.createIndex({ status: 1 });
        const idx3 = await reqCol.createIndex({ priority: 1 });
        const idx4 = await reqCol.createIndex({ createdAt: -1 });
        const idx5 = await reqCol.createIndex({ ambulanceId: 1 });
        const idx6 = await reqCol.createIndex({ allocatedHospitalId: 1 });
        const idx7 = await reqCol.createIndex({ "incidentLocation.latitude": 1, "incidentLocation.longitude": 1 });
        createdIndexes[EMERGENCY_COLLECTIONS.REQUESTS] = [idx1, idx2, idx3, idx4, idx5, idx6, idx7];

        // 2. ambulances Indexes
        const ambCol = db.collection(EMERGENCY_COLLECTIONS.AMBULANCES);
        const aIdx1 = await ambCol.createIndex({ ambulanceId: 1 }, { unique: true });
        const aIdx2 = await ambCol.createIndex({ status: 1 });
        const aIdx3 = await ambCol.createIndex({ currentEmergencyId: 1 });
        const aIdx4 = await ambCol.createIndex({ destinationHospitalId: 1 });
        createdIndexes[EMERGENCY_COLLECTIONS.AMBULANCES] = [aIdx1, aIdx2, aIdx3, aIdx4];

        // 3. reservations Indexes
        const resCol = db.collection(EMERGENCY_COLLECTIONS.RESERVATIONS);
        const rIdx1 = await resCol.createIndex({ reservationId: 1 }, { unique: true });
        const rIdx2 = await resCol.createIndex({ emergencyId: 1 });
        const rIdx3 = await resCol.createIndex({ hospitalId: 1 });
        const rIdx4 = await resCol.createIndex({ status: 1 });
        const rIdx5 = await resCol.createIndex({ expiresAt: 1 });
        const rIdx6 = await resCol.createIndex({ hospitalId: 1, status: 1 });
        createdIndexes[EMERGENCY_COLLECTIONS.RESERVATIONS] = [rIdx1, rIdx2, rIdx3, rIdx4, rIdx5, rIdx6];

        // 4. hospitalEvents Indexes
        const evtCol = db.collection(EMERGENCY_COLLECTIONS.EVENTS);
        const eIdx1 = await evtCol.createIndex({ eventId: 1 }, { unique: true });
        const eIdx2 = await evtCol.createIndex({ hospitalId: 1, timestamp: -1 });
        const eIdx3 = await evtCol.createIndex({ eventType: 1 });
        const eIdx4 = await evtCol.createIndex({ emergencyId: 1 });
        createdIndexes[EMERGENCY_COLLECTIONS.EVENTS] = [eIdx1, eIdx2, eIdx3, eIdx4];

        // 5. handoffs Indexes
        const hndCol = db.collection(EMERGENCY_COLLECTIONS.HANDOFFS);
        const hIdx1 = await hndCol.createIndex({ handoffId: 1 }, { unique: true });
        const hIdx2 = await hndCol.createIndex({ emergencyId: 1 });
        const hIdx3 = await hndCol.createIndex({ ambulanceId: 1 });
        const hIdx4 = await hndCol.createIndex({ hospitalId: 1 });
        const hIdx5 = await hndCol.createIndex({ status: 1 });
        const hIdx6 = await hndCol.createIndex({ arrivalTime: -1 });
        createdIndexes[EMERGENCY_COLLECTIONS.HANDOFFS] = [hIdx1, hIdx2, hIdx3, hIdx4, hIdx5, hIdx6];

        return { success: true, createdIndexes };
    } catch (error: any) {
        console.error("Failed to initialize emergency domain indexes:", error);
        throw error;
    }
}

/**
 * Convenience helper to initialize indexes using shared database client
 */
export async function setupEmergencyIndexes() {
    const client = await clientPromise;
    const db = client.db();
    return await initEmergencyIndexes(db);
}
