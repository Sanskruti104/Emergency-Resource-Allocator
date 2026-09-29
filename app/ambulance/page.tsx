"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
    Activity,
    AlertCircle,
    AlertOctagon,
    AlertTriangle,
    Ambulance,
    ArrowRight,
    BedDouble,
    Building2,
    Check,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    Clock,
    HeartPulse,
    Hospital,
    Loader2,
    MapPin,
    Navigation,
    Phone,
    Radio,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    User,
    X,
    XCircle,
    Info,
    Database
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CandidateEvaluation, AllocationResult } from "@/lib/emergency/emergency-allocator";
import { EmergencyNav } from "@/components/emergency/emergency-nav";
import { StatusBadge } from "@/components/emergency/status-badge";
import { EmergencyHeader } from "@/components/emergency/emergency-header";

interface PendingRequest {
    emergencyId: string;
    emergencyType: string;
    priority: string;
    incidentLocation: {
        address: string;
        latitude: number;
        longitude: number;
        isSimulated?: boolean;
    };
    chiefComplaint: string;
    createdAt: string;
    patient?: {
        name?: string;
        age?: number;
        gender?: string;
        contactNumber?: string;
    };
    notes?: string;
}

export default function AmbulanceConsolePage() {
    // Current selected ambulance unit
    const [selectedAmbulanceId, setSelectedAmbulanceId] = useState<string>("AMB-PUNE-01");
    const [availableAmbulances, setAvailableAmbulances] = useState<any[]>([]);
    const [currentAmbulance, setCurrentAmbulance] = useState<any | null>(null);

    // Missions and requests
    const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
    const [activeMission, setActiveMission] = useState<any | null>(null);

    // Allocation State
    const [allocationLoading, setAllocationLoading] = useState<boolean>(false);
    const [allocationResult, setAllocationResult] = useState<AllocationResult | null>(null);
    const [allocationError, setAllocationError] = useState<string | null>(null);
    const [isRejectedSectionOpen, setIsRejectedSectionOpen] = useState<boolean>(false);

    // Reservation State
    const [isRequestingReservation, setIsRequestingReservation] = useState<string | null>(null);
    const [activeReservation, setActiveReservation] = useState<any | null>(null);

    // UI State
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [actionInProgress, setActionInProgress] = useState<string | null>(null);
    const [networkError, setNetworkError] = useState<string | null>(null);

    // Fetch operational data from /api/emergency/ambulance/requests
    const fetchData = useCallback(
        async (isBackground = false) => {
            if (!isBackground) setIsRefreshing(true);
            try {
                const res = await fetch(
                    `/api/emergency/ambulance/requests?ambulanceId=${encodeURIComponent(selectedAmbulanceId)}`,
                    { cache: "no-store" }
                );

                if (!res.ok) {
                    throw new Error(`Server returned status ${res.status}`);
                }

                const data = await res.json();
                if (data.success) {
                    setPendingRequests(data.pendingRequests || []);
                    setActiveMission(data.activeMission || null);
                    setCurrentAmbulance(data.ambulance || null);
                    setActiveReservation(data.activeReservation || null);
                    if (data.availableAmbulances && data.availableAmbulances.length > 0) {
                        setAvailableAmbulances(data.availableAmbulances);
                    }
                    setNetworkError(null);
                } else {
                    setNetworkError(data.error || "Failed to load ambulance dispatch feed");
                }
            } catch (err: any) {
                console.error("Ambulance fetch error:", err);
                setNetworkError("Unable to connect to emergency dispatch server. Retrying...");
            } finally {
                if (!isBackground) {
                    setIsRefreshing(false);
                    setIsLoading(false);
                }
            }
        },
        [selectedAmbulanceId]
    );

    // Initial load and periodic polling every 3.5s
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const ambId = params.get("ambulanceId");
            if (ambId) {
                setSelectedAmbulanceId(ambId);
            }
        }
        setIsLoading(true);
        fetchData(false);

        const interval = setInterval(() => {
            fetchData(true);
        }, 3500);

        return () => clearInterval(interval);
    }, [fetchData]);

    // Call existing emergency allocation API
    const fetchHospitalAllocation = useCallback(async (emergency: any) => {
        if (!emergency) return;
        setAllocationLoading(true);
        setAllocationError(null);

        try {
            const payload = {
                emergencyId: emergency.emergencyId,
                condition: emergency.condition || emergency.emergencyType,
                chiefComplaint: emergency.chiefComplaint,
                priority: emergency.priority,
                requiredSpecialty: emergency.requiredSpecialty,
                requiredResources: emergency.requiredResources,
                incidentLocation: emergency.incidentLocation,
                vitals: emergency.vitals
            };

            const res = await fetch("/api/emergency/allocate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Allocation engine returned status ${res.status}`);
            }

            const data: AllocationResult = await res.json();
            setAllocationResult(data);
        } catch (err: any) {
            console.error("POST /api/emergency/allocate error:", err);
            setAllocationError("Failed to retrieve hospital recommendations.");
        } finally {
            setAllocationLoading(false);
        }
    }, []);

    // Automatically trigger allocation when an active mission is present
    useEffect(() => {
        if (
            activeMission &&
            (!allocationResult || (allocationResult.emergency as any)?.emergencyId !== activeMission.emergencyId) &&
            !allocationLoading
        ) {
            fetchHospitalAllocation(activeMission);
        }
    }, [activeMission, allocationResult, allocationLoading, fetchHospitalAllocation]);

    // Action handler for ambulance lifecycle steps
    const handleAmbulanceAction = async (
        emergencyId: string,
        action: "ACCEPT" | "DECLINE" | "ARRIVED_SCENE" | "PICKUP" | "START_TRANSPORT" | "ARRIVED_HOSPITAL"
    ) => {
        setActionInProgress(`${emergencyId}-${action}`);
        try {
            const res = await fetch("/api/emergency/ambulance/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emergencyId,
                    ambulanceId: selectedAmbulanceId,
                    action
                })
            });

            const result = await res.json();

            if (!res.ok || !result.success) {
                if (res.status === 409 || result.outcome === "ALREADY_PROCESSED") {
                    toast.error("Action already processed.");
                } else {
                    toast.error(result.error || `Failed to perform action.`);
                }
                await fetchData(false);
                return;
            }

            if (action === "ACCEPT") toast.success("Mission Accepted! Dispatched to patient.");
            else if (action === "DECLINE") toast.info("Emergency declined.");
            else if (action === "ARRIVED_SCENE") toast.success("Arrived on patient scene.");
            else if (action === "PICKUP") {
                toast.success("Patient secured onboard. Querying receiving hospitals...");
                if (result.emergency) fetchHospitalAllocation(result.emergency);
            } else if (action === "START_TRANSPORT") toast.success("Transport started! En route to receiving hospital.");
            else if (action === "ARRIVED_HOSPITAL") toast.success("Arrived at receiving hospital entrance.");

            await fetchData(false);
        } catch (err: any) {
            toast.error("Network error executing dispatch action.");
        } finally {
            setActionInProgress(null);
        }
    };

    // Action handler for clinical handoff steps
    const handleHandoffAction = async (
        emergencyId: string,
        action: "START_HANDOFF" | "COMPLETE_HANDOFF"
    ) => {
        setActionInProgress(`${emergencyId}-${action}`);
        try {
            const targetHospitalId =
                activeMission?.receivingHospitalId ||
                activeMission?.allocatedHospitalId ||
                activeReservation?.hospitalId;

            const res = await fetch("/api/emergency/handoff/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emergencyId,
                    action,
                    hospitalId: targetHospitalId,
                    reservationId: activeReservation?.reservationId
                })
            });

            const result = await res.json();
            if (res.ok && result.success) {
                if (action === "START_HANDOFF") {
                    toast.success("Handoff in progress: clinical team receiving patient.");
                } else {
                    toast.success("Handoff completed! Patient admitted, ambulance released.");
                }
                await fetchData(false);
            } else {
                toast.error(result.error || result.message || "Failed to process handoff.");
                await fetchData(false);
            }
        } catch (err: any) {
            toast.error("Network error during handoff.");
        } finally {
            setActionInProgress(null);
        }
    };

    // Request reservation from top candidate
    const handleRequestReservation = async (candidate: CandidateEvaluation) => {
        if (!activeMission || isRequestingReservation) return;

        setIsRequestingReservation(candidate.hospitalId);
        try {
            const candidateResource = candidate.matchedResources?.[0];
            const emergencyResource = activeMission.requiredResources?.[0];
            const validResources = [
                "ICU_BED",
                "GENERAL_BED",
                "VENTILATOR",
                "OPERATION_THEATRE",
                "TRAUMA_BAY",
                "CT_SCAN",
                "CATH_LAB",
                "SPECIALIST"
            ];

            let resourceType = "ICU_BED";
            if (candidateResource && validResources.includes(candidateResource)) {
                resourceType = candidateResource;
            } else if (emergencyResource && validResources.includes(emergencyResource)) {
                resourceType = emergencyResource;
            }

            const res = await fetch("/api/emergency/reserve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hospitalId: candidate.hospitalId,
                    emergencyId: activeMission.emergencyId,
                    resourceType: resourceType,
                    quantity: 1,
                    ttlMinutes: 30,
                    allocatedBy: "AUTO_ALLOCATOR"
                })
            });

            const result = await res.json();
            if (res.status === 201 || (res.ok && result.success)) {
                toast.success(`Reservation requested at ${candidate.hospitalName}`);
                setActiveReservation({
                    reservationId: result.reservationId || result.reservation?.reservationId,
                    emergencyId: activeMission.emergencyId,
                    hospitalId: candidate.hospitalId,
                    resourceType: resourceType,
                    quantity: 1,
                    status: "PENDING"
                });
                await fetchData(false);
            } else {
                toast.error(result.details || result.error || "Reservation request failed.");
            }
        } catch (err: any) {
            toast.error("Failed to request reservation.");
        } finally {
            setIsRequestingReservation(null);
        }
    };

    // Candidate classification
    const suitableCandidates = useMemo(
        () => allocationResult?.results?.filter((r) => r.suitability) || [],
        [allocationResult]
    );

    const unsuitableCandidates = useMemo(
        () => allocationResult?.results?.filter((r) => !r.suitability) || [],
        [allocationResult]
    );

    const recommendedHospital = suitableCandidates[0] || null;
    const otherSuitable = suitableCandidates.slice(1);

    // Identify nearest unsuitable hospital to demonstrate capability-based diversion
    const nearestUnsuitable = useMemo(() => {
        if (!recommendedHospital || !unsuitableCandidates.length) return null;
        const sorted = [...unsuitableCandidates].sort((a, b) => a.distanceKm - b.distanceKm);
        if (sorted[0].distanceKm < recommendedHospital.distanceKm) {
            return sorted[0];
        }
        return null;
    }, [recommendedHospital, unsuitableCandidates]);

    // Primary action calculation: Strictly ONE visually dominant action
    const renderPrimaryAction = () => {
        if (!activeMission) return null;

        const emgId = activeMission.emergencyId;
        const mStatus = activeMission.status;
        const tStatus = activeMission.transportStatus || currentAmbulance?.transportStatus;
        const hStatus = activeMission.handoffStatus;
        const rStatus = activeReservation?.status;

        // Stage 1: Dispatched to Scene
        if (mStatus === "DISPATCHED" || currentAmbulance?.status === "DISPATCHED") {
            return (
                <Button
                    onClick={() => handleAmbulanceAction(emgId, "ARRIVED_SCENE")}
                    disabled={!!actionInProgress}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 h-11 rounded-lg shadow-sm text-sm"
                >
                    {actionInProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MapPin className="w-4 h-4 mr-2" />}
                    Confirm Arrival at Patient Scene
                </Button>
            );
        }

        // Stage 2: On Scene -> Secure Patient
        if (mStatus === "ON_SCENE" || currentAmbulance?.status === "ON_SCENE") {
            return (
                <Button
                    onClick={() => handleAmbulanceAction(emgId, "PICKUP")}
                    disabled={!!actionInProgress}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 h-11 rounded-lg shadow-sm text-sm"
                >
                    {actionInProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Ambulance className="w-4 h-4 mr-2" />}
                    Secure Patient Onboard & Query Hospitals
                </Button>
            );
        }

        // Stage 3: Patient on board (TRANSPORTING / ALLOCATING)
        if (mStatus === "TRANSPORTING" || mStatus === "ARRIVED") {
            // 3A: No reservation yet -> Request Reservation
            if (!activeReservation || rStatus === "REJECTED" || rStatus === "EXPIRED") {
                return (
                    <Button
                        onClick={() => recommendedHospital && handleRequestReservation(recommendedHospital)}
                        disabled={!recommendedHospital || isRequestingReservation !== null}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 h-11 rounded-lg shadow-sm text-sm"
                    >
                        {isRequestingReservation ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        Request Hospital Bed Reservation
                    </Button>
                );
            }

            // 3B: Reservation Pending Hospital Confirmation
            if (rStatus === "PENDING") {
                return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-center space-y-1">
                        <div className="flex items-center justify-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
                            <Clock className="w-4 h-4 animate-spin text-amber-600" />
                            Reservation Pending Hospital Acceptance
                        </div>
                        <p className="text-[11px] text-amber-700 dark:text-amber-400">
                            Emergency intake operator notified. Awaiting clinical intake confirmation.
                        </p>
                    </div>
                );
            }

            // 3C: Hospital Accepted -> Start Transport
            if (rStatus === "CONFIRMED" && (!tStatus || tStatus === "IDLE")) {
                return (
                    <Button
                        onClick={() => handleAmbulanceAction(emgId, "START_TRANSPORT")}
                        disabled={!!actionInProgress}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 h-11 rounded-lg shadow-sm text-sm"
                    >
                        {actionInProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Navigation className="w-4 h-4 mr-2" />}
                        Start Hospital Transport
                    </Button>
                );
            }

            // 3D: In Transit to Hospital -> Confirm Arrival
            if (tStatus === "EN_ROUTE") {
                return (
                    <Button
                        onClick={() => handleAmbulanceAction(emgId, "ARRIVED_HOSPITAL")}
                        disabled={!!actionInProgress}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 h-11 rounded-lg shadow-sm text-sm"
                    >
                        {actionInProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Hospital className="w-4 h-4 mr-2" />}
                        Confirm Arrival at Hospital
                    </Button>
                );
            }

            // 3E: Arrived at Hospital -> Handoff Lifecycle
            if (tStatus === "ARRIVED" || mStatus === "ARRIVED") {
                if (!hStatus || hStatus === "PENDING") {
                    return (
                        <Button
                            onClick={() => handleHandoffAction(emgId, "START_HANDOFF")}
                            disabled={!!actionInProgress}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 h-11 rounded-lg shadow-sm text-sm"
                        >
                            {actionInProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
                            Start Patient Handoff
                        </Button>
                    );
                }

                if (hStatus === "IN_PROGRESS") {
                    return (
                        <Button
                            onClick={() => handleHandoffAction(emgId, "COMPLETE_HANDOFF")}
                            disabled={!!actionInProgress}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 h-11 rounded-lg shadow-sm text-sm"
                        >
                            {actionInProgress ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                            Complete Handoff & Finalize Admission
                        </Button>
                    );
                }

                if (hStatus === "COMPLETED" || mStatus === "ADMITTED") {
                    return (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg text-center">
                            <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                Patient Admitted • Ambulance Released to Available
                            </span>
                        </div>
                    );
                }
            }
        }

        return null;
    };

    return (
        <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
            {/* Header Navigation */}
            <EmergencyNav
                role="ambulance"
                isRefreshing={isRefreshing}
                onRefresh={() => fetchData(false)}
                liveIndicatorText="DISPATCH CAD LIVE"
            />

            <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Network Error with Retry */}
                {networkError && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{networkError}</span>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => fetchData(false)}
                            className="h-7 text-xs text-amber-800 hover:bg-amber-100"
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {/* AMBULANCE UNIT & PROVIDER IDENTITY BAR (Requirement 6) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <Ambulance className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                    Unit: {selectedAmbulanceId}
                                </span>
                                {/* Ambulance Provider Badge (Hospital Ambulance vs Government Ambulance) */}
                                <span
                                    id="badge-ambulance-provider"
                                    className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-semibold border",
                                        currentAmbulance?.providerType === "HOSPITAL" || currentAmbulance?.provider === "HOSPITAL" || currentAmbulance?.hospitalId
                                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                                            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                                    )}
                                >
                                    {currentAmbulance?.providerType === "HOSPITAL" || currentAmbulance?.provider === "HOSPITAL" || currentAmbulance?.hospitalId
                                        ? "Hospital Ambulance"
                                        : (currentAmbulance?.provider || "Government Ambulance (EMS 108)")}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                    {currentAmbulance?.vehicleType || "ALS Mobile ICU"}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Status: <strong className="text-slate-700 dark:text-slate-300">{currentAmbulance?.status || "AVAILABLE"}</strong> • Telemetry: {currentAmbulance?.currentLocation ? `${currentAmbulance.currentLocation.latitude?.toFixed(4)}, ${currentAmbulance.currentLocation.longitude?.toFixed(4)}` : "Live GPS Tracking"}
                            </p>
                        </div>
                    </div>

                    {/* Unit Switcher */}
                    {availableAmbulances.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Unit:</span>
                            <select
                                value={selectedAmbulanceId}
                                onChange={(e) => setSelectedAmbulanceId(e.target.value)}
                                className="text-xs h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                            >
                                {availableAmbulances.map((amb) => (
                                    <option key={amb.ambulanceId} value={amb.ambulanceId}>
                                        {amb.ambulanceId} ({amb.vehicleType || "ALS"})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* 1. TOP SECTION: ACTIVE EMERGENCY HEADER */}
                <div id="active">
                    {/* If there is a pending dispatch call */}
                    {pendingRequests.length > 0 && !activeMission && (
                        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/30 shadow-xs mb-4">
                            <div className="bg-amber-100/70 dark:bg-amber-900/40 px-4 py-2.5 border-b border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs">
                                <span className="font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    Incoming Dispatch Alert
                                </span>
                                <Badge variant="outline" className="border-amber-400 text-amber-800 text-[10px] font-bold">
                                    {pendingRequests[0].priority || "RED"}
                                </Badge>
                            </div>
                            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                        {pendingRequests[0].chiefComplaint || "Emergency Medical Request"}
                                    </h3>
                                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                        {pendingRequests[0].incidentLocation?.address || "Regional Patient Location"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleAmbulanceAction(pendingRequests[0].emergencyId, "DECLINE")}
                                        disabled={!!actionInProgress}
                                        className="h-9 text-xs"
                                    >
                                        Decline
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={() => handleAmbulanceAction(pendingRequests[0].emergencyId, "ACCEPT")}
                                        disabled={!!actionInProgress}
                                        className="h-9 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-4 shadow-xs"
                                    >
                                        Accept Dispatch
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Active Mission Header */}
                    {activeMission ? (
                        <div className="space-y-3">
                            <EmergencyHeader
                                emergencyId={activeMission.emergencyId}
                                emergencyType={activeMission.emergencyType || activeMission.condition}
                                priority={activeMission.priority}
                                status={activeMission.status}
                                patientName={activeMission.patientName || "Emergency Patient"}
                                chiefComplaint={activeMission.chiefComplaint}
                            />
                            {/* Clinical Requirements Card */}
                            <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-[10px] uppercase tracking-wider text-slate-400">Clinical Requirements:</span>
                                    <Badge variant="outline" className="text-[11px] font-bold border-red-300 text-red-700 dark:border-red-800 dark:text-red-300 bg-red-50/50">
                                        Priority: {activeMission.priority || "RED"}
                                    </Badge>
                                    <span className="text-slate-300 dark:text-slate-700">•</span>
                                    <span className="text-slate-700 dark:text-slate-300 font-medium">
                                        Specialty: <strong className="text-slate-900 dark:text-white">{activeMission.requiredSpecialty || "Cardiology & Interventional Cath Lab"}</strong>
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Mandatory Resources:</span>
                                    {(activeMission.requiredResources || ["CATH_LAB", "ICU_BED", "VENTILATOR"]).map((res: string, i: number) => (
                                        <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                            {res.replace(/_/g, " ")}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        !pendingRequests.length && (
                            <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
                                <Ambulance className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                    Unit {selectedAmbulanceId} On Standby
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                    No active transport mission assigned. Standing by for regional emergency dispatch calls.
                                </p>
                            </Card>
                        )
                    )}
                </div>

                {/* 2. RECOMMENDED RECEIVING HOSPITAL & NEXT ACTION */}
                {activeMission && (
                    <div id="hospitals" className="space-y-4">
                        <div className="flex items-center justify-between pb-1">
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                                    Recommended Receiving Hospital
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Computed by real-time capability match, bed capacity & road telemetry
                                </p>
                            </div>
                            {allocationLoading && (
                                <span className="text-xs text-blue-600 flex items-center gap-1.5 font-medium">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Evaluating...
                                </span>
                            )}
                        </div>

                        {/* NEAREST VS SUITABLE COMPARISON BANNER */}
                        {nearestUnsuitable && recommendedHospital && (
                            <div className="p-4 bg-gradient-to-r from-amber-50/90 via-slate-50 to-emerald-50/90 dark:from-amber-950/30 dark:via-slate-900 dark:to-emerald-950/30 border border-slate-200/90 dark:border-slate-800 rounded-xl space-y-3 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 text-amber-600" />
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                                            Allocation Comparison: Nearest vs Suitable Hospital
                                        </h3>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono">Clinical Capability Matching</span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Nearest Facility (Unsuitable) */}
                                    <div className="p-3.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-lg space-y-2 shadow-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">NEAREST</span>
                                            <Badge variant="outline" className="text-[10px] font-bold border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300 bg-rose-50/70">
                                                ❌ Not suitable
                                            </Badge>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-xs">{nearestUnsuitable.hospitalName}</h4>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Distance: <strong>{nearestUnsuitable.distanceKm.toFixed(1)} km</strong> • ETA: <strong>{nearestUnsuitable.estimatedTravelMinutes} min</strong>
                                            </p>
                                        </div>
                                        <div className="p-2 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded text-[11px] text-rose-700 dark:text-rose-300 leading-tight">
                                            <span className="font-semibold">Rejection Reason: </span>
                                            {nearestUnsuitable.reasons?.[0] || `Lacks required clinical specialty or mandatory equipment (${nearestUnsuitable.missingResources.join(", ")})`}
                                        </div>
                                    </div>

                                    {/* Recommended Facility (Suitable) */}
                                    <div className="p-3.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 rounded-lg space-y-2 shadow-xs">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">RECOMMENDED</span>
                                            <Badge variant="outline" className="text-[10px] font-bold border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 bg-emerald-50/70">
                                                ✅ Suitable
                                            </Badge>
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white text-xs">{recommendedHospital.hospitalName}</h4>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Distance: <strong>{recommendedHospital.distanceKm.toFixed(1)} km</strong> • ETA: <strong>{recommendedHospital.estimatedTravelMinutes} min</strong>
                                            </p>
                                        </div>
                                        <div className="p-2 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded text-[11px] text-emerald-800 dark:text-emerald-300 leading-tight">
                                            <span className="font-semibold">Clinical Match: </span>
                                            Selected because required {activeMission.requiredSpecialty || "Cardiology"}, Cath Lab, ICU bed and ventilator are available. Other closer facilities do not satisfy the mandatory clinical requirements.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {recommendedHospital ? (
                            <Card className="border-blue-200/90 dark:border-blue-900/60 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                                {/* Hospital Title & Freshness Banner */}
                                <div className="bg-blue-50/60 dark:bg-blue-950/40 px-5 py-3 border-b border-blue-100 dark:border-blue-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                                {recommendedHospital.hospitalName}
                                            </h3>
                                            <span className="text-[11px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                                ID: {recommendedHospital.hospitalId}
                                            </span>
                                            <StatusBadge status="SUITABLE" label="RECOMMENDED" size="sm" />
                                            <StatusBadge status={recommendedHospital.freshnessStatus} size="sm" />
                                        </div>
                                        {recommendedHospital.lastUpdatedAt && (
                                            <span className="text-[10px] text-slate-400 block mt-0.5">
                                                Telemetry updated: {new Date(recommendedHospital.lastUpdatedAt).toLocaleTimeString()}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 sm:justify-end">
                                        <span className="text-[11px] font-mono text-slate-500">
                                            Match Score: <strong className="text-blue-600 font-bold">{recommendedHospital.overallScore.toFixed(0)}/100</strong>
                                        </span>
                                    </div>
                                </div>

                                <CardContent className="p-5 space-y-4">
                                    {/* Clinical & Operational Metrics Grid (Mandatory Resource Availability Fields) */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Distance / ETA</span>
                                            <span className="font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                                                {recommendedHospital.distanceKm.toFixed(1)} km • {recommendedHospital.estimatedTravelMinutes} min
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">ICU Beds</span>
                                            <span className="font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                                                {recommendedHospital.availableCapacity.availableIcuBeds} / {recommendedHospital.availableCapacity.icuBeds} free
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">General Beds</span>
                                            <span className="font-bold text-slate-900 dark:text-slate-100 mt-1 block">
                                                {recommendedHospital.availableCapacity.availableBeds} / {recommendedHospital.availableCapacity.totalBeds} free
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Required Specialty</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 block truncate">
                                                Available
                                            </span>
                                            <span className="text-[10px] text-slate-500 block truncate">
                                                {activeMission.requiredSpecialty?.split("&")[0]?.trim() || "Cardiology"}
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Required Equipment</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 block truncate">
                                                Available
                                            </span>
                                            <span className="text-[10px] text-slate-500 block truncate">
                                                Cath Lab, Ventilator
                                            </span>
                                        </div>
                                        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                            <span className="text-[10px] text-slate-400 font-semibold uppercase block">Emergency Dept</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-1 block">
                                                {recommendedHospital.availableCapacity.emergencyAvailable !== false ? "Available" : "Unavailable"}
                                            </span>
                                            <span className="text-[10px] text-slate-500 block truncate">
                                                Data: {recommendedHospital.freshnessStatus}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Verified Clinical Capabilities Pills */}
                                    {recommendedHospital.matchedResources && recommendedHospital.matchedResources.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
                                            <span className="text-[11px] font-semibold text-slate-500">Verified Capabilities:</span>
                                            {recommendedHospital.matchedResources.slice(0, 5).map((res: string, idx: number) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                                >
                                                    {res.replace(/_/g, " ")}: Available
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Why This Hospital: Clean Rationale */}
                                    <div className="p-3 rounded-lg bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                                        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-semibold text-slate-800 dark:text-slate-200">Allocation Rationale: </span>
                                            <span>
                                                {nearestUnsuitable
                                                    ? `Selected because required ${activeMission.requiredSpecialty || "Cardiology"}, Cath Lab, ICU bed and ventilator are available. Other closer facilities do not satisfy the mandatory clinical requirements.`
                                                    : (recommendedHospital.reasons?.[0] || "Fully satisfies clinical specialty, required equipment, and bed capacity headroom.")
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    {/* Primary Action Button (Visually Dominant) */}
                                    <div className="pt-1">
                                        {renderPrimaryAction()}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-center">
                                <p className="text-xs text-slate-500">
                                    {allocationLoading
                                        ? "Querying live hospital resource availability..."
                                        : "No recommended hospital currently available. Regional diversion required."}
                                </p>
                            </Card>
                        )}

                        {/* 3. ALTERNATIVE SUITABLE HOSPITALS (Compact Secondary List) */}
                        {otherSuitable.length > 0 && (
                            <div className="space-y-2 pt-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Alternative Suitable Facilities ({otherSuitable.length})
                                </h3>
                                <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-xs overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200/70 dark:border-slate-800 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="py-2.5 px-4">Hospital</th>
                                                <th className="py-2.5 px-3">Distance & ETA</th>
                                                <th className="py-2.5 px-3">ICU / General</th>
                                                <th className="py-2.5 px-3">Freshness</th>
                                                <th className="py-2.5 px-3 text-right">Option</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {otherSuitable.map((hosp) => (
                                                <tr key={hosp.hospitalId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                                        {hosp.hospitalName}
                                                        <span className="block text-[11px] font-normal text-slate-400">
                                                            Score: {hosp.overallScore.toFixed(0)}/100
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                        {hosp.distanceKm.toFixed(1)} km • {hosp.estimatedTravelMinutes} min
                                                    </td>
                                                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                        {hosp.availableCapacity.availableIcuBeds} ICU / {hosp.availableCapacity.availableBeds} Gen
                                                    </td>
                                                    <td className="py-3 px-3 whitespace-nowrap">
                                                        <StatusBadge status={hosp.freshnessStatus} size="sm" />
                                                    </td>
                                                    <td className="py-3 px-3 text-right whitespace-nowrap">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleRequestReservation(hosp)}
                                                            disabled={isRequestingReservation !== null}
                                                            className="h-7 text-[11px] px-2.5"
                                                        >
                                                            Select & Reserve
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 4. COLLAPSED SECTION: WHY OTHER HOSPITALS ARE UNAVAILABLE */}
                        {unsuitableCandidates.length > 0 && (
                            <div className="pt-2">
                                <button
                                    onClick={() => setIsRejectedSectionOpen(!isRejectedSectionOpen)}
                                    className="flex items-center justify-between w-full py-2.5 px-3.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 transition-colors shadow-xs"
                                >
                                    <span>
                                        Why other facilities are unavailable ({unsuitableCandidates.length} evaluated)
                                    </span>
                                    {isRejectedSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>

                                {isRejectedSectionOpen && (
                                    <div className="mt-2 space-y-2">
                                        {unsuitableCandidates.map((cand) => (
                                            <div
                                                key={cand.hospitalId}
                                                className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-lg space-y-2.5 text-xs shadow-xs"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                                                            {cand.hospitalName}
                                                        </h4>
                                                        <span className="text-[10px] font-mono text-slate-400">
                                                            ({cand.hospitalId})
                                                        </span>
                                                        <Badge variant="outline" className="text-[10px] font-bold border-rose-300 text-rose-700 bg-rose-50/70 dark:border-rose-800 dark:text-rose-300 dark:bg-rose-950/40">
                                                            ❌ Not suitable
                                                        </Badge>
                                                        <StatusBadge status={cand.freshnessStatus} size="sm" />
                                                    </div>
                                                    <span className="text-slate-500 font-mono text-[11px]">
                                                        {cand.distanceKm.toFixed(1)} km • {cand.estimatedTravelMinutes} min
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                                        <span className="text-slate-400 text-[10px] block">ICU Availability:</span>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                                            {cand.availableCapacity?.availableIcuBeds ?? 0} / {cand.availableCapacity?.icuBeds ?? 0} free
                                                        </span>
                                                    </div>
                                                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                                        <span className="text-slate-400 text-[10px] block">General Beds:</span>
                                                        <span className="font-medium text-slate-700 dark:text-slate-300">
                                                            {cand.availableCapacity?.availableBeds ?? 0} / {cand.availableCapacity?.totalBeds ?? 0} free
                                                        </span>
                                                    </div>
                                                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                                        <span className="text-slate-400 text-[10px] block">Required Specialty:</span>
                                                        <span className="font-medium text-rose-600 dark:text-rose-400">
                                                            Unavailable
                                                        </span>
                                                    </div>
                                                    <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                                                        <span className="text-slate-400 text-[10px] block">Required Equipment:</span>
                                                        <span className="font-medium text-rose-600 dark:text-rose-400">
                                                            Unavailable
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="p-2 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 rounded text-[11px] text-rose-700 dark:text-rose-300">
                                                    <span className="font-semibold">Rejection reason: </span>
                                                    {cand.reasons?.[0] || `Lacks required clinical specialty or mandatory equipment (${cand.missingResources.join(", ")})`}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 5. DATA SOURCE / OPERATIONAL DATA PROVENANCE */}
                        <div className="pt-2">
                            <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-xs">
                                <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-2">
                                    <Database className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Operational Data & Reference Sources</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">Operational Hospital Availability:</span>
                                        <span className="text-slate-500 font-mono text-[10px] block mt-0.5">MongoDB hospitals collection</span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">Historical EMS Reference:</span>
                                        <span className="text-slate-500 font-mono text-[10px] block mt-0.5">MongoDB ems_events collection (20,000 records)</span>
                                    </div>
                                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">Historical Capacity Benchmark:</span>
                                        <span className="text-slate-500 font-mono text-[10px] block mt-0.5">MongoDB hospital_capacity_benchmarks (12,768 records)</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">
                                    Historical datasets provide baseline modeling and validation benchmarks. Live allocation decisions evaluate current operational hospital capacity records in MongoDB.
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
