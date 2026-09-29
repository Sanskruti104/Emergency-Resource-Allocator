"use client"

import React from "react"
import Link from "next/link"
import { Activity, ShieldCheck, Zap, Lock, ArrowLeft, CheckCircle2 } from "lucide-react"

interface AuthShellProps {
    children: React.ReactNode
    mode: "signup" | "login"
}

export function AuthShell({ children, mode }: AuthShellProps) {
    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50 text-slate-900 antialiased selection:bg-teal-500 selection:text-white">
            {/* ========================================================================= */}
            {/* LEFT COLUMN: BRANDED HEALTHCARE PANEL (Desktop & Tablet)                  */}
            {/* ========================================================================= */}
            <aside className="hidden lg:flex lg:w-[46%] xl:w-[44%] 2xl:w-[42%] bg-slate-950 text-white flex-col justify-between p-8 xl:p-12 2xl:p-16 relative overflow-hidden border-r border-slate-800">
                {/* Subtle clinical background pattern & radial glow */}
                <div 
                    className="absolute inset-0 opacity-15 pointer-events-none"
                    style={{
                        backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)`,
                        backgroundSize: "28px 28px",
                    }}
                />
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

                {/* Top: Brand Header */}
                <div className="relative z-10">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 rounded-lg"
                        aria-label="MedDecision Home"
                    >
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform duration-200">
                            <Activity className="h-5 w-5 text-white" aria-hidden="true" />
                        </div>
                        <div>
                            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                                MedDecision
                                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                                    Healthcare
                                </span>
                            </span>
                        </div>
                    </Link>

                    {/* Mission Headline */}
                    <div className="mt-12 xl:mt-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-teal-400 text-xs font-medium mb-4">
                            <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                            Clinical Decision Support & Emergency Allocation
                        </div>
                        <h1 className="text-3xl xl:text-4xl 2xl:text-5xl font-bold tracking-tight text-white text-balance leading-tight">
                            Healthcare decisions, connected in real time.
                        </h1>
                        <p className="mt-4 text-base xl:text-lg text-slate-300 text-pretty leading-relaxed">
                            MedDecision bridges acute patient needs with hospital capacity, verified clinical pathways, and transparent care options in critical moments.
                        </p>
                    </div>
                </div>

                {/* Center: Core Value Props */}
                <div className="relative z-10 my-8 xl:my-10 space-y-4">
                    <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                        <div className="h-9 w-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center shrink-0 mt-0.5 text-teal-400">
                            <Zap className="h-4 w-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Intelligent Hospital & Resource Matching</h2>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                Evaluates live hospital ICU, surgical, and bed availability against specific patient conditions.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                        <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0 mt-0.5 text-blue-400">
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Clinical Guidance & Transparent Costs</h2>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                Actionable suitability scoring, insurance compatibility, and treatment package clarity.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
                        <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5 text-emerald-400">
                            <Lock className="h-4 w-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-white">Clinical Security Architecture</h2>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                Scrypt-derived credentials, signed application sessions, and encrypted health record routing.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom: Network Telemetry Badge */}
                <div className="relative z-10 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-teal-400" />
                        <span>Verified Regional Care Network</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">v5.0-SECURE</span>
                </div>
            </aside>

            {/* ========================================================================= */}
            {/* RIGHT COLUMN: FOCUSED AUTH FORM CARD                                      */}
            {/* ========================================================================= */}
            <main className="flex-1 flex flex-col justify-between p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12 overflow-y-auto">
                {/* Mobile / Tablet Header (Visible only when left aside is hidden or for quick navigation) */}
                <div className="w-full max-w-lg mx-auto flex items-center justify-between mb-4 sm:mb-6">
                    <Link
                        href={mode === "signup" ? "/signup-selection" : "/login"}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors py-1.5 px-2.5 rounded-md hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        aria-label="Back to selection"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        <span>Back</span>
                    </Link>

                    {/* Mobile Brand Link */}
                    <div className="lg:hidden flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-teal-400 to-blue-600 flex items-center justify-center shadow-sm">
                            <Activity className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                        </div>
                        <span className="text-sm font-bold tracking-tight text-slate-900">
                            MedDecision
                        </span>
                    </div>

                    <div className="text-xs text-slate-500">
                        {mode === "signup" ? (
                            <span>
                                Have an account?{" "}
                                <Link
                                    href="/login/patient"
                                    className="font-semibold text-teal-600 hover:text-teal-700 hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                                >
                                    Sign in
                                </Link>
                            </span>
                        ) : (
                            <span>
                                New here?{" "}
                                <Link
                                    href="/signup/patient"
                                    className="font-semibold text-teal-600 hover:text-teal-700 hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                                >
                                    Sign up
                                </Link>
                            </span>
                        )}
                    </div>
                </div>

                {/* Form Body Container */}
                <div className="w-full max-w-lg mx-auto my-auto py-2 sm:py-4">
                    {children}
                </div>

                {/* Footer Clinical Disclaimer */}
                <footer className="w-full max-w-lg mx-auto pt-6 pb-2 text-center text-xs text-slate-400 leading-relaxed border-t border-slate-200/60 mt-6">
                    <p>
                        MedDecision is a healthcare decision-support and emergency allocation technology.
                        It does not replace professional medical diagnosis, doctor consultation, or emergency dispatch services.
                    </p>
                </footer>
            </main>
        </div>
    )
}
