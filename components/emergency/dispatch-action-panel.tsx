"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Ambulance,
    ShieldCheck,
    Lock,
    Unlock,
    FastForward,
    CheckCircle2,
    Hospital,
    Radio,
    Clock,
    Navigation,
    UserCheck,
    LogOut,
    AlertCircle,
    Loader2
} from "lucide-react";
import { toast } from "sonner";

export interface AmbulanceData {
    ambulanceId: string;
    status: "IDLE" | "ASSIGNED" | "DISPATCHED" | "EN_ROUTE" | "ARRIVED" | "HANDOFF" | "AVAILABLE";
    assignedHospitalId?: string;
    currentLocation?: { latitude: number; longitude: number };
    destinationLocation?: { latitude: number; longitude: number };
    speedKmH?: number;
    etaMinutes?: number;
    telemetrySource?: string;
    assignedHospitalName?: string;
}

export interface ReservationData {
    reservationId: string;
    hospitalId: string;
    hospitalName?: string;
    resourceType: string;
    quantity: number;
    status: "PENDING" | "CONFIRMED" | "ADMITTED" | "DISCHARGED" | "RELEASED" | "EXPIRED" | "REJECTED";
    expiresAt?: string;
    allocatedBy?: string;
}

interface DispatchActionPanelProps {
    ambulance?: AmbulanceData;
    reservation?: ReservationData;
    selectedHospitalName?: string;
    selectedHospitalId?: string;
    emergencyId?: string;
    onRefresh: () => Promise<void>;
}

export function DispatchActionPanel({
    ambulance,
    reservation,
    selectedHospitalName,
    selectedHospitalId,
    emergencyId,
    onRefresh
}: DispatchActionPanelProps) {
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // 1. Confirm Reservation (PENDING -> CONFIRMED)
    const handleConfirmReservation = async () => {
        if (!reservation) return;
        setActionLoading("confirm");
        try {
            const res = await fetch(`/api/emergency/reservations/${reservation.reservationId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "confirm" })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Reservation confirmed for transport lock.");
                await onRefresh();
            } else {
                toast.error(data.error || "Failed to confirm reservation.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to confirm reservation.");
        } finally {
            setActionLoading(null);
        }
    };

    // 2. Release Reservation
    const handleReleaseReservation = async () => {
        if (!reservation) return;
        setActionLoading("release");
        try {
            const res = await fetch(`/api/emergency/reservations/${reservation.reservationId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "release", notes: "Manual release by dispatch operator" })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Reservation released and capacity restored.");
                await onRefresh();
            } else {
                toast.error(data.error || "Failed to release reservation.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to release reservation.");
        } finally {
            setActionLoading(null);
        }
    };

    // 3. Advance Ambulance Simulation (DISPATCHED -> EN_ROUTE -> ARRIVED -> HANDOFF)
    const handleAdvanceSimulation = async () => {
        if (!ambulance) return;

        let targetStatus: "DISPATCHED" | "EN_ROUTE" | "ARRIVED" | "HANDOFF" = "EN_ROUTE";
        if (ambulance.status === "DISPATCHED") targetStatus = "EN_ROUTE";
        else if (ambulance.status === "EN_ROUTE") targetStatus = "ARRIVED";
        else if (ambulance.status === "ARRIVED") targetStatus = "HANDOFF";
        else if (ambulance.status === "HANDOFF") {
            toast.info("Ambulance handoff already completed.");
            return;
        }

        setActionLoading("advance");
        try {
            const res = await fetch("/api/emergency/advance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ambulanceId: ambulance.ambulanceId,
                    step: targetStatus,
                    targetStatus
                })
            });
            const data = await res.json();
            if (data.success) {
                if (targetStatus === "HANDOFF") {
                    toast.success("Handoff completed! Patient automatically admitted and capacity updated.");
                } else {
                    toast.success(`Ambulance advanced to ${targetStatus}`);
                }
                await onRefresh();
            } else {
                toast.error(data.error || "Failed to advance simulation.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to advance simulation.");
        } finally {
            setActionLoading(null);
        }
    };

    // 4. Manual Direct Admit
    const handleAdmitPatient = async () => {
        if (!reservation) return;
        setActionLoading("admit");
        try {
            const res = await fetch(`/api/emergency/reservations/${reservation.reservationId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "admit" })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Patient admitted! Capacity shifted from reserved to occupied.");
                await onRefresh();
            } else {
                toast.error(data.error || "Failed to admit patient.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to admit patient.");
        } finally {
            setActionLoading(null);
        }
    };

    // 5. Discharge Patient
    const handleDischargePatient = async () => {
        if (!reservation) return;
        setActionLoading("discharge");
        try {
            const res = await fetch(`/api/emergency/reservations/${reservation.reservationId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "discharge" })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Patient discharged! Occupied bed released back to available.");
                await onRefresh();
            } else {
                toast.error(data.error || "Failed to discharge patient.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to discharge patient.");
        } finally {
            setActionLoading(null);
        }
    };

    const isPending = reservation?.status === "PENDING";
    const isConfirmed = reservation?.status === "CONFIRMED";
    const isAdmitted = reservation?.status === "ADMITTED";
    const isDischarged = reservation?.status === "DISCHARGED";

    return (
        <Card className="p-4 sm:p-5 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <Ambulance className="w-5 h-5 text-amber-600" />
                    <div>
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            Dispatch &amp; Reservation Control
                        </h3>
                        <p className="text-xs text-slate-500">
                            Atomic MongoDB locks with simulated GPS telemetry
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 font-mono">
                        SIMULATION TELEMETRY
                    </Badge>
                </div>
            </div>

            {/* Grid of Reservation and Ambulance Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Reservation Box */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-blue-600" /> Bed Reservation State
                        </span>
                        {reservation ? (
                            <Badge
                                className={`text-[10px] uppercase font-mono ${
                                    isAdmitted
                                        ? "bg-emerald-600 text-white"
                                        : isConfirmed
                                        ? "bg-blue-600 text-white"
                                        : isPending
                                        ? "bg-amber-600 text-white"
                                        : "bg-slate-500 text-white"
                                }`}
                            >
                                {reservation.status}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-400">
                                NO ACTIVE LOCK
                            </Badge>
                        )}
                    </div>

                    {reservation ? (
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Facility:</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                                    {reservation.hospitalName || selectedHospitalName || reservation.hospitalId}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Resource:</span>
                                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {reservation.resourceType} ({reservation.quantity} unit)
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Reservation ID:</span>
                                <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                    {reservation.reservationId.slice(-8)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Allocated By:</span>
                                <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                    {reservation.allocatedBy || "AUTO_ALLOCATOR"}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic py-2">
                            Select a suitable hospital above and click &quot;Reserve Resource&quot; to acquire an atomic bed lock.
                        </p>
                    )}
                </div>

                {/* Ambulance Unit Box */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <Navigation className="w-3.5 h-3.5 text-amber-600" /> Ambulance Dispatch Unit
                        </span>
                        {ambulance ? (
                            <Badge
                                variant="outline"
                                className="text-[10px] font-mono border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40"
                            >
                                {ambulance.status}
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-[10px] text-slate-400">
                                UNASSIGNED
                            </Badge>
                        )}
                    </div>

                    {ambulance ? (
                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Unit ID:</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {ambulance.ambulanceId}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Speed / Velocity:</span>
                                <span className="font-mono text-slate-800 dark:text-slate-200">
                                    {ambulance.speedKmH ?? 0} km/h (Simulated)
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Live ETA:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                    {ambulance.etaMinutes ?? 0} mins remaining
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Destination:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[180px]">
                                    {ambulance.assignedHospitalName || selectedHospitalName || "Target Facility"}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic py-2">
                            Run a simulation scenario to dispatch an ambulance unit with live telemetry.
                        </p>
                    )}
                </div>
            </div>

            {/* Action Buttons Toolbar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Advance Simulation Step */}
                    {ambulance && ambulance.status !== "HANDOFF" && (
                        <Button
                            type="button"
                            size="sm"
                            disabled={actionLoading === "advance"}
                            onClick={handleAdvanceSimulation}
                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 font-semibold shadow-sm"
                        >
                            {actionLoading === "advance" ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <FastForward className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Advance Simulation ({ambulance.status === "DISPATCHED" ? "En Route" : ambulance.status === "EN_ROUTE" ? "Arrived" : "Handoff"})
                        </Button>
                    )}

                    {/* Confirm Reservation */}
                    {isPending && (
                        <Button
                            type="button"
                            size="sm"
                            disabled={actionLoading === "confirm"}
                            onClick={handleConfirmReservation}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 font-semibold shadow-sm"
                        >
                            {actionLoading === "confirm" ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Confirm Reservation
                        </Button>
                    )}

                    {/* Admit Patient Directly */}
                    {(isConfirmed || isPending) && ambulance?.status === "ARRIVED" && (
                        <Button
                            type="button"
                            size="sm"
                            disabled={actionLoading === "admit"}
                            onClick={handleAdmitPatient}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-semibold shadow-sm"
                        >
                            {actionLoading === "admit" ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Admit Patient (Shift Reserved → Occupied)
                        </Button>
                    )}

                    {/* Discharge Patient */}
                    {isAdmitted && (
                        <Button
                            type="button"
                            size="sm"
                            disabled={actionLoading === "discharge"}
                            onClick={handleDischargePatient}
                            className="bg-slate-800 hover:bg-slate-900 text-white text-xs h-8 font-semibold shadow-sm"
                        >
                            {actionLoading === "discharge" ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Discharge Patient (Release Occupied → Available)
                        </Button>
                    )}

                    {/* Release Reservation */}
                    {reservation && !isDischarged && reservation.status !== "RELEASED" && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={actionLoading === "release"}
                            onClick={handleReleaseReservation}
                            className="text-xs h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        >
                            {actionLoading === "release" ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                                <Unlock className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Release Reservation
                        </Button>
                    )}
                </div>

                <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                    <span>Real-time MongoDB Source of Truth</span>
                </div>
            </div>
        </Card>
    );
}
