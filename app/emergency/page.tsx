"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
    Activity,
    AlertTriangle,
    Ambulance,
    Building2,
    CheckCircle2,
    Clock,
    Hospital,
    MapPin,
    Navigation,
    Phone,
    Radio,
    RefreshCw,
    ShieldAlert,
    ArrowRight,
    Info,
    Stethoscope,
    Search,
    User,
    BedDouble,
    ShieldCheck,
    Layers,
    ChevronRight
} from "lucide-react";
import { EmergencyNav } from "@/components/emergency/emergency-nav";
import { StatusBadge } from "@/components/emergency/status-badge";
import { EmergencyHeader } from "@/components/emergency/emergency-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// 7-step calm, patient-friendly timeline
const PATIENT_TIMELINE = [
    { id: "CREATED", label: "Emergency Created", description: "Request received by emergency dispatch" },
    { id: "MATCHED", label: "Hospital Matched", description: "Specialized care facility identified" },
    { id: "ACCEPTED", label: "Hospital Accepted", description: "Emergency department confirmed incoming bed" },
    { id: "EN_ROUTE", label: "Ambulance En Route", description: "Ambulance in transit to hospital" },
    { id: "ARRIVED", label: "Arrived", description: "Ambulance arrived at emergency entrance" },
    { id: "HANDOFF", label: "Care Team Handoff", description: "Hospital medical team taking over patient care" },
    { id: "ADMITTED", label: "Admitted", description: "Patient formally admitted into facility" }
];

export default function PatientEmergencyPage() {
    const [emergency, setEmergency] = useState<any | null>(null);
    const [ambulance, setAmbulance] = useState<any | null>(null);
    const [reservation, setReservation] = useState<any | null>(null);
    const [hospital, setHospital] = useState<any | null>(null);

    // Patient discovery and navigation state
    const [allHospitals, setAllHospitals] = useState<any[]>([]);
    const [activePatientTab, setActivePatientTab] = useState<"emergency" | "hospitals" | "specialties">("emergency");
    const [hospitalSearch, setHospitalSearch] = useState("");
    const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState("all");

    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [loadingAction, setLoadingAction] = useState(false);
    const [selectedScenario, setSelectedScenario] = useState<string>("NORMAL_CARDIAC");
    const [lastLaunchedScenario, setLastLaunchedScenario] = useState<string | null>(null);
    const [customSymptoms, setCustomSymptoms] = useState<string>("");

    // Fetch live state from /api/emergency/active
    const fetchActiveState = useCallback(async (silent = false) => {
        if (!silent) setIsRefreshing(true);
        try {
            const res = await fetch("/api/emergency/active", { cache: "no-store" });

            // Graceful degradation — non-ok responses are soft failures, not crashes
            if (!res.ok) {
                console.warn(`GET /api/emergency/active returned HTTP ${res.status}`);
                setFetchError(`Emergency server returned HTTP ${res.status}. Retrying...`);
                return;
            }

            const json = await res.json();
            // Support both response shapes:
            //   Old: { success, data: { hospitals, emergencies, ... } }
            //   New: { success, hospitals, emergencies, ..., data: { ... } }
            const data = json.data ?? json;
            if (json.success && data) {

                if (data.hospitals) {
                    setAllHospitals(data.hospitals);
                }

                if (data.emergencies && data.emergencies.length > 0) {
                    let active = data.emergencies[0];
                    if (typeof window !== "undefined") {
                        const qParams = new URLSearchParams(window.location.search);
                        const targetId = qParams.get("emergencyId");
                        if (targetId) {
                            const match = data.emergencies.find((e: any) => e.emergencyId === targetId);
                            if (match) active = match;
                        }
                    }
                    setEmergency(active);

                    if (data.ambulances) {
                        const amb = data.ambulances.find(
                            (a: any) =>
                                a.ambulanceId === active.ambulanceId ||
                                a.assignedEmergencyId === active.emergencyId
                        );
                        setAmbulance(amb || null);
                    }

                    let resv: any = null;
                    if (data.reservations) {
                        resv = data.reservations.find(
                            (r: any) =>
                                r.emergencyId === active.emergencyId &&
                                r.status !== "RELEASED" &&
                                r.status !== "EXPIRED"
                        );
                        setReservation(resv || null);
                    }

                    const targetHospId =
                        active.receivingHospitalId ||
                        active.allocatedHospitalId ||
                        resv?.hospitalId;

                    if (targetHospId && data.hospitals) {
                        const foundHosp = data.hospitals.find(
                            (h: any) => (h.uid || h.hospitalId) === targetHospId
                        );
                        setHospital(foundHosp || null);
                    }
                } else {
                    setEmergency(null);
                    setAmbulance(null);
                    setReservation(null);
                    setHospital(null);
                }
                setFetchError(null);
            }
        } catch (err: any) {
            console.error("Failed to fetch emergency status:", err);
            setFetchError("Unable to reach emergency server. Retrying connection...");
        } finally {
            if (!silent) {
                setIsRefreshing(false);
                setIsLoading(false);
            }
        }
    }, []);

    // Periodic polling every 3.5s
    useEffect(() => {
        fetchActiveState();
        const interval = setInterval(() => {
            fetchActiveState(true);
        }, 3500);
        return () => clearInterval(interval);
    }, [fetchActiveState]);

    // Scenario display labels
    const SCENARIO_LABELS: Record<string, { label: string; color: string; description: string }> = {
        NORMAL_CARDIAC: { label: "Cardiac Emergency (STEMI)", color: "rose", description: "Patient presenting with chest pain, STEMI protocol — requires Cath Lab + ICU" },
        TRAUMA: { label: "Major Trauma", color: "amber", description: "Multi-system trauma — requires Trauma Bay, OR, and Blood Bank" },
        STROKE: { label: "Acute Stroke (CVA)", color: "purple", description: "Acute ischemic stroke — requires Neurology + CT Scan + tPA protocol" },
    };

    // Auto-map typed symptoms to the nearest scenario
    const inferScenarioFromSymptoms = (text: string): string => {
        const t = text.toLowerCase();
        if (t.match(/chest|heart|cardiac|stemi|palpitation|angina|infarct/)) return "NORMAL_CARDIAC";
        if (t.match(/stroke|brain|weakness|drooping|speech|slur|paralysis|neuro/)) return "STROKE";
        if (t.match(/trauma|accident|fall|fracture|bleeding|injury|crash|mva/)) return "TRAUMA";
        return selectedScenario; // keep current if no match
    };

    // Handle running scenario
    // IMPORTANT: passes ambulanceId="AMB-PUNE-01" so the ambulance dashboard always sees the same emergency
    const handleRunSimulation = async (scenario: string) => {
        setLoadingAction(true);
        try {
            // Step 1: Reset all demo data so every dashboard starts fresh
            await fetch("/api/demo/reset", { method: "POST" });

            // Step 2: Run chosen scenario assigned to the fixed demo ambulance
            const res = await fetch("/api/emergency/simulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    scenario,
                    ambulanceId: "AMB-PUNE-01"  // Fixed: ensures ambulance dashboard sees this emergency
                })
            });
            const data = await res.json();
            if (res.ok || res.status === 202) {
                setLastLaunchedScenario(scenario);
                toast.success(`✅ ${SCENARIO_LABELS[scenario]?.label ?? scenario} — ambulance dispatched!`);
                // Wait for DB to commit, then fetch fresh state
                await new Promise(r => setTimeout(r, 800));
                await fetchActiveState();
            } else {
                toast.error(data.error || "Failed to start scenario.");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to trigger simulation.");
        } finally {
            setLoadingAction(false);
        }
    };

    // Calculate current step in patient timeline
    const getCurrentStepIndex = () => {
        if (!emergency) return -1;
        const eStatus = emergency.status;
        const tStatus = emergency.transportStatus || ambulance?.transportStatus;
        const hStatus = emergency.handoffStatus;
        const rStatus = reservation?.status;

        if (eStatus === "ADMITTED" || hStatus === "COMPLETED") return 6; // Admitted
        if (hStatus === "IN_PROGRESS") return 5; // Handed Off (care team taking over)
        if (eStatus === "ARRIVED" || tStatus === "ARRIVED") return 4; // Arrived
        if (eStatus === "TRANSPORTING" || tStatus === "EN_ROUTE") return 3; // Ambulance En Route
        if (rStatus === "CONFIRMED" || emergency.receivingHospitalId) return 2; // Hospital Accepted
        if (emergency.allocatedHospitalId || reservation) return 1; // Hospital Matched
        return 0; // Emergency Created
    };

    const currentStep = getCurrentStepIndex();

    // Plain language status display
    const getPlainStatus = () => {
        if (!emergency) return { label: "STANDBY", badge: "AVAILABLE", plain: "All systems standing by" };
        const eStatus = emergency.status;
        const tStatus = emergency.transportStatus || ambulance?.transportStatus;
        const hStatus = emergency.handoffStatus;
        const rStatus = reservation?.status;

        if (eStatus === "ADMITTED" || hStatus === "COMPLETED") {
            return {
                label: "Admitted",
                badge: "ADMITTED",
                plain: "Patient is admitted and receiving active hospital care"
            };
        }
        if (hStatus === "IN_PROGRESS") {
            return {
                label: "Care Team Handoff",
                badge: "HANDOFF",
                plain: "Emergency clinical team is receiving patient transfer"
            };
        }
        if (eStatus === "ARRIVED" || tStatus === "ARRIVED") {
            return {
                label: "Arrived at Hospital",
                badge: "ARRIVED",
                plain: "Ambulance has arrived at receiving hospital entrance"
            };
        }
        if (eStatus === "TRANSPORTING" || tStatus === "EN_ROUTE") {
            return {
                label: "Ambulance on the Way",
                badge: "EN_ROUTE",
                plain: "En route to confirmed hospital under active telemetry"
            };
        }
        if (rStatus === "CONFIRMED") {
            return {
                label: "Hospital Accepted",
                badge: "CONFIRMED",
                plain: "Receiving facility confirmed bed and staff preparation"
            };
        }
        if (rStatus === "PENDING" || emergency.allocatedHospitalId) {
            return {
                label: "Hospital Matched",
                badge: "MATCHED",
                plain: "Hospital matched to medical needs; awaiting bed lock"
            };
        }
        return {
            label: "Emergency Dispatched",
            badge: "PENDING",
            plain: "Paramedic crew dispatched to patient location"
        };
    };

    const statusInfo = getPlainStatus();

    // Hospital name
    const hospitalName =
        emergency?.receivingHospitalName ||
        hospital?.hospitalName ||
        (emergency?.allocatedHospitalId ? "Matching Recommended Hospital..." : "Identifying Facility...");

    // Ambulance status in calm words
    const ambulanceStatusText = ambulance
        ? ambulance.status === "AT_HOSPITAL"
            ? "Arrived at Hospital"
            : ambulance.status === "TRANSPORTING"
            ? "En route to Hospital"
            : ambulance.status === "DISPATCHED"
            ? "En route to Scene"
            : ambulance.status === "ON_SCENE"
            ? "Paramedics on Scene"
            : ambulance.status.replace(/_/g, " ")
        : "Ambulance Assigned";

    const ambulanceEta = ambulance?.etaMinutes ? `${ambulance.etaMinutes} min estimated` : "4-6 min estimated";

    // Filter hospitals for discovery tab
    const filteredHospitals = allHospitals.filter((h) => {
        const query = hospitalSearch.toLowerCase().trim();
        const matchesQuery =
            !query ||
            (h.hospitalName && h.hospitalName.toLowerCase().includes(query)) ||
            (h.city && h.city.toLowerCase().includes(query)) ||
            (h.address && h.address.toLowerCase().includes(query)) ||
            (Array.isArray(h.specialties) && h.specialties.some((s: string) => s.toLowerCase().includes(query)));

        const matchesSpecialty =
            selectedSpecialtyFilter === "all" ||
            (Array.isArray(h.specialties) &&
                h.specialties.some((s: string) => s.toLowerCase().includes(selectedSpecialtyFilter.toLowerCase())));

        return matchesQuery && matchesSpecialty;
    });

    return (
        <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
            {/* Header Navigation */}
            <EmergencyNav
                role="patient"
                isRefreshing={isRefreshing}
                onRefresh={() => fetchActiveState()}
                liveIndicatorText="LIVE CARE TELEMETRY"
                extraActions={
                    emergency ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEmergency(null); setLastLaunchedScenario(null); }}
                            className="text-xs text-slate-500 dark:text-slate-400 h-8"
                        >
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                            <span className="hidden sm:inline">Change Condition</span>
                        </Button>
                    ) : null
                }
            />

            {/* Main Content */}
            <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
                {/* Network / Sync Error Alert with Retry */}
                {fetchError && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>{fetchError}</span>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => fetchActiveState()}
                            className="h-7 text-xs text-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {/* PATIENT DASHBOARD SUB-NAVIGATION TABS */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs overflow-x-auto">
                        <button
                            type="button"
                            id="tab-btn-emergency"
                            onClick={() => setActivePatientTab("emergency")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                                activePatientTab === "emergency"
                                    ? "bg-red-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Emergency Status</span>
                            {emergency && (
                                <span className="h-2 w-2 rounded-full bg-white animate-pulse ml-0.5" />
                            )}
                        </button>

                        <button
                            type="button"
                            id="tab-btn-hospitals"
                            onClick={() => setActivePatientTab("hospitals")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                                activePatientTab === "hospitals"
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <Hospital className="w-3.5 h-3.5" />
                            <span>Hospital Discovery</span>
                            {allHospitals.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    {allHospitals.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            id="tab-btn-specialties"
                            onClick={() => setActivePatientTab("specialties")}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap",
                                activePatientTab === "specialties"
                                    ? "bg-purple-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>Specialties & Doctors</span>
                        </button>

                        <Link
                            href="/profile"
                            id="tab-btn-profile"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap transition-colors"
                        >
                            <User className="w-3.5 h-3.5" />
                            <span>Profile</span>
                        </Link>
                    </div>

                    <div className="text-right hidden sm:block">
                        <span className="text-[11px] font-mono text-slate-400">
                            {allHospitals.length} Atlas Verified Facilities
                        </span>
                    </div>
                </div>

                {/* TAB 1: EMERGENCY CARE STATUS (Standardized Flow) */}
                {activePatientTab === "emergency" && (
                    <>
                        {/* Loading Skeleton */}
                        {isLoading && !emergency ? (
                            <div className="space-y-4 animate-pulse">
                                <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                                <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                                <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
                            </div>
                        ) : !emergency ? (
                            /* ── CONDITION SELECTOR (shown when no active emergency) ── */
                            <div className="space-y-4">
                                {/* Instruction header */}
                                <div className="text-center space-y-1 pt-2">
                                    <div className="h-12 w-12 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                                        <Stethoscope className="w-6 h-6" />
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-2">
                                        What is your emergency?
                                    </h3>
                                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                        Select your condition or describe your symptoms. All 3 dashboards sync instantly.
                                    </p>
                                </div>

                                {/* 3 large condition cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {([
                                        {
                                            key: "NORMAL_CARDIAC",
                                            emoji: "🫀",
                                            label: "Heart / Cardiac",
                                            sub: "Chest pain, STEMI, heart attack",
                                            detail: "Cath Lab + ICU + Cardiology",
                                            border: "border-rose-300 dark:border-rose-800",
                                            bg: "bg-rose-50 dark:bg-rose-950/30",
                                            ring: "ring-rose-400",
                                            text: "text-rose-800 dark:text-rose-200",
                                            dot: "bg-rose-500"
                                        },
                                        {
                                            key: "TRAUMA",
                                            emoji: "🚑",
                                            label: "Trauma / Injury",
                                            sub: "Accident, fractures, bleeding",
                                            detail: "Trauma Bay + OR + Blood Bank",
                                            border: "border-amber-300 dark:border-amber-800",
                                            bg: "bg-amber-50 dark:bg-amber-950/30",
                                            ring: "ring-amber-400",
                                            text: "text-amber-800 dark:text-amber-200",
                                            dot: "bg-amber-500"
                                        },
                                        {
                                            key: "STROKE",
                                            emoji: "🧠",
                                            label: "Brain / Stroke",
                                            sub: "Weakness, speech loss, drooping",
                                            detail: "Neurology + CT Scan + tPA",
                                            border: "border-purple-300 dark:border-purple-800",
                                            bg: "bg-purple-50 dark:bg-purple-950/30",
                                            ring: "ring-purple-400",
                                            text: "text-purple-800 dark:text-purple-200",
                                            dot: "bg-purple-500"
                                        },
                                    ] as const).map(({ key, emoji, label, sub, detail, border, bg, ring, text, dot }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            id={`condition-btn-${key.toLowerCase()}`}
                                            onClick={() => { setSelectedScenario(key); setCustomSymptoms(""); }}
                                            className={cn(
                                                "p-4 rounded-2xl border-2 text-left transition-all duration-150 space-y-2",
                                                selectedScenario === key
                                                    ? `${border} ${bg} ring-2 ring-offset-2 ${ring} shadow-md`
                                                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600"
                                            )}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-2xl">{emoji}</span>
                                                {selectedScenario === key && (
                                                    <span className={cn("h-3 w-3 rounded-full", dot)} />
                                                )}
                                            </div>
                                            <div>
                                                <div className={cn("font-bold text-sm", selectedScenario === key ? text : "text-slate-900 dark:text-white")}>
                                                    {label}
                                                </div>
                                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>
                                            </div>
                                            <div className={cn(
                                                "text-[10px] font-mono px-2 py-1 rounded border",
                                                selectedScenario === key
                                                    ? `${border} ${text} ${bg}`
                                                    : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                                            )}>
                                                {detail}
                                            </div>
                                        </button>
                                    ))}
                                </div>

                                {/* OR: type symptoms */}
                                <div className="relative">
                                    <div className="absolute inset-x-0 top-0 flex items-center">
                                        <div className="w-full border-t border-slate-200 dark:border-slate-700" />
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="bg-slate-50 dark:bg-slate-950 px-3 text-xs text-slate-400 font-medium">or describe your symptoms</span>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <textarea
                                        value={customSymptoms}
                                        onChange={(e) => {
                                            setCustomSymptoms(e.target.value);
                                            const inferred = inferScenarioFromSymptoms(e.target.value);
                                            setSelectedScenario(inferred);
                                        }}
                                        placeholder="e.g. 'Severe chest pain and shortness of breath for last 20 minutes' — we will match you to the right emergency team"
                                        rows={3}
                                        className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                                    />
                                    {customSymptoms.trim() && (
                                        <p className="text-[10px] text-slate-500 pl-1">
                                            Auto-matched to: <strong className="text-slate-700 dark:text-slate-300">{SCENARIO_LABELS[selectedScenario]?.label}</strong>
                                        </p>
                                    )}
                                </div>

                                {/* Launch button */}
                                <Button
                                    id="btn-launch-emergency"
                                    onClick={() => handleRunSimulation(selectedScenario)}
                                    disabled={loadingAction}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12 rounded-2xl text-sm shadow-md shadow-red-600/20"
                                >
                                    {loadingAction ? (
                                        <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Dispatching Ambulance…</>
                                    ) : (
                                        <><AlertTriangle className="w-4 h-4 mr-2" /> Request Emergency Help — {SCENARIO_LABELS[selectedScenario]?.label}</>
                                    )}
                                </Button>

                                <p className="text-center text-[10px] text-slate-400">
                                    Ambulance · Hospital · Patient dashboards will all reflect this emergency
                                </p>
                            </div>
                        ) : (
                            /* Active Emergency Flow */
                            <div className="space-y-6">
                                {/* Active condition banner */}
                                <div className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs">
                                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-semibold">
                                        <Radio className="w-3.5 h-3.5 animate-pulse text-blue-600" />
                                        <span>
                                            Active Condition: <strong>{emergency.condition || emergency.emergencyType || (lastLaunchedScenario && SCENARIO_LABELS[lastLaunchedScenario]?.label) || "Emergency"}</strong>
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setEmergency(null); setAmbulance(null); setReservation(null); setHospital(null); setLastLaunchedScenario(null); }}
                                        className="text-blue-600 dark:text-blue-400 underline text-[10px] font-medium hover:text-blue-800 whitespace-nowrap"
                                    >
                                        ← Change Condition
                                    </button>
                                </div>

                                {/* 1. Standardized Emergency Status Header */}
                                <EmergencyHeader
                                    emergencyId={emergency.emergencyId}
                                    emergencyType={emergency.emergencyType || emergency.condition}
                                    priority={emergency.priority}
                                    status={statusInfo.badge}
                                    statusLabel={statusInfo.label}
                                    chiefComplaint={emergency.chiefComplaint}
                                />

                                {/* 2. Main Status: Hospital, Ambulance, Transport */}
                                <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                                    <CardContent className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {/* Section A: Receiving Hospital */}
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                Receiving Hospital
                                            </span>
                                            <div className="flex items-start gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Hospital className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                                                        {hospitalName}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {hospital?.operationalCapacity?.availableIcuBeds !== undefined
                                                            ? `${hospital.operationalCapacity.availableIcuBeds} ICU beds available`
                                                            : reservation?.status === "CONFIRMED"
                                                            ? "Bed reservation secured"
                                                            : "Matched by medical capability"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section B: Ambulance Unit */}
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                Ambulance Unit
                                            </span>
                                            <div className="flex items-start gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Ambulance className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                                                        {ambulance?.ambulanceId || "EMS Dispatch Unit"}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 mt-0.5 capitalize">
                                                        {ambulanceStatusText}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section C: Transport Progress */}
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                                Estimated Arrival
                                            </span>
                                            <div className="flex items-start gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Navigation className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
                                                        {ambulanceEta}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {statusInfo.plain}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* 3. Compact Care Details */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                            Required Specialty
                                        </span>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate">
                                            {emergency.requiredSpecialty || emergency.condition || "Emergency Medicine"}
                                        </p>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                            Prepared Care Resources
                                        </span>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate">
                                            {Array.isArray(emergency.requiredResources)
                                                ? emergency.requiredResources.map((r: string) => r.replace(/_/g, " ")).join(", ")
                                                : "ICU Bed, Ventilator"}
                                        </p>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                                            Hospital Bed Status
                                        </span>
                                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1 truncate">
                                            {hospital?.operationalCapacity
                                                ? `${hospital.operationalCapacity.availableIcuBeds} ICU / ${hospital.operationalCapacity.availableBeds} General Available`
                                                : "Capacity Reserved"}
                                        </p>
                                    </div>
                                </div>

                                {/* 4. Progressive Care Timeline (7 Steps) */}
                                <Card className="border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                                    <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                            Care Journey Timeline
                                        </h3>
                                        <span className="text-xs text-slate-400 font-medium">
                                            Step {Math.min(currentStep + 1, PATIENT_TIMELINE.length)} of {PATIENT_TIMELINE.length}
                                        </span>
                                    </div>

                                    <CardContent className="p-5">
                                        <div className="space-y-4">
                                            {PATIENT_TIMELINE.map((step, index) => {
                                                const isPast = index < currentStep;
                                                const isCurrent = index === currentStep;
                                                const isFuture = index > currentStep;

                                                return (
                                                    <div
                                                        key={step.id}
                                                        className={cn(
                                                            "flex items-start gap-3.5 transition-opacity",
                                                            isFuture && "opacity-40"
                                                        )}
                                                    >
                                                        {/* Left Indicator & Connector */}
                                                        <div className="flex flex-col items-center">
                                                            <div
                                                                className={cn(
                                                                    "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                                                                    isPast && "bg-emerald-600 text-white",
                                                                    isCurrent && "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950/60 animate-pulse",
                                                                    isFuture && "bg-slate-100 text-slate-400 dark:bg-slate-800"
                                                                )}
                                                            >
                                                                {isPast ? (
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                ) : (
                                                                    <span>{index + 1}</span>
                                                                )}
                                                            </div>
                                                            {index < PATIENT_TIMELINE.length - 1 && (
                                                                <div
                                                                    className={cn(
                                                                        "w-0.5 h-6 my-0.5",
                                                                        isPast ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"
                                                                    )}
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Text Content */}
                                                        <div className="pt-0.5 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4
                                                                    className={cn(
                                                                        "text-xs font-semibold",
                                                                        isCurrent
                                                                            ? "text-blue-600 dark:text-blue-400"
                                                                            : isPast
                                                                            ? "text-slate-800 dark:text-slate-200"
                                                                            : "text-slate-400"
                                                                    )}
                                                                >
                                                                    {step.label}
                                                                </h4>
                                                                {isCurrent && (
                                                                    <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider rounded bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                                        In Progress
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                                {step.description}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </>
                )}

                {/* TAB 2: HOSPITAL DISCOVERY & SEARCH */}
                {activePatientTab === "hospitals" && (
                    <div className="space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                    Hospital Network Discovery
                                </h2>
                                <p className="text-xs text-slate-500">
                                    Search facilities by specialty, bed availability, and clinical capabilities.
                                </p>
                            </div>

                            {/* Search Input */}
                            <div className="relative w-full sm:w-72">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <Input
                                    value={hospitalSearch}
                                    onChange={(e) => setHospitalSearch(e.target.value)}
                                    placeholder="Search hospital or city..."
                                    className="pl-8 text-xs h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                                />
                            </div>
                        </div>

                        {/* Specialty Filter Badges */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-slate-400 mr-1">Filter:</span>
                            {["all", "Cardiology", "Trauma", "Neurology", "General Medicine", "Emergency Medicine"].map((spec) => (
                                <button
                                    key={spec}
                                    type="button"
                                    onClick={() => setSelectedSpecialtyFilter(spec)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                                        selectedSpecialtyFilter === spec
                                            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-semibold"
                                            : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                                    )}
                                >
                                    {spec === "all" ? "All Specialties" : spec}
                                </button>
                            ))}
                        </div>

                        {/* Hospital Cards Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredHospitals.map((h) => {
                                const cap = h.operationalCapacity || h.capacity || {};
                                const availBeds = cap.availableBeds ?? 0;
                                const totBeds = cap.totalBeds ?? 0;
                                const availIcu = cap.availableIcuBeds ?? 0;
                                const specs: string[] = h.specialties || [];
                                const instrs: string[] = h.instruments?.available || [];

                                return (
                                    <Card
                                        key={h.uid || h.hospitalId}
                                        className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                                    >
                                        <CardContent className="p-5 space-y-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
                                                        {h.hospitalName}
                                                    </h3>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                                                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                        <span>{h.address || h.city || "Pune Regional Center"}</span>
                                                    </p>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className="shrink-0 text-[10px] font-semibold border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300"
                                                >
                                                    24/7 ED ACTIVE
                                                </Badge>
                                            </div>

                                            {/* Bed Capacity Metrics */}
                                            <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block">General Beds</span>
                                                    <span className="font-bold text-slate-800 dark:text-slate-200">
                                                        {availBeds} <span className="font-normal text-slate-400">/ {totBeds}</span>
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 block">ICU Beds</span>
                                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                                        {availIcu} Available
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Specialties & Instruments Tags */}
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {specs.slice(0, 3).map((s, idx) => (
                                                        <span
                                                            key={idx}
                                                            className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                                                        >
                                                            {s}
                                                        </span>
                                                    ))}
                                                    {specs.length > 3 && (
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            +{specs.length - 3} more
                                                        </span>
                                                    )}
                                                </div>

                                                {instrs.length > 0 && (
                                                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                                        {instrs.slice(0, 3).map((ins, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900"
                                                            >
                                                                {ins.replace(/_/g, " ")}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Link */}
                                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                                {h.contactNumber && (
                                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                                        <Phone className="w-3 h-3 text-slate-400" />
                                                        {h.contactNumber}
                                                    </span>
                                                )}
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50 p-0 font-semibold flex items-center gap-1 ml-auto"
                                                >
                                                    <Link href={`/hospitals/${h.uid || h.hospitalId}`}>
                                                        <span>View Details</span>
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}

                            {filteredHospitals.length === 0 && (
                                <div className="col-span-full p-8 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                                    <Hospital className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                        No hospitals match your search criteria
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Try changing the specialty filter or clearing the search text.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TAB 3: CLINICAL SPECIALTIES & DOCTORS */}
                {activePatientTab === "specialties" && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                Clinical Coverage & Medical Departments
                            </h2>
                            <p className="text-xs text-slate-500">
                                Verified hospital specialist networks and clinical resource readiness.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {[
                                {
                                    name: "Cardiology & Interventional Cath Lab",
                                    desc: "Emergency primary angioplasty (PCI), STEMI resuscitation, cardiac intensive care.",
                                    tag: "24/7 Cath Lab"
                                },
                                {
                                    name: "Emergency Trauma & Resuscitation",
                                    desc: "Level-1 resuscitation bays, polytrauma surgical teams, multi-parameter ICU monitoring.",
                                    tag: "Level 1 Trauma"
                                },
                                {
                                    name: "Neurology & Acute Stroke Unit",
                                    desc: "Stroke thrombolysis, neurovascular imaging, cranial decompression, specialized neuro-ICU.",
                                    tag: "Stroke Center"
                                },
                                {
                                    name: "Critical Care & Pulmonology",
                                    desc: "Invasive mechanical ventilation, ARDS protocols, continuous blood gas telemetry.",
                                    tag: "ICU Ventilators"
                                },
                                {
                                    name: "Orthopedic & Spine Surgery",
                                    desc: "Complex trauma reconstruction, joint replacement, emergency stabilization.",
                                    tag: "Trauma OR"
                                },
                                {
                                    name: "Pediatric Emergency & Neonatal",
                                    desc: "Pediatric intensive care (PICU), neonatal incubators, specialized pediatric emergency teams.",
                                    tag: "PICU Ready"
                                }
                            ].map((spec, i) => (
                                <Card key={i} className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                                    <CardContent className="p-4 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Stethoscope className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                {spec.tag}
                                            </span>
                                        </div>
                                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                            {spec.name}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                            {spec.desc}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Quick Action Navigation Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                            <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between shadow-xs">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Search Specialist Doctors</h4>
                                    <p className="text-[11px] text-slate-500">Find doctors by specialty, ratings, and hospital</p>
                                </div>
                                <Button asChild size="sm" className="h-8 text-xs bg-slate-900 dark:bg-white text-white dark:text-slate-900">
                                    <Link href="/doctors/search">Find Doctors →</Link>
                                </Button>
                            </Card>

                            <Card className="border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex items-center justify-between shadow-xs">
                                <div>
                                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">Treatment Decision Support</h4>
                                    <p className="text-[11px] text-slate-500">Compare treatment costs, recovery, and suitability</p>
                                </div>
                                <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                                    <Link href="/recommendations">Recommendations →</Link>
                                </Button>
                            </Card>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
