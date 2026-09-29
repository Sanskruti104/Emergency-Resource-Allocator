"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Activity,
    AlertTriangle,
    Ambulance,
    Building2,
    CheckCircle2,
    Clock,
    ExternalLink,
    FastForward,
    HeartPulse,
    Hospital,
    Info,
    Loader2,
    Radio,
    RefreshCw,
    RotateCcw,
    ShieldAlert,
    Stethoscope,
    Sparkles,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/emergency/status-badge";

interface ScenarioCardDef {
    id: "JUDGE_DEMO_CARDIAC" | "NORMAL_CARDIAC" | "TRAUMA" | "STROKE" | "ICU_SCARCITY" | "STALE_HOSPITAL_DATA" | "NO_SUITABLE_HOSPITAL";
    label: string;
    description: string;
    expectedBehavior: string;
    category: "OPERATIONAL" | "NEGATIVE_PATH" | "TELEMETRY";
    badgeText: string;
    icon: React.ReactNode;
}

const SCENARIOS: ScenarioCardDef[] = [
    {
        id: "JUDGE_DEMO_CARDIAC",
        label: "Primary Judge Demo — Cardiac Emergency",
        description: "Severe STEMI in shock requiring Cardiology, Cath Lab, ICU & Ventilator. Demonstrates nearest-unsuitable rejection vs. farther-suitable selection.",
        expectedBehavior: "Nearest unsuitable facility rejected → Farther equipped hospital selected → Reservation → Acceptance → Transport → Arrival → Handoff → Admission",
        category: "OPERATIONAL",
        badgeText: "PRIMARY JUDGE DEMO",
        icon: <HeartPulse className="w-5 h-5 text-red-600" />
    },
    {
        id: "NORMAL_CARDIAC",
        label: "Cardiac Emergency",
        description: "Emergency requiring cardiology, ICU capacity and cardiac resources.",
        expectedBehavior: "Emergency → Allocation → Reservation → Acceptance → Transport → Arrival → Handoff → Admission",
        category: "OPERATIONAL",
        badgeText: "Full Lifecycle",
        icon: <HeartPulse className="w-5 h-5 text-red-500" />
    },
    {
        id: "TRAUMA",
        label: "Trauma Emergency",
        description: "Trauma patient requiring trauma care and critical-care resources.",
        expectedBehavior: "Emergency → Allocation → Reservation → Acceptance → Transport → Arrival → Handoff → Admission",
        category: "OPERATIONAL",
        badgeText: "Full Lifecycle",
        icon: <AlertTriangle className="w-5 h-5 text-amber-500" />
    },
    {
        id: "STROKE",
        label: "Stroke Emergency",
        description: "Stroke patient requiring neurology and imaging capabilities.",
        expectedBehavior: "Emergency → Allocation → Reservation → Acceptance → Transport → Arrival → Handoff → Admission",
        category: "OPERATIONAL",
        badgeText: "Full Lifecycle",
        icon: <Zap className="w-5 h-5 text-purple-500" />
    },
    {
        id: "ICU_SCARCITY",
        label: "ICU Scarcity",
        description: "Demonstrates what happens when required ICU capacity is unavailable.",
        expectedBehavior: "No suitable hospital · No reservation · No transport · Capacity unchanged",
        category: "NEGATIVE_PATH",
        badgeText: "Negative Path",
        icon: <ShieldAlert className="w-5 h-5 text-rose-500" />
    },
    {
        id: "STALE_HOSPITAL_DATA",
        label: "Stale Hospital Data",
        description: "Demonstrates how stale hospital telemetry affects allocation.",
        expectedBehavior: "Fresh facility preferred by existing allocator over stale facility",
        category: "TELEMETRY",
        badgeText: "Freshness Preference",
        icon: <Clock className="w-5 h-5 text-sky-500" />
    },
    {
        id: "NO_SUITABLE_HOSPITAL",
        label: "No Suitable Hospital",
        description: "Demonstrates safe clinical diversion when no facility satisfies mandatory requirements.",
        expectedBehavior: "No reservation · No transport · No false hospital assignment · Capacity unchanged",
        category: "NEGATIVE_PATH",
        badgeText: "Negative Path",
        icon: <Building2 className="w-5 h-5 text-slate-500" />
    }
];

export default function DemoScenarioLauncherPage() {
    const [activeScenario, setActiveScenario] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [startingScenario, setStartingScenario] = useState<string | null>(null);
    const [isResetting, setIsResetting] = useState(false);
    const [isAdvancing, setIsAdvancing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [lastFailedScenario, setLastFailedScenario] = useState<string | null>(null);

    // Fetch active scenario state
    const fetchActiveScenario = useCallback(async (silent = false) => {
        try {
            const res = await fetch("/api/demo/scenario", { cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setActiveScenario(data.activeScenario || null);
                    if (data.activeScenario) {
                        setErrorMessage(null);
                    }
                }
            }
        } catch (err: any) {
            console.error("Failed to fetch demo scenario:", err);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, []);

    // Polling active scenario every 3s
    useEffect(() => {
        fetchActiveScenario();
        const interval = setInterval(() => {
            fetchActiveScenario(true);
        }, 3000);
        return () => clearInterval(interval);
    }, [fetchActiveScenario]);

    // Handle Start Scenario
    const handleStartScenario = async (scenarioId: string) => {
        setStartingScenario(scenarioId);
        setErrorMessage(null);
        setLastFailedScenario(scenarioId);

        try {
            const res = await fetch("/api/demo/scenario", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ scenario: scenarioId })
            });

            const data = await res.json();

            if (res.status === 409 && data.alreadyActive) {
                toast.info("Demo scenario already active.");
                await fetchActiveScenario();
                return;
            }

            if (res.ok && data.success) {
                toast.success(data.message || `Scenario ${scenarioId} started.`);
                setActiveScenario(data.activeScenario);
                // Scroll smoothly to active scenario card
                setTimeout(() => {
                    const el = document.getElementById("active-scenario-card");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                }, 150);
            } else {
                setErrorMessage("Unable to start demo scenario.");
                toast.error("Unable to start demo scenario.");
            }
        } catch (err: any) {
            console.error("Start scenario error:", err);
            setErrorMessage("Unable to start demo scenario.");
            toast.error("Unable to start demo scenario.");
        } finally {
            setStartingScenario(null);
        }
    };

    // Handle Reset Demo
    const handleResetDemo = async () => {
        setIsResetting(true);
        setErrorMessage(null);
        try {
            const res = await fetch("/api/demo/reset", { method: "POST" });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Demo scenario records reset successfully.");
                setActiveScenario(null);
            } else {
                toast.error(data.error || "Failed to reset demo.");
            }
        } catch (err: any) {
            toast.error("Network error resetting demo.");
        } finally {
            setIsResetting(false);
            await fetchActiveScenario();
        }
    };

    // Handle Step-by-Step Advance
    const handleAdvanceStage = async () => {
        if (!activeScenario || isAdvancing) return;
        setIsAdvancing(true);
        try {
            const res = await fetch("/api/demo/advance", { method: "POST" });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(data.message || `Advanced to ${data.stage}`);
                await fetchActiveScenario();
            } else {
                toast.error(data.error || data.message || "Cannot advance stage.");
            }
        } catch (err: any) {
            toast.error("Network error advancing stage.");
        } finally {
            setIsAdvancing(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
            {/* Minimal Header */}
            <header className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-red-600 flex items-center justify-center text-white shadow-xs">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">
                                    MedDecision
                                </span>
                                <span className="text-slate-400 dark:text-slate-500 font-light">•</span>
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    Emergency Operations Demo
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Autonomous Clinical Resource Allocation & ED Orchestration
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Link href="/emergency" className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hidden sm:inline-block">
                            Patient View
                        </Link>
                        <Link href="/ambulance" className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hidden sm:inline-block">
                            Ambulance CAD
                        </Link>
                        <Link href="/hospital/emergency-board" className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 hidden sm:inline-block">
                            Hospital Board
                        </Link>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetDemo}
                            disabled={isResetting}
                            className="h-8 text-xs gap-1.5 border-slate-300 dark:border-slate-700"
                        >
                            <RotateCcw className={cn("w-3.5 h-3.5", isResetting && "animate-spin")} />
                            <span>Reset Demo</span>
                        </Button>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
                {/* 1. Page Title & Subtitle */}
                <div className="space-y-1.5">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                        Emergency Operations Demo
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
                        Select a scenario to demonstrate the live emergency coordination workflow.
                    </p>
                </div>

                {/* 2. DEMO MODE Banner */}
                <div className="bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
                    <div className="flex items-start gap-3">
                        <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 shrink-0 mt-0.5">
                            <Info className="w-4 h-4" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sky-900 dark:text-sky-200 uppercase tracking-wider text-[11px]">
                                    DEMO MODE
                                </span>
                                <Badge variant="outline" className="text-[10px] py-0 border-sky-300 text-sky-700 dark:border-sky-700 dark:text-sky-300 font-mono">
                                    MONGODB LIVE
                                </Badge>
                            </div>
                            <p className="text-sky-800 dark:text-sky-300/90 leading-relaxed text-[11px]">
                                Emergency telemetry and external GPS/road feeds are simulated for demonstration. Allocation, reservation, capacity, transport, handoff and admission are executed through the real application workflow and MongoDB operational records.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 7-Step Judge Explanation: How the destination was chosen */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                How the destination was chosen
                            </h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">Autonomous Decision Pipeline</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 text-xs">
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400 block">1. Requirements</span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">Determine emergency condition, triage priority & mandatory resources</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block">2. Capabilities</span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">Check hospital specialties & operational equipment</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block">3. Availability</span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">Check real-time ICU, general bed & telemetry freshness</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block">4. Reject Unsuitable</span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">Reject unsuitable facilities lacking mandatory clinical resources</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block">5. Distance & ETA</span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">Compare travel distance & road ETA among suitable options</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block">6. Reserve Resource</span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">Hold required critical resource with atomic CAS lock</p>
                        </div>
                        <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 block">7. Transport & Admit</span>
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">Complete transport, clinical handoff and admission</p>
                        </div>
                    </div>
                </div>

                {/* Error Banner with Try Again */}
                {errorMessage && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center justify-between text-xs text-red-800 dark:text-red-300 shadow-xs">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                            <span className="font-medium">{errorMessage}</span>
                        </div>
                        {lastFailedScenario && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartScenario(lastFailedScenario)}
                                disabled={startingScenario !== null}
                                className="h-8 text-xs border-red-300 text-red-800 dark:border-red-800 dark:text-red-200 hover:bg-red-100 dark:hover:bg-red-900/50"
                            >
                                Try Again
                            </Button>
                        )}
                    </div>
                )}

                {/* 3. ACTIVE SCENARIO CARD */}
                {activeScenario && (
                    <div id="active-scenario-card" className="space-y-3">
                        <Card className="border-2 border-emerald-500/80 dark:border-emerald-500/60 bg-white dark:bg-slate-900 shadow-md overflow-hidden">
                            <div className="bg-emerald-600 dark:bg-emerald-700 px-4 sm:px-6 py-2.5 text-white flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                                    <span className="font-bold text-xs uppercase tracking-wider">
                                        SCENARIO ACTIVE
                                    </span>
                                    <span className="opacity-75">•</span>
                                    <span className="font-semibold text-xs">
                                        {activeScenario.scenarioName}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-[11px] font-mono opacity-90">
                                        ID: {activeScenario.emergencyId}
                                    </span>
                                </div>
                            </div>

                            <CardContent className="p-4 sm:p-6 space-y-5">
                                {/* State Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                    <div className="space-y-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] uppercase font-semibold text-slate-400">Emergency Type</span>
                                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                                            {activeScenario.emergencyType}
                                        </p>
                                    </div>

                                    <div className="space-y-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] uppercase font-semibold text-slate-400">Triage Priority</span>
                                        <div>
                                            <Badge className={cn("text-[10px] font-bold", activeScenario.priority === "RED" ? "bg-red-600" : "bg-amber-600")}>
                                                {activeScenario.priority}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="space-y-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] uppercase font-semibold text-slate-400">Lifecycle Stage</span>
                                        <div>
                                            <StatusBadge status={activeScenario.status} />
                                        </div>
                                    </div>

                                    <div className="space-y-1 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] uppercase font-semibold text-slate-400">Assigned Ambulance</span>
                                        <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                            <Ambulance className="w-3.5 h-3.5 text-amber-500" />
                                            {activeScenario.ambulanceId}
                                        </p>
                                    </div>
                                </div>

                                {activeScenario.hospitalName && (
                                    <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-lg flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <Hospital className="w-4 h-4 text-blue-600 shrink-0" />
                                            <div>
                                                <span className="font-semibold text-blue-950 dark:text-blue-200">
                                                    Receiving Hospital: {activeScenario.hospitalName}
                                                </span>
                                                {activeScenario.reservationStatus && (
                                                    <span className="ml-2 text-[11px] text-blue-700 dark:text-blue-300">
                                                        (Bed Reservation: {activeScenario.reservationStatus})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeScenario.isDiversion && (
                                    <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>Safe Clinical Diversion Protocol: No facility in region met mandatory critical capacity. Hospital capacity preserved untouched.</span>
                                    </div>
                                )}

                                {/* ACTION BUTTONS: Operational Views & Controls */}
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                            href={`/emergency?emergencyId=${activeScenario.emergencyId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Button
                                                size="sm"
                                                className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-9 shadow-xs gap-1.5"
                                            >
                                                <span>OPEN PATIENT VIEW</span>
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </Button>
                                        </Link>

                                        <Link
                                            href={`/ambulance?ambulanceId=${activeScenario.ambulanceId}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Button
                                                size="sm"
                                                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 shadow-xs gap-1.5"
                                            >
                                                <span>OPEN AMBULANCE VIEW</span>
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </Button>
                                        </Link>

                                        <Link
                                            href={activeScenario.hospitalId ? `/hospital/emergency-board?hospitalId=${activeScenario.hospitalId}` : "/hospital/emergency-board"}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Button
                                                size="sm"
                                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-xs gap-1.5"
                                            >
                                                <span>OPEN HOSPITAL VIEW</span>
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </Button>
                                        </Link>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Optional Stepper Advance for Judge Convenience */}
                                        {!activeScenario.isCompleted && !activeScenario.isDiversion && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={handleAdvanceStage}
                                                disabled={isAdvancing}
                                                className="h-9 text-xs font-semibold gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                                            >
                                                {isAdvancing ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <FastForward className="w-3.5 h-3.5 text-emerald-600" />
                                                )}
                                                <span>Advance Next Stage</span>
                                            </Button>
                                        )}

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleResetDemo}
                                            disabled={isResetting}
                                            className="h-9 text-xs text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                        >
                                            <RotateCcw className={cn("w-3.5 h-3.5 mr-1.5", isResetting && "animate-spin")} />
                                            Reset Demo
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* 4. SIX CLEAN SCENARIO CARDS */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Predefined Emergency Scenarios
                        </h2>
                        {activeScenario && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                Demo scenario already active. Reset demo to switch scenarios.
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {SCENARIOS.map((sc) => {
                            const isCurrent = activeScenario?.scenario === sc.id;
                            const isLaunchingThis = startingScenario === sc.id;

                            return (
                                <Card
                                    key={sc.id}
                                    className={cn(
                                        "bg-white dark:bg-slate-900 border transition-all duration-200 flex flex-col justify-between shadow-xs hover:shadow-md",
                                        isCurrent
                                            ? "border-emerald-500 ring-2 ring-emerald-500/20"
                                            : "border-slate-200 dark:border-slate-800"
                                    )}
                                >
                                    <CardContent className="p-5 space-y-4 flex flex-col justify-between flex-1">
                                        <div className="space-y-3">
                                            {/* Header */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                                                        {sc.icon}
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                                                            {sc.label}
                                                        </h3>
                                                        <span className="text-[11px] font-mono text-slate-400">
                                                            {sc.id}
                                                        </span>
                                                    </div>
                                                </div>

                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "text-[10px] font-semibold tracking-wide shrink-0",
                                                        sc.category === "OPERATIONAL" && "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20",
                                                        sc.category === "NEGATIVE_PATH" && "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-300 bg-rose-50/50 dark:bg-rose-950/20",
                                                        sc.category === "TELEMETRY" && "border-sky-300 text-sky-700 dark:border-sky-800 dark:text-sky-300 bg-sky-50/50 dark:bg-sky-950/20"
                                                    )}
                                                >
                                                    {sc.badgeText}
                                                </Badge>
                                            </div>

                                            {/* Description */}
                                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed min-h-[36px]">
                                                {sc.description}
                                            </p>

                                            {/* Expected Behavior Line */}
                                            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-md border border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                                <span className="font-semibold text-slate-700 dark:text-slate-300">Expected: </span>
                                                {sc.expectedBehavior}
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <div className="pt-2">
                                            {isCurrent ? (
                                                <Button
                                                    size="sm"
                                                    disabled
                                                    className="w-full bg-emerald-600 text-white font-semibold text-xs h-9 cursor-default"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                                                    SCENARIO ACTIVE
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleStartScenario(sc.id)}
                                                    disabled={startingScenario !== null || activeScenario !== null}
                                                    className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 font-semibold text-xs h-9 shadow-xs"
                                                >
                                                    {isLaunchingThis ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                                            Starting Scenario...
                                                        </>
                                                    ) : (
                                                        "START SCENARIO"
                                                    )}
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </main>
        </div>
    );
}
