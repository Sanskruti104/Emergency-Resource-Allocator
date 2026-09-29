"use client";

import { CheckCircle2, Circle, AlertCircle, Clock, ShieldCheck, Ambulance, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface TimelineState {
    hasEmergency: boolean;
    hasAllocation: boolean;
    hasSelectedHospital: boolean;
    reservationStatus?: "PENDING" | "CONFIRMED" | "ADMITTED" | "DISCHARGED" | "RELEASED" | "EXPIRED" | "REJECTED";
    ambulanceStatus?: "IDLE" | "ASSIGNED" | "DISPATCHED" | "EN_ROUTE" | "ARRIVED" | "HANDOFF" | "AVAILABLE";
    priority?: string;
    emergencyId?: string;
}

interface StepDefinition {
    id: number;
    title: string;
    description: string;
}

const STEPS: StepDefinition[] = [
    { id: 1, title: "Intake", description: "Emergency created & logged" },
    { id: 2, title: "Triage", description: "Clinical acuity & needs assessed" },
    { id: 3, title: "Ranked", description: "Candidate facilities scored" },
    { id: 4, title: "Selected", description: "Target facility designated" },
    { id: 5, title: "Reserved", description: "Resource locked in MongoDB" },
    { id: 6, title: "Dispatched", description: "EMS unit deployed" },
    { id: 7, title: "En Route", description: "Live GPS transit" },
    { id: 8, title: "Arrived", description: "On-scene at facility" },
    { id: 9, title: "Handoff", description: "Clinical verification" },
    { id: 10, title: "Admitted", description: "Capacity occupied" }
];

export function EmergencyTimeline({ state }: { state: TimelineState }) {
    // Determine active step index (1-based)
    let currentStep = 1;

    if (!state.hasEmergency) {
        currentStep = 0; // Not started
    } else if (state.reservationStatus === "ADMITTED" || state.reservationStatus === "DISCHARGED") {
        currentStep = 10;
    } else if (state.ambulanceStatus === "HANDOFF") {
        currentStep = 9;
    } else if (state.ambulanceStatus === "ARRIVED") {
        currentStep = 8;
    } else if (state.ambulanceStatus === "EN_ROUTE") {
        currentStep = 7;
    } else if (state.ambulanceStatus === "DISPATCHED" || state.ambulanceStatus === "ASSIGNED") {
        currentStep = 6;
    } else if (state.reservationStatus === "CONFIRMED" || state.reservationStatus === "PENDING") {
        currentStep = 5;
    } else if (state.hasSelectedHospital) {
        currentStep = 4;
    } else if (state.hasAllocation) {
        currentStep = 3;
    } else {
        currentStep = 2;
    }

    return (
        <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
                        ⚡
                    </div>
                    <div>
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            Emergency Resource Lifecycle Timeline
                        </h3>
                        <p className="text-xs text-slate-500">
                            Operational sequence verified through atomic MongoDB state transitions
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    {state.emergencyId && (
                        <Badge variant="outline" className="text-xs font-mono bg-slate-50 dark:bg-slate-800">
                            ID: {state.emergencyId.slice(-8)}
                        </Badge>
                    )}
                    {state.priority && (
                        <Badge
                            className={`text-xs ${
                                state.priority.includes("P1")
                                    ? "bg-red-600 text-white"
                                    : state.priority.includes("P2")
                                    ? "bg-amber-600 text-white"
                                    : "bg-blue-600 text-white"
                            }`}
                        >
                            {state.priority}
                        </Badge>
                    )}
                    {state.reservationStatus && (
                        <Badge
                            variant="secondary"
                            className={`text-xs ${
                                state.reservationStatus === "ADMITTED"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold"
                                    : state.reservationStatus === "CONFIRMED"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                        >
                            {state.reservationStatus}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Stepper Grid / Horizontal Scroll */}
            <div className="overflow-x-auto pb-2">
                <div className="flex items-center justify-between min-w-[720px] relative">
                    {/* Connecting background bar */}
                    <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-800 -z-0" />

                    {STEPS.map((step) => {
                        const isCompleted = currentStep > step.id;
                        const isCurrent = currentStep === step.id;
                        const isPending = currentStep < step.id;

                        return (
                            <div key={step.id} className="relative z-10 flex flex-col items-center group cursor-default">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                                        isCompleted
                                            ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                                            : isCurrent
                                            ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-950 shadow-md shadow-blue-600/30 scale-110"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700"
                                    }`}
                                >
                                    {isCompleted ? (
                                        <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                        <span>{step.id}</span>
                                    )}
                                </div>
                                <span
                                    className={`text-[11px] mt-2 font-medium text-center whitespace-nowrap ${
                                        isCurrent
                                            ? "text-blue-600 dark:text-blue-400 font-bold"
                                            : isCompleted
                                            ? "text-slate-800 dark:text-slate-200"
                                            : "text-slate-400"
                                    }`}
                                >
                                    {step.title}
                                </span>
                                <span className="text-[10px] text-slate-400 text-center max-w-[70px] truncate hidden sm:block">
                                    {step.description}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
