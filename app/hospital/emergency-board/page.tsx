"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import {
    Activity,
    AlertTriangle,
    Ambulance,
    BedDouble,
    Building2,
    CheckCircle2,
    Clock,
    Hospital,
    Loader2,
    MapPin,
    Navigation,
    Radio,
    ShieldAlert,
    ShieldCheck,
    UserCheck,
    XCircle,
    Check,
    X,
    Info,
    Phone
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmergencyNav } from "@/components/emergency/emergency-nav";
import { StatusBadge } from "@/components/emergency/status-badge";

export default function HospitalEmergencyBoardPage() {
    // Live MongoDB state
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [selectedHospitalId, setSelectedHospitalId] = useState<string>("");
    const [emergencies, setEmergencies] = useState<any[]>([]);
    const [ambulances, setAmbulances] = useState<any[]>([]);
    const [reservations, setReservations] = useState<any[]>([]);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [networkError, setNetworkError] = useState<string | null>(null);
    const [activeHospitalTab, setActiveHospitalTab] = useState<"emergency_board" | "facility_overview">("emergency_board");

    // Switch active hospital handler
    const handleSelectHospital = (hId: string) => {
        setSelectedHospitalId(hId);
        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("hospitalId", hId);
            window.history.replaceState({}, "", url.toString());
        }
    };

    // Fetch active data from /api/emergency/active
    const fetchActiveState = useCallback(
        async (isBackground = false) => {
            if (!isBackground) setIsRefreshing(true);
            try {
                const url = selectedHospitalId
                    ? `/api/emergency/active?hospitalId=${encodeURIComponent(selectedHospitalId)}`
                    : "/api/emergency/active";
                const res = await fetch(url, { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const json = await res.json();
                const data = json.data || json;
                if (json.success && (json.data || json.hospitals)) {
                    const loadedHospitals = data.hospitals || [];
                    setHospitals(loadedHospitals);

                    // If no selected hospital yet, initialize from URL or first hospital
                    if (!selectedHospitalId && loadedHospitals.length > 0) {
                        let initId = "";
                        if (typeof window !== "undefined") {
                            const params = new URLSearchParams(window.location.search);
                            initId = params.get("hospitalId") || "";
                        }
                        if (!initId || !loadedHospitals.some((h: any) => (h.uid && h.uid === initId) || (h.hospitalId && h.hospitalId === initId))) {
                            initId = loadedHospitals[0].uid || loadedHospitals[0].hospitalId;
                        }
                        setSelectedHospitalId(initId);
                    }

                    setEmergencies(data.emergencies || []);
                    setAmbulances(data.ambulances || []);
                    setReservations(data.reservations || []);
                    setNetworkError(null);
                }
            } catch (err: any) {
                console.error("Failed to fetch emergency board:", err);
                setNetworkError("Unable to connect to hospital operations server. Retrying...");
            } finally {
                if (!isBackground) {
                    setIsRefreshing(false);
                    setIsLoading(false);
                }
            }
        },
        [selectedHospitalId]
    );

    // Initial check for URL query param
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const hid = params.get("hospitalId");
            if (hid) {
                setSelectedHospitalId(hid);
            }
        }
    }, []);

    // Polling every 3.5s
    useEffect(() => {
        fetchActiveState();
        const interval = setInterval(() => {
            fetchActiveState(true);
        }, 3500);
        return () => clearInterval(interval);
    }, [fetchActiveState]);

    // Current selected hospital
    const selectedHospital = hospitals.find(
        (h) => (h.uid && h.uid === selectedHospitalId) || (h.hospitalId && h.hospitalId === selectedHospitalId)
    ) || (hospitals.length > 0 ? hospitals[0] : null);

    // Filter incoming emergencies / reservations assigned to this hospital
    const hospitalMatchIds = new Set<string>();
    if (selectedHospitalId) hospitalMatchIds.add(selectedHospitalId);
    if (selectedHospital?.uid) hospitalMatchIds.add(selectedHospital.uid);
    if (selectedHospital?.hospitalId) hospitalMatchIds.add(selectedHospital.hospitalId);

    const hospitalReservations = reservations.filter((r) => hospitalMatchIds.has(r.hospitalId));
    const activeResIds = new Set(hospitalReservations.map((r) => r.reservationId));

    const incomingEmergencies = emergencies.filter(
        (e) =>
            hospitalMatchIds.has(e.allocatedHospitalId) ||
            hospitalMatchIds.has(e.receivingHospitalId) ||
            (e.reservationId && activeResIds.has(e.reservationId)) ||
            hospitalReservations.some((r) => r.emergencyId === e.emergencyId)
    );

    // Reservation confirmation / rejection
    const handleReservationAction = async (
        reservationId: string,
        action: "confirm" | "reject"
    ) => {
        setActionLoading(`${reservationId}-${action}`);
        try {
            const res = await fetch(`/api/emergency/reservations/${reservationId}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(
                    action === "confirm"
                        ? "Bed reservation confirmed! Paramedics and receiving unit notified."
                        : "Reservation request rejected."
                );
                await fetchActiveState();
            } else {
                toast.error(data.message || data.error || "Action failed.");
            }
        } catch (err: any) {
            toast.error("Failed to execute reservation action.");
        } finally {
            setActionLoading(null);
        }
    };

    // Handoff start / complete
    const handleHandoffAction = async (
        emergencyId: string,
        action: "START_HANDOFF" | "COMPLETE_HANDOFF",
        reservationId?: string
    ) => {
        setActionLoading(`${emergencyId}-${action}`);
        try {
            const res = await fetch("/api/emergency/handoff/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    emergencyId,
                    action,
                    hospitalId: selectedHospitalId || selectedHospital?.uid || selectedHospital?.hospitalId,
                    reservationId
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(
                    action === "START_HANDOFF"
                        ? "Handoff Started: Paramedics transferring patient to clinical team."
                        : "Handoff Complete: Patient formally admitted into unit."
                );
                await fetchActiveState();
            } else {
                toast.error(data.error || data.message || "Failed to process handoff.");
            }
        } catch (err: any) {
            toast.error("Failed to execute handoff action.");
        } finally {
            setActionLoading(null);
        }
    };

    // Capacity metrics
    const op = selectedHospital?.operationalCapacity || {};
    const icuTotal = op.icuBeds ?? selectedHospital?.icuBeds ?? 0;
    const icuReserved = op.reservedIcuBeds ?? 0;
    const icuOccupied = op.occupiedIcuBeds ?? (icuTotal > 0 ? Math.max(0, icuTotal - (op.availableIcuBeds ?? 0) - icuReserved) : 0);
    const icuAvailable = op.availableIcuBeds ?? selectedHospital?.availableIcuBeds ?? Math.max(0, icuTotal - icuOccupied - icuReserved);

    const bedTotal = op.totalBeds ?? selectedHospital?.totalBeds ?? 0;
    const bedReserved = op.reservedBeds ?? 0;
    const bedOccupied = op.occupiedBeds ?? (bedTotal > 0 ? Math.max(0, bedTotal - (op.availableBeds ?? 0) - bedReserved) : 0);
    const bedAvailable = op.availableBeds ?? selectedHospital?.availableBeds ?? Math.max(0, bedTotal - bedOccupied - bedReserved);

    const otTotal = op.operationTheatres ?? selectedHospital?.operationTheatres ?? 4;
    const otAvailable = op.availableOperationTheatres ?? Math.max(1, otTotal - 1);

    return (
        <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
            {/* Header Navigation */}
            <EmergencyNav
                role="hospital"
                isRefreshing={isRefreshing}
                onRefresh={() => fetchActiveState(false)}
                liveIndicatorText="ED OPERATIONS LIVE"
            />

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
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
                            onClick={() => fetchActiveState(false)}
                            className="h-7 text-xs text-amber-800 hover:bg-amber-100"
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {/* 1. MULTI-HOSPITAL SELECTOR (Phase 8C) */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                                Hospital Selection (Demo Operator / Live Coordination)
                            </h2>
                            <Badge variant="outline" className="text-[10px] font-semibold border-blue-200 text-blue-700 bg-blue-50 dark:bg-blue-950/40">
                                {hospitals.length} Operational Facilities
                            </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500">
                            Click any facility below to make it the active hospital console.
                        </p>
                    </div>

                    {/* Horizontal grid of hospital cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                        {hospitals.map((h) => {
                            const hid = h.uid || h.hospitalId;
                            const isSelected = (selectedHospital?.uid || selectedHospital?.hospitalId) === hid;
                            const hBeds = h.operationalCapacity?.availableBeds ?? h.availableBeds ?? 0;
                            const hIcu = h.operationalCapacity?.availableIcuBeds ?? h.availableIcuBeds ?? 0;

                            return (
                                <button
                                    key={hid}
                                    type="button"
                                    onClick={() => handleSelectHospital(hid)}
                                    className={cn(
                                        "text-left p-3 rounded-xl border transition-all flex flex-col justify-between gap-2 cursor-pointer",
                                        isSelected
                                            ? "border-blue-600 dark:border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 shadow-xs ring-2 ring-blue-600/30"
                                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800"
                                    )}
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                                                {hid}
                                            </span>
                                            {isSelected ? (
                                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-600 text-white">
                                                    ACTIVE
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                                    ONLINE
                                                </span>
                                            )}
                                        </div>
                                        <h3 className={cn(
                                            "text-xs font-bold leading-snug line-clamp-2",
                                            isSelected ? "text-blue-900 dark:text-blue-200" : "text-slate-800 dark:text-slate-200"
                                        )}>
                                            {h.hospitalName}
                                        </h3>
                                    </div>

                                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/50 dark:border-slate-800">
                                        <span>ICU: <strong className="font-mono text-slate-700 dark:text-slate-300">{hIcu}</strong></span>
                                        <span>Beds: <strong className="font-mono text-slate-700 dark:text-slate-300">{hBeds}</strong></span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. ACTIVE HOSPITAL BANNER (Phase 8C) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                ACTIVE HOSPITAL
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                                ED ACTIVE (24/7)
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {selectedHospital?.hospitalName || "Emergency Operations Board"}
                        </h1>
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-mono flex-wrap">
                            <span>Hospital ID: <strong className="text-slate-700 dark:text-slate-300">{selectedHospital?.uid || selectedHospital?.hospitalId || "N/A"}</strong></span>
                            {selectedHospital?.address && (
                                <span className="hidden sm:inline font-sans text-slate-400">• {selectedHospital.address}</span>
                            )}
                        </div>
                    </div>

                    {/* Quick Dropdown Alternative */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400 font-medium hidden sm:inline">Switch:</span>
                        <Select
                            value={selectedHospitalId}
                            onValueChange={(val) => handleSelectHospital(val)}
                        >
                            <SelectTrigger className="w-[220px] sm:w-[260px] h-9 text-xs bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-xs">
                                <SelectValue placeholder="Select Facility" />
                            </SelectTrigger>
                            <SelectContent>
                                {hospitals.map((h) => (
                                    <SelectItem
                                        key={h.uid || h.hospitalId}
                                        value={h.uid || h.hospitalId}
                                        className="text-xs"
                                    >
                                        {h.hospitalName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* 2. TOP CAPACITY SUMMARY: Clear, Human-Readable Metric Blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* General Beds Block */}
                    <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    General Beds
                                </span>
                                <BedDouble className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                                    {bedAvailable} <span className="text-xs font-normal text-slate-500">available</span>
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                    / {bedTotal} total
                                </span>
                            </div>
                            <Progress
                                value={bedTotal > 0 ? (bedOccupied / bedTotal) * 100 : 0}
                                className="h-1.5 bg-slate-100 dark:bg-slate-800"
                            />
                            <p className="text-[11px] text-slate-400">
                                {bedOccupied} occupied • {bedReserved} reserved
                            </p>
                        </CardContent>
                    </Card>

                    {/* ICU Beds Block */}
                    <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    ICU Beds (Critical Care)
                                </span>
                                <Activity className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                                    {icuAvailable} <span className="text-xs font-normal text-slate-500">available</span>
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                    / {icuTotal} total
                                </span>
                            </div>
                            <Progress
                                value={icuTotal > 0 ? ((icuOccupied + icuReserved) / icuTotal) * 100 : 0}
                                className="h-1.5 bg-slate-100 dark:bg-slate-800"
                            />
                            <p className="text-[11px] text-slate-400">
                                {icuOccupied} occupied • {icuReserved} reserved
                            </p>
                        </CardContent>
                    </Card>

                    {/* Operating Theatres Block */}
                    <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                        <CardContent className="p-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Operating Theatres
                                </span>
                                <Hospital className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex items-baseline justify-between">
                                <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
                                    {otAvailable} <span className="text-xs font-normal text-slate-500">available</span>
                                </span>
                                <span className="text-xs text-slate-500 font-mono">
                                    / {otTotal} total
                                </span>
                            </div>
                            <Progress
                                value={otTotal > 0 ? ((otTotal - otAvailable) / otTotal) * 100 : 0}
                                className="h-1.5 bg-slate-100 dark:bg-slate-800"
                            />
                            <p className="text-[11px] text-slate-400">
                                Sterile & staffed for emergency surgery
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* HOSPITAL SECTION SELECTOR (Requirement 7: Emergency Board as a section of Hospital Dashboard) */}
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs w-fit">
                    <button
                        type="button"
                        id="tab-hospital-board"
                        onClick={() => setActiveHospitalTab("emergency_board")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                            activeHospitalTab === "emergency_board"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Emergency Operations Board</span>
                        {incomingEmergencies.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white text-blue-700 font-bold ml-1">
                                {incomingEmergencies.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        id="tab-hospital-overview"
                        onClick={() => setActiveHospitalTab("facility_overview")}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                            activeHospitalTab === "facility_overview"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        )}
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Hospital Overview & Clinical Inventory</span>
                    </button>
                </div>

                {/* SECTION A: EMERGENCY OPERATIONS BOARD */}
                {activeHospitalTab === "emergency_board" && (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-200/80 dark:border-slate-800">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400">
                                    ACTIVE HOSPITAL:
                                </span>
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                    {selectedHospital?.hospitalName}
                                </span>
                            </div>
                            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                                Incoming Emergency Requests ({incomingEmergencies.length})
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500">
                            Filtered exclusively for {selectedHospital?.hospitalName || "Active Facility"} ({selectedHospital?.uid || selectedHospital?.hospitalId || "N/A"})
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="space-y-3 animate-pulse">
                            <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                            <div className="h-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                        </div>
                    ) : incomingEmergencies.length === 0 ? (
                        <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-xs">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                No Pending Emergency Arrivals
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                                All allocated reservations for {selectedHospital?.hospitalName || "this facility"} are currently processed or on standby.
                            </p>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {incomingEmergencies.map((emg) => {
                                const resv = hospitalReservations.find(
                                    (r) => r.emergencyId === emg.emergencyId
                                ) || reservations.find((r) => r.reservationId === emg.reservationId);

                                const amb = ambulances.find(
                                    (a) =>
                                        a.ambulanceId === emg.ambulanceId ||
                                        a.assignedEmergencyId === emg.emergencyId
                                );

                                const isPendingReservation = resv?.status === "PENDING";
                                const isConfirmedReservation = resv?.status === "CONFIRMED";
                                const isAdmitted = emg.status === "ADMITTED" || resv?.status === "ADMITTED";

                                const transportStatus = emg.transportStatus || amb?.transportStatus;
                                const isArrived = transportStatus === "ARRIVED" || emg.status === "ARRIVED" || amb?.status === "AT_HOSPITAL";
                                const handoffStatus = emg.handoffStatus;

                                const ambProvider = amb?.providerType === "GOVERNMENT"
                                    ? "Government Ambulance"
                                    : (amb?.providerName || (amb?.providerType === "HOSPITAL" ? "Hospital Ambulance" : "Government Ambulance"));

                                return (
                                    <Card
                                        key={emg.emergencyId}
                                        className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden"
                                    >
                                        <CardContent className="p-4 sm:p-5">
                                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                                {/* Left details */}
                                                <div className="space-y-2 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge
                                                            variant="outline"
                                                            className={cn(
                                                                "text-[10px] font-bold uppercase",
                                                                emg.priority === "RED"
                                                                    ? "border-rose-300 text-rose-700 bg-rose-50 dark:bg-rose-950/40"
                                                                    : "border-amber-300 text-amber-700 bg-amber-50"
                                                            )}
                                                        >
                                                            {emg.priority || "RED"}
                                                        </Badge>

                                                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                            {emg.emergencyType || emg.condition || "Emergency Presentation"}
                                                        </span>

                                                        <span className="text-xs text-slate-400 font-mono">
                                                            #{emg.emergencyId.slice(-6).toUpperCase()}
                                                        </span>

                                                        <StatusBadge
                                                            status={
                                                                isAdmitted
                                                                    ? "ADMITTED"
                                                                    : handoffStatus === "IN_PROGRESS"
                                                                    ? "HANDOFF"
                                                                    : isArrived
                                                                    ? "ARRIVED"
                                                                    : resv?.status || "PENDING"
                                                            }
                                                            size="sm"
                                                        />
                                                    </div>

                                                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                                                        {emg.chiefComplaint || "Acute medical condition requiring immediate stabilization"}
                                                    </p>

                                                    {/* Operational metrics */}
                                                    <div className="flex items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap pt-0.5">
                                                        <span>
                                                            <strong>Requested:</strong>{" "}
                                                            {(resv?.resourceType || "ICU_BED").replace(/_/g, " ")} (Qty {resv?.quantity || 1})
                                                        </span>
                                                        <span>
                                                            <strong>Ambulance:</strong>{" "}
                                                            <span className="font-semibold text-slate-700 dark:text-slate-300">{ambProvider}</span>
                                                            {amb?.ambulanceId ? ` (${amb.ambulanceId})` : ""}
                                                        </span>
                                                        <span>
                                                            <strong>Reservation:</strong>{" "}
                                                            <span className={cn(
                                                                "font-bold font-mono px-1.5 py-0.5 rounded text-[10px]",
                                                                resv?.status === "PENDING"
                                                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                                                                    : resv?.status === "CONFIRMED"
                                                                    ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300"
                                                                    : resv?.status === "REJECTED"
                                                                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300"
                                                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                                                            )}>
                                                                {resv?.status || "PENDING"}
                                                            </span>
                                                        </span>
                                                        <span>
                                                            <strong>ETA:</strong>{" "}
                                                            {amb?.etaMinutes ? `${amb.etaMinutes} min` : "3-5 min"}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Right Next Action */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* 1. Pending Reservation -> Accept / Reject */}
                                                    {isPendingReservation && resv && (
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleReservationAction(resv.reservationId, "reject")}
                                                                disabled={!!actionLoading}
                                                                className="h-8 px-3 text-xs font-bold text-rose-700 border-rose-300 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800 dark:text-rose-400"
                                                            >
                                                                {actionLoading === `${resv.reservationId}-reject` ? (
                                                                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                                                ) : (
                                                                    <X className="w-3.5 h-3.5 mr-1" />
                                                                )}
                                                                REJECT
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleReservationAction(resv.reservationId, "confirm")}
                                                                disabled={!!actionLoading}
                                                                className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                                                            >
                                                                {actionLoading === `${resv.reservationId}-confirm` ? (
                                                                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                                                ) : (
                                                                    <Check className="w-3.5 h-3.5 mr-1" />
                                                                )}
                                                                ACCEPT
                                                            </Button>
                                                        </div>
                                                    )}

                                                    {/* 1b. Rejected Reservation */}
                                                    {resv?.status === "REJECTED" && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold">
                                                            <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                                            Reservation Rejected • Capacity Freed
                                                        </div>
                                                    )}

                                                    {/* 2. Confirmed & In Transit */}
                                                    {isConfirmedReservation && !isArrived && (
                                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-xs font-medium">
                                                            <Navigation className="w-3.5 h-3.5 animate-pulse text-sky-600" />
                                                            Reservation Confirmed • Ambulance En Route ({amb?.etaMinutes ? `${amb.etaMinutes}m` : "~4m"})
                                                        </div>
                                                    )}

                                                    {/* 3. Arrived at Hospital -> Start Handoff */}
                                                    {isArrived && (!handoffStatus || handoffStatus === "PENDING") && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleHandoffAction(emg.emergencyId, "START_HANDOFF", resv?.reservationId)}
                                                            disabled={!!actionLoading}
                                                            className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-xs"
                                                        >
                                                            {actionLoading === `${emg.emergencyId}-START_HANDOFF` ? (
                                                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                                            ) : (
                                                                <Activity className="w-3.5 h-3.5 mr-1" />
                                                            )}
                                                            Ambulance Arrived • Start Handoff
                                                        </Button>
                                                    )}

                                                    {/* 4. Handoff In Progress -> Complete Handoff & Admit */}
                                                    {handoffStatus === "IN_PROGRESS" && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleHandoffAction(emg.emergencyId, "COMPLETE_HANDOFF", resv?.reservationId)}
                                                            disabled={!!actionLoading}
                                                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                                                        >
                                                            {actionLoading === `${emg.emergencyId}-COMPLETE_HANDOFF` ? (
                                                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                                            ) : (
                                                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                                            )}
                                                            Complete Handoff & Admit
                                                        </Button>
                                                    )}

                                                    {/* 5. Patient Admitted */}
                                                    {isAdmitted && (
                                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                            Patient Admitted
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>
                )}

                {/* SECTION B: HOSPITAL OVERVIEW & CLINICAL INVENTORY (Requirement 7) */}
                {activeHospitalTab === "facility_overview" && (
                    <div className="space-y-6">
                        {/* Facility Details Header Card */}
                        <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                            <CardContent className="p-6 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                                                {selectedHospital?.hospitalName || "Hospital Facility"}
                                            </h2>
                                            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] font-bold">
                                                ED ACTIVE (24/7)
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            {selectedHospital?.address || selectedHospital?.city || "Pune Regional Center"}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {selectedHospital?.contactNumber && (
                                            <span className="text-xs text-slate-600 dark:text-slate-300 font-mono flex items-center gap-1">
                                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                {selectedHospital.contactNumber}
                                            </span>
                                        )}
                                        <Button
                                            asChild
                                            size="sm"
                                            variant="outline"
                                            className="text-xs h-8"
                                        >
                                            <Link href={`/hospitals/${selectedHospital?.uid || selectedHospital?.hospitalId}`}>
                                                Public Profile →
                                            </Link>
                                        </Button>
                                    </div>
                                </div>

                                {/* Detailed Bed & Capacity Metrics */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-0.5">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Inpatient Beds</span>
                                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">{bedTotal}</p>
                                        <span className="text-[10px] text-slate-500">{bedAvailable} available • {bedOccupied} occupied</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-0.5">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">ICU Critical Care Beds</span>
                                        <p className="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">{icuTotal}</p>
                                        <span className="text-[10px] text-slate-500">{icuAvailable} available • {icuOccupied} occupied</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-0.5">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Operation Theatres</span>
                                        <p className="text-lg font-bold text-purple-600 dark:text-purple-400 font-mono">{otTotal}</p>
                                        <span className="text-[10px] text-slate-500">{otAvailable} operational</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-0.5">
                                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Emergency Availability</span>
                                        <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono">ACTIVE</p>
                                        <span className="text-[10px] text-slate-500">Receiving Ambulances</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Specialties & Instruments Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Clinical Specialties */}
                            <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <Activity className="w-4 h-4 text-blue-600" />
                                            Clinical Specialties ({selectedHospital?.specialties?.length || 0})
                                        </h3>
                                        <span className="text-[10px] text-slate-400">Accredited Units</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {(selectedHospital?.specialties || ["Emergency Medicine", "General Medicine"]).map((spec: string, idx: number) => (
                                            <span
                                                key={idx}
                                                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                                            >
                                                {spec}
                                            </span>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Equipment & Critical Instruments */}
                            <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                                <CardContent className="p-5 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                                            <Hospital className="w-4 h-4 text-purple-600" />
                                            Critical Equipment & Facilities
                                        </h3>
                                        <span className="text-[10px] text-slate-400">Verified Ready</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {(selectedHospital?.instruments?.available || ["icu_monitor", "oxygen_supply", "defibrillator"]).map((inst: string, idx: number) => (
                                            <span
                                                key={idx}
                                                className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                            >
                                                {inst.replace(/_/g, " ")}
                                            </span>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
