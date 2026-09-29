"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
    Building2,
    CheckCircle2,
    XCircle,
    Clock,
    Navigation,
    Activity,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
    Radio,
    Sparkles,
    BedDouble,
    Flame,
    Lock
} from "lucide-react";
import { CandidateEvaluation, FreshnessStatus } from "@/lib/emergency/emergency-allocator";

interface HospitalRankingCardsProps {
    results: CandidateEvaluation[];
    selectedHospitalId?: string;
    onSelectHospital: (hospitalId: string) => void;
    onReserveHospital?: (hospitalId: string, resourceType: string) => Promise<void>;
    isReserving?: boolean;
    activeReservationId?: string;
}

export function HospitalRankingCards({
    results,
    selectedHospitalId,
    onSelectHospital,
    onReserveHospital,
    isReserving = false,
    activeReservationId
}: HospitalRankingCardsProps) {
    const [whyUnsuitableOpen, setWhyUnsuitableOpen] = useState(false);

    const suitableHospitals = results.filter((r) => r.suitability);
    const unsuitableHospitals = results.filter((r) => !r.suitability);

    const getFreshnessBadge = (status: FreshnessStatus, lastUpdated: string | null) => {
        switch (status) {
            case "FRESH":
                return (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 flex items-center gap-1 text-[10px] py-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        FRESH &lt;15m
                    </Badge>
                );
            case "AGING":
                return (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 flex items-center gap-1 text-[10px] py-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        AGING 15-60m
                    </Badge>
                );
            case "STALE":
            default:
                return (
                    <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 flex items-center gap-1 text-[10px] py-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        STALE &gt;60m
                    </Badge>
                );
        }
    };

    if (!results || results.length === 0) {
        return (
            <Card className="p-8 border-dashed border-slate-200 dark:border-slate-800 text-center bg-white dark:bg-slate-900">
                <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                    <Building2 className="w-8 h-8 text-slate-400 stroke-[1.5]" />
                    <h4 className="font-semibold text-sm text-slate-700 dark:text-slate-300">No Hospital Candidates Scored Yet</h4>
                    <p className="text-xs max-w-sm">
                        Select a simulation scenario above and click &quot;Run Simulation&quot; to evaluate facility capability, travel ETA, capacity, and telemetry freshness.
                    </p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        Real-Time Hospital Matching &amp; Allocation
                    </h3>
                    <Badge variant="outline" className="text-xs">
                        {suitableHospitals.length} Suitable / {results.length} Evaluated
                    </Badge>
                </div>
                <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                    Multi-criteria deterministic scoring
                </span>
            </div>

            {/* Suitable Hospitals List */}
            {suitableHospitals.length === 0 ? (
                <Card className="p-6 border-red-200 bg-red-50/50 dark:bg-red-950/20 text-center">
                    <ShieldAlert className="w-8 h-8 text-red-600 mx-auto mb-2" />
                    <h4 className="font-semibold text-sm text-red-900 dark:text-red-200">
                        Zero Qualified Hospitals Found
                    </h4>
                    <p className="text-xs text-red-700 dark:text-red-300 max-w-md mx-auto mt-1">
                        All candidate facilities failed clinical hard constraints (missing required equipment, no ICU beds, or stale telemetry). Check the &quot;Why Unsuitable?&quot; audit below.
                    </p>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-3.5">
                    {suitableHospitals.map((hospital, idx) => {
                        const isTop = idx === 0;
                        const isSelected = hospital.hospitalId === selectedHospitalId;

                        return (
                            <Card
                                key={hospital.hospitalId}
                                className={`p-4 sm:p-5 transition-all duration-200 border relative overflow-hidden ${
                                    isSelected
                                        ? "border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-md ring-2 ring-emerald-500/20"
                                        : isTop
                                        ? "border-blue-300 dark:border-blue-900 bg-white dark:bg-slate-900 hover:border-blue-400"
                                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300"
                                }`}
                            >
                                {/* Top Rank Ribbon */}
                                {isTop && (
                                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-lg shadow-sm flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" /> #1 Top Recommendation
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                    {/* Left: Info */}
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-base text-slate-900 dark:text-slate-100">
                                                {hospital.hospitalName}
                                            </span>
                                            {getFreshnessBadge(hospital.freshnessStatus, hospital.lastUpdatedAt)}
                                            {isSelected && (
                                                <Badge className="bg-emerald-600 text-white text-[10px] py-0">
                                                    Target Selected
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                                            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                                <Navigation className="w-3.5 h-3.5 text-blue-600" />
                                                {hospital.distanceKm.toFixed(1)} km
                                            </span>
                                            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                                ETA: {hospital.estimatedTravelMinutes} min
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-mono">
                                                Telemetry: {hospital.lastUpdatedAt ? new Date(hospital.lastUpdatedAt).toLocaleTimeString() : "Live"}
                                            </span>
                                        </div>

                                        {/* Capacity Badges */}
                                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                                            <div className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1.5">
                                                <BedDouble className="w-3 h-3 text-slate-500" />
                                                <span>ICU Beds:</span>
                                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                                    {hospital.availableCapacity.availableIcuBeds} avail / {hospital.availableCapacity.icuBeds} total
                                                </span>
                                            </div>
                                            <div className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1.5">
                                                <span>General:</span>
                                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                                    {hospital.availableCapacity.availableBeds} avail / {hospital.availableCapacity.totalBeds} total
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Overall Score */}
                                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 shrink-0 pt-1 sm:pt-0">
                                        <div className="text-right">
                                            <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                                                {hospital.overallScore.toFixed(1)}
                                            </span>
                                            <span className="text-xs text-slate-400 ml-0.5">/100</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                            Suitability Index
                                        </span>
                                    </div>
                                </div>

                                {/* Score Breakdown Micro-Bars */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 my-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                                    <div>
                                        <div className="flex justify-between text-slate-500 mb-0.5">
                                            <span>Capability (40%)</span>
                                            <span className="font-mono font-semibold">{hospital.resourceMatchScore.toFixed(0)}</span>
                                        </div>
                                        <Progress value={hospital.resourceMatchScore} className="h-1 bg-slate-100 dark:bg-slate-800" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-slate-500 mb-0.5">
                                            <span>Travel / ETA (35%)</span>
                                            <span className="font-mono font-semibold">{hospital.travelScore.toFixed(0)}</span>
                                        </div>
                                        <Progress value={hospital.travelScore} className="h-1 bg-slate-100 dark:bg-slate-800" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-slate-500 mb-0.5">
                                            <span>Freshness (15%)</span>
                                            <span className="font-mono font-semibold">{hospital.freshnessScore.toFixed(0)}</span>
                                        </div>
                                        <Progress value={hospital.freshnessScore} className="h-1 bg-slate-100 dark:bg-slate-800" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-slate-500 mb-0.5">
                                            <span>Capacity (10%)</span>
                                            <span className="font-mono font-semibold">{hospital.capacityScore.toFixed(0)}</span>
                                        </div>
                                        <Progress value={hospital.capacityScore} className="h-1 bg-slate-100 dark:bg-slate-800" />
                                    </div>
                                </div>

                                {/* Matched Resources Chips & Reasons */}
                                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                            Matched:
                                        </span>
                                        {hospital.matchedResources.map((res) => (
                                            <Badge
                                                key={res}
                                                variant="outline"
                                                className="text-[10px] py-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                                            >
                                                ✓ {res}
                                            </Badge>
                                        ))}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            type="button"
                                            variant={isSelected ? "secondary" : "outline"}
                                            size="sm"
                                            onClick={() => onSelectHospital(hospital.hospitalId)}
                                            className="text-xs h-8"
                                        >
                                            {isSelected ? "Selected" : "View on Map"}
                                        </Button>

                                        {onReserveHospital && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={isReserving || !!activeReservationId}
                                                onClick={() => onReserveHospital(hospital.hospitalId, "ICU_BED")}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 font-semibold shadow-sm"
                                            >
                                                <Lock className="w-3.5 h-3.5 mr-1" />
                                                Reserve Resource
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                {/* Explainability reasons text */}
                                {hospital.reasons && hospital.reasons.length > 0 && (
                                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Audit Justification: </span>
                                        {hospital.reasons.join(" • ")}
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Collapsible "Why Unsuitable?" Section */}
            {unsuitableHospitals.length > 0 && (
                <Collapsible
                    open={whyUnsuitableOpen}
                    onOpenChange={setWhyUnsuitableOpen}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/50"
                >
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <XCircle className="w-4 h-4 text-red-500" />
                                <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                                    Why Unsuitable? ({unsuitableHospitals.length} Facilities Disqualified)
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <span>{whyUnsuitableOpen ? "Collapse" : "Review Rejection Audit"}</span>
                                {whyUnsuitableOpen ? (
                                    <ChevronUp className="w-4 h-4" />
                                ) : (
                                    <ChevronDown className="w-4 h-4" />
                                )}
                            </div>
                        </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="p-3.5 space-y-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        {unsuitableHospitals.map((hospital) => (
                            <div
                                key={hospital.hospitalId}
                                className="p-3 rounded-lg border border-red-100 dark:border-red-950/60 bg-red-50/30 dark:bg-red-950/20 text-xs space-y-1.5"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <span className="font-bold text-slate-900 dark:text-slate-100">
                                            {hospital.hospitalName}
                                        </span>
                                        <span className="text-slate-500 ml-2 font-mono">
                                            ({hospital.distanceKm.toFixed(1)} km, {hospital.estimatedTravelMinutes} min)
                                        </span>
                                    </div>
                                    <Badge variant="destructive" className="text-[9px] py-0">
                                        DISQUALIFIED
                                    </Badge>
                                </div>

                                {/* Rejection Reasons */}
                                <div className="text-[11px] text-red-700 dark:text-red-300 space-y-0.5">
                                    {hospital.reasons.map((reason, rIdx) => (
                                        <p key={rIdx} className="flex items-center gap-1">
                                            <span className="text-red-500">•</span>
                                            {reason}
                                        </p>
                                    ))}
                                </div>

                                {hospital.missingResources && hospital.missingResources.length > 0 && (
                                    <div className="flex items-center gap-1 pt-0.5">
                                        <span className="text-[10px] text-slate-500 font-semibold">Missing:</span>
                                        {hospital.missingResources.map((res) => (
                                            <Badge
                                                key={res}
                                                variant="outline"
                                                className="text-[9px] py-0 border-red-300 text-red-700 dark:text-red-300"
                                            >
                                                ✕ {res}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </CollapsibleContent>
                </Collapsible>
            )}
        </div>
    );
}
