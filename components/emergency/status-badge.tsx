import React from "react";
import { cn } from "@/lib/utils";
import {
    Clock,
    CheckCircle2,
    Navigation,
    Hospital,
    UserCheck,
    XCircle,
    AlertOctagon,
    Activity,
    ShieldAlert,
    Radio
} from "lucide-react";

export type StatusType =
    | "PENDING"
    | "CONFIRMED"
    | "EN_ROUTE"
    | "EN ROUTE"
    | "TRANSPORTING"
    | "ARRIVED"
    | "AT_HOSPITAL"
    | "HANDOFF"
    | "IN_PROGRESS"
    | "ADMITTED"
    | "COMPLETED"
    | "REJECTED"
    | "UNAVAILABLE"
    | "FRESH"
    | "AGING"
    | "STALE"
    | "RED"
    | "YELLOW"
    | "GREEN"
    | "AVAILABLE"
    | "MATCHED"
    | string;

interface StatusBadgeProps {
    status: StatusType;
    label?: string;
    size?: "sm" | "md" | "lg";
    showIcon?: boolean;
    className?: string;
}

export function StatusBadge({
    status,
    label,
    size = "md",
    showIcon = true,
    className
}: StatusBadgeProps) {
    const raw = (status || "").toUpperCase().trim();
    const displayLabel = label || raw.replace(/_/g, " ");

    let colorStyles = "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    let icon = <Activity className="w-3 h-3" />;

    // Amber / Pending / Warning
    if (
        raw === "PENDING" ||
        raw === "REQUESTED" ||
        raw === "ASSIGNING" ||
        raw === "WAITING" ||
        raw === "AGING" ||
        raw === "YELLOW"
    ) {
        colorStyles = "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60";
        icon = <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />;
    }
    // Green / Confirmed / Available / Admitted / Fresh
    else if (
        raw === "CONFIRMED" ||
        raw === "ACCEPTED" ||
        raw === "ADMITTED" ||
        raw === "COMPLETED" ||
        raw === "AVAILABLE" ||
        raw === "FRESH" ||
        raw === "MATCHED" ||
        raw === "SUITABLE" ||
        raw === "GREEN"
    ) {
        colorStyles = "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60";
        icon = <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />;
    }
    // Blue / Active / En Route / Transporting / In Progress / Handoff
    else if (
        raw === "EN_ROUTE" ||
        raw === "EN ROUTE" ||
        raw === "TRANSPORTING" ||
        raw === "IN_PROGRESS" ||
        raw === "HANDOFF" ||
        raw === "HANDOFF_IN_PROGRESS" ||
        raw === "ACTIVE"
    ) {
        colorStyles = "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60";
        icon = <Navigation className="w-3 h-3 text-sky-600 dark:text-sky-400" />;
    }
    // Cyan / Indigo / Arrived
    else if (raw === "ARRIVED" || raw === "AT_HOSPITAL") {
        colorStyles = "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60";
        icon = <Hospital className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />;
    }
    // Red / Critical / Rejected / Unavailable / Stale
    else if (
        raw === "REJECTED" ||
        raw === "DECLINED" ||
        raw === "UNAVAILABLE" ||
        raw === "UNSUITABLE" ||
        raw === "EXPIRED" ||
        raw === "RED" ||
        raw === "CRITICAL"
    ) {
        colorStyles = "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60";
        icon = <AlertOctagon className="w-3 h-3 text-rose-600 dark:text-rose-400" />;
    } else if (raw === "STALE") {
        colorStyles = "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60";
        icon = <Clock className="w-3 h-3 text-orange-600 dark:text-orange-400" />;
    }

    const sizeStyles = {
        sm: "text-[11px] px-2 py-0.5 gap-1",
        md: "text-xs px-2.5 py-1 gap-1.5",
        lg: "text-sm px-3.5 py-1.5 gap-2"
    }[size];

    return (
        <span
            className={cn(
                "inline-flex items-center font-medium rounded-full border tracking-wide transition-colors",
                sizeStyles,
                colorStyles,
                className
            )}
        >
            {showIcon && icon}
            <span>{displayLabel}</span>
        </span>
    );
}
