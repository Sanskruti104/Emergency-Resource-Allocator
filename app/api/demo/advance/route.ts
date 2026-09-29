import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { allocateEmergencyHospital } from "@/lib/emergency/emergency-allocator";
import {
    reserveResource,
    confirmReservation,
    admitPatient
} from "@/lib/emergency/emergency-reservation";
import { POST as handleHandoffAction } from "@/app/api/emergency/handoff/action/route";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo/advance
 * Advances the active demo scenario to the next valid lifecycle stage.
 * Executes the exact same backend transitions as the interactive buttons.
 */
export async function POST() {
    try {
        const client = await clientPromise;
        const db = client.db();
        const now = new Date();

        // 1. Fetch active demo emergency
        const emergency = await db.collection("emergencyRequests").findOne({
            $or: [
                { source: { $in: ["DEMO_SCENARIO", "EMS_SIMULATION"] } },
                { isDemo: true },
                { emergencyId: { $regex: "^DEMO-" } }
            ],
            status: { $nin: ["ADMITTED", "CANCELLED", "REJECTED"] }
        });

        if (!emergency) {
            return NextResponse.json(
                { success: false, error: "No active demo scenario found to advance." },
                { status: 404 }
            );
        }

        const emergencyId = emergency.emergencyId;
        const ambulanceId = emergency.ambulanceId || "AMB-PUNE-01";

        // Fetch active reservation if any
        let reservation = await db.collection("reservations").findOne({
            emergencyId,
            status: { $in: ["PENDING", "CONFIRMED"] }
        });

        // ── STAGE 1: PENDING → DISPATCHED ────────────────────────────────────
        if (emergency.status === "PENDING") {
            await db.collection("emergencyRequests").updateOne(
                { emergencyId },
                { $set: { status: "DISPATCHED", ambulanceId, updatedAt: now } }
            );
            await db.collection("ambulances").updateOne(
                { ambulanceId },
                {
                    $set: {
                        status: "DISPATCHED",
                        currentEmergencyId: emergencyId,
                        transportStatus: null,
                        updatedAt: now
                    }
                }
            );
            return NextResponse.json({
                success: true,
                stage: "DISPATCHED",
                message: "Ambulance unit dispatched to patient incident location."
            });
        }

        // ── STAGE 2: DISPATCHED → ON_SCENE ───────────────────────────────────
        if (emergency.status === "DISPATCHED") {
            await db.collection("emergencyRequests").updateOne(
                { emergencyId },
                { $set: { status: "ON_SCENE", arrivedSceneAt: now, updatedAt: now } }
            );
            await db.collection("ambulances").updateOne(
                { ambulanceId },
                { $set: { status: "ON_SCENE", updatedAt: now } }
            );
            return NextResponse.json({
                success: true,
                stage: "ON_SCENE",
                message: "Ambulance arrived on scene. Paramedics assessing patient."
            });
        }

        // ── STAGE 3: ON_SCENE → PATIENT SECURED & ALLOCATED ──────────────────
        if (emergency.status === "ON_SCENE") {
            const allocResult = await allocateEmergencyHospital({
                intake: {
                    condition: emergency.condition,
                    chiefComplaint: emergency.chiefComplaint,
                    triagePriority: emergency.priority,
                    latitude: emergency.incidentLocation?.latitude || 18.5204,
                    longitude: emergency.incidentLocation?.longitude || 73.8567
                },
                requiredSpecialty: emergency.requiredSpecialty
            });

            const topHospital = allocResult.results.find((h) => h.suitability) || allocResult.results[0];
            const allocatedHospitalId = topHospital?.hospitalId || "DEMO-HOSP-CARDIAC-001";

            await db.collection("emergencyRequests").updateOne(
                { emergencyId },
                {
                    $set: {
                        status: "TRANSPORTING",
                        allocatedHospitalId,
                        patientSecuredAt: now,
                        updatedAt: now
                    }
                }
            );
            await db.collection("ambulances").updateOne(
                { ambulanceId },
                {
                    $set: {
                        status: "TRANSPORTING",
                        destinationHospitalId: allocatedHospitalId,
                        updatedAt: now
                    }
                }
            );
            return NextResponse.json({
                success: true,
                stage: "TRANSPORTING",
                message: `Patient secured. Receiving facility allocated: ${topHospital?.hospitalName || allocatedHospitalId}.`
            });
        }

        // ── STAGE 4: ALLOCATED → BED RESERVATION REQUESTED ───────────────────
        if (emergency.status === "TRANSPORTING" && !reservation) {
            const targetHospitalId = emergency.allocatedHospitalId || "DEMO-HOSP-CARDIAC-001";
            const resourceType = emergency.requiredResources?.includes("ICU_BED") ? "ICU_BED" : "GENERAL_BED";

            const resvResult = await reserveResource({
                hospitalId: targetHospitalId,
                emergencyId,
                resourceType,
                quantity: 1,
                ttlMinutes: 45,
                allocatedBy: "AUTO_ALLOCATOR"
            }, db);

            if (resvResult.outcome === "SUCCESS") {
                await db.collection("emergencyRequests").updateOne(
                    { emergencyId },
                    { $set: { reservationId: resvResult.reservationId, updatedAt: now } }
                );
                return NextResponse.json({
                    success: true,
                    stage: "RESERVATION_REQUESTED",
                    message: "Bed reservation request submitted to hospital intake board."
                });
            } else {
                return NextResponse.json({
                    success: false,
                    stage: "RESERVATION_FAILED",
                    message: `Bed reservation could not be completed: ${resvResult.message}`
                });
            }
        }

        // ── STAGE 5: RESERVATION PENDING → HOSPITAL ACCEPTS (CONFIRMED) ─────
        if (reservation && reservation.status === "PENDING") {
            const confirmResult = await confirmReservation({ reservationId: reservation.reservationId }, db);
            if (confirmResult.outcome === "SUCCESS") {
                await db.collection("emergencyRequests").updateOne(
                    { emergencyId },
                    { $set: { receivingHospitalId: reservation.hospitalId, destinationConfirmedAt: now, updatedAt: now } }
                );
                return NextResponse.json({
                    success: true,
                    stage: "DESTINATION_CONFIRMED",
                    message: "Hospital emergency intake confirmed and secured bed reservation."
                });
            }
        }

        // ── STAGE 6: DESTINATION CONFIRMED → START HOSPITAL TRANSPORT ────────
        if (emergency.status === "TRANSPORTING" && (!emergency.transportStatus || emergency.transportStatus === "IDLE")) {
            await db.collection("emergencyRequests").updateOne(
                { emergencyId },
                { $set: { transportStatus: "EN_ROUTE", transportStartedAt: now, updatedAt: now } }
            );
            await db.collection("ambulances").updateOne(
                { ambulanceId },
                { $set: { transportStatus: "EN_ROUTE", status: "TRANSPORTING", updatedAt: now } }
            );
            return NextResponse.json({
                success: true,
                stage: "EN_ROUTE",
                message: "Ambulance in transit to receiving hospital with emergency escort."
            });
        }

        // ── STAGE 7: EN_ROUTE → ARRIVED AT HOSPITAL BAY ──────────────────────
        if (emergency.transportStatus === "EN_ROUTE") {
            await db.collection("emergencyRequests").updateOne(
                { emergencyId },
                {
                    $set: {
                        status: "ARRIVED",
                        transportStatus: "ARRIVED",
                        arrivedHospitalAt: now,
                        updatedAt: now
                    }
                }
            );
            await db.collection("ambulances").updateOne(
                { ambulanceId },
                {
                    $set: {
                        status: "AT_HOSPITAL",
                        transportStatus: "ARRIVED",
                        ETA: 0,
                        updatedAt: now
                    }
                }
            );
            return NextResponse.json({
                success: true,
                stage: "ARRIVED",
                message: "Ambulance arrived at Emergency Department bay."
            });
        }

        // ── STAGE 8: ARRIVED → START CLINICAL HANDOFF ────────────────────────
        if (emergency.status === "ARRIVED" && emergency.handoffStatus !== "IN_PROGRESS") {
            const targetHospitalId = emergency.receivingHospitalId || emergency.allocatedHospitalId || reservation?.hospitalId;
            const handoffReq = new Request("http://localhost:3000/api/emergency/handoff/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emergencyId,
                    action: "START_HANDOFF",
                    hospitalId: targetHospitalId,
                    ambulanceId,
                    reservationId: reservation?.reservationId
                })
            });
            const handoffRes = await handleHandoffAction(handoffReq);
            const handoffData = await handoffRes.json();

            if (handoffRes.ok && handoffData.success) {
                return NextResponse.json({
                    success: true,
                    stage: "HANDOFF_IN_PROGRESS",
                    message: "Clinical handoff initiated. Care team receiving patient."
                });
            }
        }

        // ── STAGE 9: HANDOFF IN PROGRESS → COMPLETE HANDOFF & ADMIT ──────────
        if (emergency.handoffStatus === "IN_PROGRESS") {
            const targetHospitalId = emergency.receivingHospitalId || emergency.allocatedHospitalId || reservation?.hospitalId;
            const completeReq = new Request("http://localhost:3000/api/emergency/handoff/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emergencyId,
                    action: "COMPLETE_HANDOFF",
                    hospitalId: targetHospitalId,
                    ambulanceId,
                    reservationId: reservation?.reservationId
                })
            });
            const completeRes = await handleHandoffAction(completeReq);
            const completeData = await completeRes.json();

            if (completeRes.ok && completeData.success) {
                return NextResponse.json({
                    success: true,
                    stage: "ADMITTED",
                    message: "Patient formally admitted. Reserved bed transferred to occupied. Ambulance released to AVAILABLE."
                });
            }
        }

        return NextResponse.json({
            success: true,
            stage: emergency.status,
            message: `Current stage is ${emergency.status}.`
        });

    } catch (err: any) {
        console.error("POST /api/demo/advance error:", err);
        return NextResponse.json(
            { success: false, error: "Unable to advance scenario stage." },
            { status: 500 }
        );
    }
}
