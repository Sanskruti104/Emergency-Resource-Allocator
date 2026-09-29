import React from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/emergency/status-badge";
import { AlertCircle, AlertTriangle, HeartPulse, ShieldAlert, Activity } from "lucide-react";

interface EmergencyHeaderProps {
    emergencyId?: string;
    emergencyType?: string;
    priority?: string;
    status: string;
    statusLabel?: string;
    patientName?: string;
    chiefComplaint?: string;
    className?: string;
    compact?: boolean;
}

export function EmergencyHeader({
    emergencyId,
    emergencyType = "MEDICAL EMERGENCY",
    priority = "RED",
    status,
    statusLabel,
    patientName,
    chiefComplaint,
    className,
    compact = false
}: EmergencyHeaderProps) {
    const isRed = priority?.toUpperCase() === "RED";
    const cleanType = (emergencyType || "GENERAL").replace(/_/g, " ").toUpperCase();

    // Map clean icon based on type
    let TypeIcon = Activity;
    if (cleanType.includes("CARDIAC") || cleanType.includes("HEART")) TypeIcon = HeartPulse;
    else if (cleanType.includes("TRAUMA")) TypeIcon = ShieldAlert;
    else if (cleanType.includes("STROKE")) TypeIcon = Activity;

    return (
        <div
            className={cn(
                "rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden",
                className
            )}
        >
            {/* Top Bar: Operational Status & Priority Strip */}
            <div className="bg-slate-50/80 dark:bg-slate-800/50 px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
                    </span>
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-600 dark:text-slate-300">
                        Active Emergency Case
                    </span>
                    {emergencyId && (
                        <span className="text-[11px] font-mono text-slate-400">
                            #{emergencyId.slice(-6).toUpperCase()}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border",
                            isRed
                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60"
                                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60"
                        )}
                    >
                        Priority {priority || "RED"}
                    </span>
                    <StatusBadge status={status} label={statusLabel} size="sm" />
                </div>
            </div>

            {/* Main Content Info */}
            <div className={cn("p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3", compact && "py-3")}>
                <div className="flex items-start sm:items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                        <TypeIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                            {cleanType}
                            {patientName && (
                                <span className="font-normal text-slate-500 ml-2 text-xs">
                                    • {patientName}
                                </span>
                            )}
                        </h2>
                        {chiefComplaint && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl line-clamp-1">
                                {chiefComplaint}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
