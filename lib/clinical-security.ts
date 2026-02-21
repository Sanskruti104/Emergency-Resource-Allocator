import clientPromise from "./mongodb";
import { ObjectId } from "mongodb";

export type AuditAction =
    | "DOCTOR_RECRUITMENT"
    | "PROFILE_UPDATE"
    | "VERIFICATION_STATUS"
    | "AFFILIATION_REMOVED";

export interface AuditEntry {
    actorUid: string;
    targetId: string;
    action: AuditAction;
    timestamp: Date;
    details: any;
    ipAddress?: string;
}

/**
 * Log a clinical security event to the audit trail
 */
export async function logClinicalAudit(entry: AuditEntry) {
    try {
        const client = await clientPromise;
        const db = client.db();
        await db.collection("clinical_audit_logs").insertOne({
            ...entry,
            timestamp: new Date()
        });
    } catch (error) {
        console.error("Clinical Audit Failure:", error);
    }
}

/**
 * Capture a snapshot of a profile before modification for historical tracking
 */
export async function trackProfileChange(doctorId: string, previousData: any, updatedBy: string) {
    try {
        const client = await clientPromise;
        const db = client.db();
        await db.collection("doctor_profile_history").insertOne({
            doctorId: new ObjectId(doctorId),
            snapshot: previousData,
            updatedBy,
            changedAt: new Date()
        });
    } catch (error) {
        console.error("History Tracking Failure:", error);
    }
}
