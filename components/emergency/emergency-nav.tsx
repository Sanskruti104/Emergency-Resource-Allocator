import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Activity,
    AlertTriangle,
    Ambulance,
    Building2,
    Hospital,
    User,
    ArrowRight,
    RefreshCw,
    LayoutDashboard,
    Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type RoleType = "patient" | "ambulance" | "hospital";

interface EmergencyNavProps {
    role: RoleType;
    isRefreshing?: boolean;
    onRefresh?: () => void;
    liveIndicatorText?: string;
    extraActions?: React.ReactNode;
}

export function EmergencyNav({
    role,
    isRefreshing = false,
    onRefresh,
    liveIndicatorText = "ATLAS LIVE",
    extraActions
}: EmergencyNavProps) {
    const pathname = usePathname();

    const roleConfig = {
        patient: {
            title: "Emergency Assistance",
            icon: <AlertTriangle className="w-4 h-4 text-white" />,
            badgeBg: "bg-red-600 shadow-red-600/20",
            links: [
                { href: "/dashboards", label: "Hub" },
                { href: "/dashboards/patient", label: "Care Status" },
                { href: "/profile", label: "Profile" }
            ]
        },
        ambulance: {
            title: "Ambulance Dispatch Console",
            icon: <Ambulance className="w-4 h-4 text-white" />,
            badgeBg: "bg-amber-600 shadow-amber-600/20",
            links: [
                { href: "/dashboards", label: "Hub" },
                { href: "/dashboards/ambulance", label: "Active Emergency" },
                { href: "/ambulance#hospitals", label: "Hospital Options" }
            ]
        },
        hospital: {
            title: "Hospital Operations",
            icon: <Hospital className="w-4 h-4 text-white" />,
            badgeBg: "bg-blue-600 shadow-blue-600/20",
            links: [
                { href: "/dashboards", label: "Hub" },
                { href: "/dashboards/hospital", label: "ED Board" },
                { href: "/hospital/capacity", label: "Capacity" }
            ]
        }
    }[role];

    return (
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4">
                {/* Brand + Context */}
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <Link href="/dashboards" className="flex items-center gap-2 group">
                        <div
                            className={cn(
                                "h-8 w-8 rounded-lg flex items-center justify-center shadow-xs transition-transform group-hover:scale-105",
                                roleConfig.badgeBg
                            )}
                        >
                            {roleConfig.icon}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                MedDecision
                                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 hidden lg:inline">
                                    • {roleConfig.title}
                                </span>
                            </span>
                        </div>
                    </Link>

                    {/* Operational Indicator */}
                    <span className="hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {liveIndicatorText}
                    </span>
                </div>

                {/* PERSISTENT 3-DASHBOARD SWITCHER (Canonical UI) */}
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200/80 dark:border-slate-700/60 shadow-xs">
                    <Link
                        href="/dashboards/patient"
                        id="nav-switcher-patient"
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all",
                            role === "patient"
                                ? "bg-red-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50"
                        )}
                        title="Open Patient Emergency Dashboard"
                    >
                        <AlertTriangle className={cn("w-3.5 h-3.5", role === "patient" ? "text-white" : "text-red-500")} />
                        <span className="hidden sm:inline">Patient</span>
                    </Link>

                    <Link
                        href="/dashboards/ambulance"
                        id="nav-switcher-ambulance"
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all",
                            role === "ambulance"
                                ? "bg-amber-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50"
                        )}
                        title="Open Ambulance Dispatch Console"
                    >
                        <Ambulance className={cn("w-3.5 h-3.5", role === "ambulance" ? "text-white" : "text-amber-500")} />
                        <span className="hidden sm:inline">Ambulance</span>
                    </Link>

                    <Link
                        href="/dashboards/hospital"
                        id="nav-switcher-hospital"
                        className={cn(
                            "flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all",
                            role === "hospital"
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-700/50"
                        )}
                        title="Open Hospital Emergency Operations Dashboard"
                    >
                        <Hospital className={cn("w-3.5 h-3.5", role === "hospital" ? "text-white" : "text-blue-500")} />
                        <span className="hidden sm:inline">Hospital</span>
                    </Link>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <Link
                        href="/dashboards"
                        id="nav-btn-hub"
                        className={cn(
                            "px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors border flex items-center gap-1",
                            pathname === "/dashboards"
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-semibold"
                                : "text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                        title="Return to 3-Dashboard UI Hub"
                    >
                        <LayoutDashboard className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Hub</span>
                    </Link>

                    <Link
                        href="/demo"
                        id="nav-btn-demo"
                        className={cn(
                            "px-2 sm:px-2.5 py-1 rounded-md text-xs font-semibold transition-colors border flex items-center gap-1",
                            pathname === "/demo"
                                ? "bg-purple-600 text-white border-purple-600"
                                : "text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/80 bg-purple-50/50 dark:bg-purple-950/30 hover:bg-purple-100"
                        )}
                        title="Open Scenario Launcher"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Demo</span>
                    </Link>

                    {extraActions}

                    {onRefresh && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            className="h-8 px-2 sm:px-2.5 text-xs text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                            title="Refresh Operational State"
                        >
                            <RefreshCw
                                className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-blue-600")}
                            />
                            <span className="hidden lg:inline ml-1.5">Sync</span>
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
