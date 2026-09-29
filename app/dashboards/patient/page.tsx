"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, User, Activity, AlertTriangle, ClipboardList, LogOut, ChevronRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PatientProfileFlow } from "@/components/patient-profile/patient-profile-flow";

interface SessionUser {
    uid: string;
    email: string;
    role: string;
    fullName?: string;
}

type ActiveView = "overview" | "profile" | "emergency";

export default function PatientDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<SessionUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);
    const [activeView, setActiveView] = useState<ActiveView>("overview");
    const [isSigningOut, setIsSigningOut] = useState(false);

    // Verify session on mount
    useEffect(() => {
        async function verifySession() {
            try {
                const res = await fetch("/api/auth/session");
                if (!res.ok) {
                    router.replace("/login/patient?from=/dashboards/patient");
                    return;
                }
                const data = await res.json();
                if (!data.authenticated || data.user?.role !== "patient") {
                    router.replace("/login/patient?from=/dashboards/patient");
                    return;
                }
                setUser(data.user);
            } catch {
                setAuthError("Unable to verify session. Please sign in again.");
            } finally {
                setIsLoading(false);
            }
        }
        verifySession();
    }, [router]);

    const handleSignOut = async () => {
        setIsSigningOut(true);
        try {
            await fetch("/api/auth/session", { method: "DELETE" });
        } finally {
            router.replace("/login/patient");
        }
    };

    // ── Loading State ──
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-3 text-slate-500">
                    <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                    <span className="text-sm">Verifying session…</span>
                </div>
            </div>
        );
    }

    // ── Auth Error State ──
    if (authError || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
                <Card className="w-full max-w-sm text-center p-8 shadow-lg">
                    <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-3" />
                    <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
                        {authError || "Session expired. Please sign in again."}
                    </p>
                    <Button asChild className="w-full">
                        <Link href="/login/patient">Sign In</Link>
                    </Button>
                </Card>
            </div>
        );
    }

    // ── Patient Profile View ──
    if (activeView === "profile") {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                <DashboardNav user={user} activeView={activeView} setActiveView={setActiveView} onSignOut={handleSignOut} isSigningOut={isSigningOut} />
                <PatientProfileFlow />
            </div>
        );
    }

    // ── Emergency Assistance View ──
    if (activeView === "emergency") {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
                <DashboardNav user={user} activeView={activeView} setActiveView={setActiveView} onSignOut={handleSignOut} isSigningOut={isSigningOut} />
                <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <ShieldAlert className="h-5 w-5 text-red-600" />
                            Emergency Assistance
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Request immediate emergency dispatch and track your ambulance in real time.
                        </p>
                    </div>
                    <Card className="border-red-200 dark:border-red-900/60 shadow-sm">
                        <CardContent className="p-6">
                            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                                Use the full emergency dispatch and tracking system:
                            </p>
                            <Button asChild className="bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md w-full sm:w-auto">
                                <Link href="/emergency">
                                    <ShieldAlert className="h-4 w-4 mr-2" />
                                    Open Emergency Dashboard
                                    <ChevronRight className="h-4 w-4 ml-2" />
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    // ── Overview (default) ──
    const displayName = user.fullName || user.email.split("@")[0] || "Patient";

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            <DashboardNav user={user} activeView={activeView} setActiveView={setActiveView} onSignOut={handleSignOut} isSigningOut={isSigningOut} />

            <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
                {/* Welcome Header */}
                <section className="rounded-2xl bg-gradient-to-br from-teal-600 to-blue-700 p-6 sm:p-8 text-white shadow-lg">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-teal-100 text-sm font-medium mb-1">Welcome back</p>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                                {displayName}
                            </h1>
                            <p className="text-teal-200 text-xs mt-1.5 font-mono">{user.email}</p>
                        </div>
                        <div className="h-14 w-14 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                            <User className="h-7 w-7 text-white" aria-hidden="true" />
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-xs font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-300 animate-pulse" />
                            Patient Account
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-xs font-medium">
                            <Activity className="h-3 w-3" />
                            MedDecision v5.0
                        </span>
                    </div>
                </section>

                {/* Quick Actions */}
                <section>
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick Actions</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Emergency Card */}
                        <button
                            type="button"
                            onClick={() => setActiveView("emergency")}
                            className="group p-5 rounded-2xl border-2 border-red-200 dark:border-red-900/60 bg-white dark:bg-slate-900 hover:border-red-400 dark:hover:border-red-700 hover:shadow-md transition-all text-left"
                        >
                            <div className="flex items-start justify-between">
                                <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center">
                                    <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-red-500 transition-colors mt-1" />
                            </div>
                            <div className="mt-3">
                                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Emergency Assistance</h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Request ambulance dispatch with live tracking and hospital matching.
                                </p>
                            </div>
                        </button>

                        {/* Profile Card */}
                        <button
                            type="button"
                            onClick={() => setActiveView("profile")}
                            className="group p-5 rounded-2xl border-2 border-teal-200 dark:border-teal-900/60 bg-white dark:bg-slate-900 hover:border-teal-400 dark:hover:border-teal-700 hover:shadow-md transition-all text-left"
                        >
                            <div className="flex items-start justify-between">
                                <div className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center">
                                    <ClipboardList className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                                </div>
                                <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-teal-500 transition-colors mt-1" />
                            </div>
                            <div className="mt-3">
                                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Patient Profile</h3>
                                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                    Update your health context, insurance, and treatment preferences.
                                </p>
                            </div>
                        </button>
                    </div>
                </section>

                {/* Account Info */}
                <section>
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Account</h2>
                    <Card className="shadow-sm">
                        <CardContent className="divide-y divide-slate-100 dark:divide-slate-800 p-0">
                            <div className="flex items-center justify-between px-5 py-3.5">
                                <span className="text-xs font-medium text-slate-500">Name</span>
                                <span className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</span>
                            </div>
                            <div className="flex items-center justify-between px-5 py-3.5">
                                <span className="text-xs font-medium text-slate-500">Email</span>
                                <span className="text-sm text-slate-700 dark:text-slate-300 font-mono">{user.email}</span>
                            </div>
                            <div className="flex items-center justify-between px-5 py-3.5">
                                <span className="text-xs font-medium text-slate-500">Role</span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 text-xs font-semibold capitalize">
                                    {user.role}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </section>
            </main>
        </div>
    );
}

// ── Internal Nav Component ──────────────────────────────────────────────────

interface DashboardNavProps {
    user: SessionUser;
    activeView: ActiveView;
    setActiveView: (v: ActiveView) => void;
    onSignOut: () => void;
    isSigningOut: boolean;
}

function DashboardNav({ user, activeView, setActiveView, onSignOut, isSigningOut }: DashboardNavProps) {
    return (
        <nav className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
                {/* Brand */}
                <Link href="/" className="flex items-center gap-2 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded-lg">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center shadow-sm">
                        <Activity className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                    </div>
                    <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-white hidden sm:block">
                        MedDecision
                    </span>
                </Link>

                {/* Nav Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {(["overview", "emergency", "profile"] as ActiveView[]).map((view) => (
                        <button
                            key={view}
                            type="button"
                            onClick={() => setActiveView(view)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                                activeView === view
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                        >
                            {view}
                        </button>
                    ))}
                </div>

                {/* Sign Out */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onSignOut}
                    disabled={isSigningOut}
                    className="text-xs text-slate-500 hover:text-slate-900 shrink-0"
                    aria-label="Sign out"
                >
                    {isSigningOut ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <LogOut className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline ml-1.5">Sign out</span>
                </Button>
            </div>
        </nav>
    );
}
