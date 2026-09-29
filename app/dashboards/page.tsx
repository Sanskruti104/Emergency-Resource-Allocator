"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
    Activity,
    AlertTriangle,
    Ambulance,
    Building2,
    Hospital,
    ArrowRight,
    Sparkles,
    ShieldCheck,
    CheckCircle2,
    Clock,
    Database,
    HeartPulse,
    Radio,
    ChevronRight,
    Stethoscope,
    Users,
    BedDouble,
    RefreshCw,
    Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function DashboardsHubPage() {
    const [isResetting, setIsResetting] = useState(false);
    const [resetDone, setResetDone] = useState(false);

    const runReset = useCallback(async (showToast = false) => {
        setIsResetting(true);
        try {
            const res = await fetch("/api/demo/reset", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                setResetDone(true);
                if (showToast) toast.success("Demo reset — all dashboards start fresh.");
            } else {
                if (showToast) toast.error("Reset failed. Check server logs.");
            }
        } catch {
            if (showToast) toast.error("Could not reach reset endpoint.");
        } finally {
            setIsResetting(false);
        }
    }, []);

    // Auto-reset silently on every page load so each demo starts clean
    useEffect(() => { runReset(false); }, [runReset]);

    return (
        <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-2.5 group">
                            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                                    MEDDECISION
                                    <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 hidden sm:inline">
                                        • Healthcare Operations Platform
                                    </span>
                                </span>
                            </div>
                        </Link>

                        <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 ml-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            MONGODB ATLAS LIVE
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Manual reset button — one-click fresh start during live demo */}
                        <button
                            type="button"
                            id="btn-reset-demo"
                            onClick={() => runReset(true)}
                            disabled={isResetting}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all border",
                                isResetting
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed"
                                    : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                            )}
                        >
                            {isResetting
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <RefreshCw className="w-3.5 h-3.5" />}
                            <span>{isResetting ? "Resetting…" : "Reset & Start Fresh"}</span>
                        </button>
                        <Link
                            href="/demo"
                            className="px-3 py-1.5 rounded-md text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-xs transition-colors"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Demo Launcher</span>
                        </Link>
                        <Link
                            href="/"
                            className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            Home
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Hub Content */}
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-10">
                {/* Hero Header */}
                <div className="text-center max-w-3xl mx-auto space-y-3">
                    <Badge variant="outline" className="px-3 py-1 text-xs font-semibold border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/30">
                        Operational Dashboard Suite
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                        MEDDECISION
                    </h1>
                    <p className="text-lg sm:text-xl font-medium text-slate-600 dark:text-slate-300">
                        Emergency Healthcare Coordination Platform
                    </p>
                    <div className="pt-2 flex flex-col items-center gap-2">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <span>Choose Dashboard</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 font-normal">Select an operational role below to enter</span>
                        </div>
                        {/* Demo reset status indicator */}
                        <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all",
                            isResetting
                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                                : resetDone
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                        )}>
                            {isResetting
                                ? <><Loader2 className="w-3 h-3 animate-spin" /> Clearing demo data…</>
                                : resetDone
                                ? <><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> DEMO READY — All dashboards start clean</>  
                                : <><span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Initializing…</>}
                        </div>
                    </div>
                </div>

                {/* 3 Large Prominent Dashboard Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
                    {/* 1. PATIENT DASHBOARD */}
                    <Card className="group relative border-2 border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-red-600 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden rounded-2xl">
                        <div className="h-2 w-full bg-gradient-to-r from-red-500 to-rose-600" />
                        <CardContent className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="h-12 w-12 rounded-xl bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                                        <AlertTriangle className="w-6 h-6" />
                                    </div>
                                    <Badge className="bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800 font-semibold text-[11px]">
                                        Role 01
                                    </Badge>
                                </div>

                                <div className="space-y-1.5">
                                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                                        PATIENT DASHBOARD
                                    </h2>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        Patient healthcare and emergency access
                                    </p>
                                </div>

                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Explore hospitals, emergency services, hospital information and patient features.
                                </p>

                                {/* Feature checklist */}
                                <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Live 7-step emergency care timeline</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Hospital discovery, specialties & treatments</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Clinical doctor coverage & patient profile</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Direct emergency intake & paramedic tracking</span>
                                    </li>
                                </ul>
                            </div>

                            <Button
                                asChild
                                id="btn-open-patient-dashboard"
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 h-11 rounded-xl shadow-xs text-sm group-hover:shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                <Link href="/dashboards/patient">
                                    <span>Open Patient Dashboard</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* 2. AMBULANCE DASHBOARD */}
                    <Card className="group relative border-2 border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden rounded-2xl">
                        <div className="h-2 w-full bg-gradient-to-r from-amber-500 to-orange-500" />
                        <CardContent className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="h-12 w-12 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                                        <Ambulance className="w-6 h-6" />
                                    </div>
                                    <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-semibold text-[11px]">
                                        Role 02
                                    </Badge>
                                </div>

                                <div className="space-y-1.5">
                                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                                        AMBULANCE DASHBOARD
                                    </h2>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        Emergency response and hospital allocation
                                    </p>
                                </div>

                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Emergency allocation, ambulance dispatch, hospital selection, reservation and transport.
                                </p>

                                {/* Feature checklist */}
                                <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Multi-criteria allocator (nearest vs suitable)</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>7-metric live capacity & Kaggle benchmarks</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Two-way bed reservation & transport telemetry</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Provider badge: Hospital vs Government Unit</span>
                                    </li>
                                </ul>
                            </div>

                            <Button
                                asChild
                                id="btn-open-ambulance-dashboard"
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 h-11 rounded-xl shadow-xs text-sm group-hover:shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                <Link href="/dashboards/ambulance">
                                    <span>Open Ambulance Dashboard</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>

                    {/* 3. HOSPITAL DASHBOARD */}
                    <Card className="group relative border-2 border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 bg-white dark:bg-slate-900 shadow-sm hover:shadow-lg transition-all duration-200 flex flex-col overflow-hidden rounded-2xl">
                        <div className="h-2 w-full bg-gradient-to-r from-blue-500 to-indigo-600" />
                        <CardContent className="p-6 sm:p-7 flex-1 flex flex-col justify-between space-y-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="h-12 w-12 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                                        <Hospital className="w-6 h-6" />
                                    </div>
                                    <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-semibold text-[11px]">
                                        Role 03
                                    </Badge>
                                </div>

                                <div className="space-y-1.5">
                                    <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        HOSPITAL DASHBOARD
                                    </h2>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                        Hospital capacity and emergency operations
                                    </p>
                                </div>

                                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                    Hospital capacity, emergency requests, reservations, handoff and admissions.
                                </p>

                                {/* Feature checklist */}
                                <ul className="space-y-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Emergency board intake & reservation accept/reject</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Live ICU & general bed occupancy tracking</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Clinical handoff handover & admission completion</span>
                                    </li>
                                    <li className="flex items-center gap-2">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                        <span>Specialties, equipment & operation theatres</span>
                                    </li>
                                </ul>
                            </div>

                            <Button
                                asChild
                                id="btn-open-hospital-dashboard"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 h-11 rounded-xl shadow-xs text-sm group-hover:shadow-md transition-all flex items-center justify-center gap-2"
                            >
                                <Link href="/dashboards/hospital">
                                    <span>Open Hospital Dashboard</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Bottom Operational Status Callout */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                Live Judge Demonstration Mode
                            </h3>
                            <p className="text-xs text-slate-500">
                                Launch pre-configured clinical scenarios (STEMI Cardiac, Trauma, Stroke) and watch multi-dashboard synchronization in real time.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                        <Button
                            asChild
                            variant="outline"
                            className="text-xs border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 h-9 rounded-lg w-full sm:w-auto"
                        >
                            <Link href="/demo">
                                Open Demo Launcher →
                            </Link>
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
