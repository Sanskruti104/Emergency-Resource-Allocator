"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Sparkles, SlidersHorizontal, AlertCircle, HeartPulse, ShieldAlert, Brain, BedDouble, History, HelpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface ScenarioDefinition {
    id: string;
    label: string;
    description: string;
    icon: any;
    priority: "P1_CRITICAL" | "P2_EMERGENT" | "P3_URGENT";
    specialty: string;
    color: string;
}

export const SCENARIOS: ScenarioDefinition[] = [
    {
        id: "NORMAL_CARDIAC",
        label: "Normal Cardiac (STEMI)",
        description: "Acute chest pain, requires Cath Lab & ICU bed. Tests optimal matching.",
        icon: HeartPulse,
        priority: "P1_CRITICAL",
        specialty: "Cardiology",
        color: "text-red-600 bg-red-50 dark:bg-red-950/40 border-red-200"
    },
    {
        id: "TRAUMA",
        label: "Major Trauma (MVA)",
        description: "Multi-vehicle collision, GCS 8, requires Level 1 Trauma Bay & OT.",
        icon: ShieldAlert,
        priority: "P1_CRITICAL",
        specialty: "Trauma Surgery",
        color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200"
    },
    {
        id: "STROKE",
        label: "Acute Ischemic Stroke",
        description: "Sudden hemiparesis, requires urgent Neurologist & CT Scan.",
        icon: Brain,
        priority: "P1_CRITICAL",
        specialty: "Neurology",
        color: "text-purple-600 bg-purple-50 dark:bg-purple-950/40 border-purple-200"
    },
    {
        id: "ICU_SCARCITY",
        label: "ICU Scarcity / Fallback",
        description: "Primary center ICU saturated (0 beds). Engine re-routes to secondary facility.",
        icon: BedDouble,
        priority: "P1_CRITICAL",
        specialty: "Critical Care",
        color: "text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200"
    },
    {
        id: "STALE_HOSPITAL_DATA",
        label: "Stale Telemetry Data",
        description: "Demonstrates telemetry freshness scoring (FRESH vs AGING vs STALE penalization).",
        icon: History,
        priority: "P2_EMERGENT",
        specialty: "Emergency Medicine",
        color: "text-orange-600 bg-orange-50 dark:bg-orange-950/40 border-orange-200"
    },
    {
        id: "NO_SUITABLE_HOSPITAL",
        label: "No Suitable Hospital",
        description: "Hyperbaric decompression case. Proves explainable rejection reasons when no facility qualifies.",
        icon: HelpCircle,
        priority: "P1_CRITICAL",
        specialty: "Hyperbaric Diving Medicine",
        color: "text-slate-600 bg-slate-50 dark:bg-slate-800 border-slate-200"
    }
];

interface ScenarioIntakePanelProps {
    onRunSimulation: (scenario: string) => Promise<void>;
    onCustomIntake: (payload: any) => Promise<void>;
    loading: boolean;
    activeScenario?: string;
}

export function ScenarioIntakePanel({
    onRunSimulation,
    onCustomIntake,
    loading,
    activeScenario
}: ScenarioIntakePanelProps) {
    const [selectedScenario, setSelectedScenario] = useState<string>("NORMAL_CARDIAC");
    const [showCustomForm, setShowCustomForm] = useState(false);

    // Custom form states
    const [chiefComplaint, setChiefComplaint] = useState("Severe crushing chest pain radiating to jaw");
    const [condition, setCondition] = useState("Acute Coronary Syndrome");
    const [age, setAge] = useState("58");
    const [gender, setGender] = useState("MALE");
    const [priority, setPriority] = useState<"P1_CRITICAL" | "P2_EMERGENT" | "P3_URGENT">("P1_CRITICAL");
    const [heartRate, setHeartRate] = useState("112");
    const [sbp, setSbp] = useState("88");
    const [spo2, setSpo2] = useState("91");
    const [gcs, setGcs] = useState("14");
    const [requiredSpecialty, setRequiredSpecialty] = useState("CARDIOLOGY");
    const [requiredResource, setRequiredResource] = useState("ICU_BED");
    const [latitude, setLatitude] = useState("40.0125");
    const [longitude, setLongitude] = useState("-75.1450");
    const [address, setAddress] = useState("Broad St & Vine St, Philadelphia, PA");

    const handleRunPreset = async () => {
        try {
            await onRunSimulation(selectedScenario);
        } catch (err: any) {
            toast.error("Failed to run simulation: " + (err.message || String(err)));
        }
    };

    const handleCustomSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                chiefComplaint,
                condition,
                age: Number(age),
                gender,
                priority,
                vitals: {
                    heartRate: Number(heartRate),
                    sbp: Number(sbp),
                    spo2: Number(spo2),
                    gcs: Number(gcs)
                },
                requiredSpecialty,
                requiredResources: [requiredResource],
                incidentLocation: {
                    latitude: Number(latitude),
                    longitude: Number(longitude),
                    address
                }
            };
            await onCustomIntake(payload);
        } catch (err: any) {
            toast.error("Failed to evaluate allocation: " + (err.message || String(err)));
        }
    };

    return (
        <Card className="p-4 sm:p-5 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <div>
                        <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            Emergency Intake & Simulation Scenarios
                        </h3>
                        <p className="text-xs text-slate-500">
                            Select a verified clinical benchmark scenario or enter custom patient vitals
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant={showCustomForm ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setShowCustomForm(!showCustomForm)}
                        className="text-xs h-8"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                        {showCustomForm ? "Presets Mode" : "Custom Intake"}
                    </Button>
                </div>
            </div>

            {!showCustomForm ? (
                <div className="space-y-4">
                    {/* Scenario Radio Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {SCENARIOS.map((sc) => {
                            const isSelected = selectedScenario === sc.id;
                            const Icon = sc.icon;
                            return (
                                <button
                                    key={sc.id}
                                    type="button"
                                    onClick={() => setSelectedScenario(sc.id)}
                                    className={`p-3 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between gap-2 ${
                                        isSelected
                                            ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20 shadow-sm"
                                            : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/40"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-1.5 rounded-lg ${sc.color}`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                                {sc.label}
                                            </span>
                                        </div>
                                        <Badge
                                            variant="outline"
                                            className="text-[9px] py-0 px-1 font-mono uppercase shrink-0"
                                        >
                                            {sc.priority.split("_")[0]}
                                        </Badge>
                                    </div>
                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                        {sc.description}
                                    </p>
                                </button>
                            );
                        })}
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Target API: <code className="font-mono text-slate-700 dark:text-slate-300">POST /api/emergency/simulate</code></span>
                        </div>

                        <Button
                            type="button"
                            size="default"
                            onClick={handleRunPreset}
                            disabled={loading}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-md shadow-blue-600/20 px-6 h-10"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Executing Simulation Pipeline...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 mr-2 fill-current" />
                                    Run Simulation ({selectedScenario})
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleCustomSubmit} className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Chief Complaint</Label>
                            <Input
                                value={chiefComplaint}
                                onChange={(e) => setChiefComplaint(e.target.value)}
                                className="h-8 text-xs"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Condition / Diagnosis</Label>
                            <Input
                                value={condition}
                                onChange={(e) => setCondition(e.target.value)}
                                className="h-8 text-xs"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Age & Gender</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={age}
                                    onChange={(e) => setAge(e.target.value)}
                                    className="h-8 text-xs w-20"
                                    required
                                />
                                <Select value={gender} onValueChange={setGender}>
                                    <SelectTrigger className="h-8 text-xs flex-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MALE">Male</SelectItem>
                                        <SelectItem value="FEMALE">Female</SelectItem>
                                        <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Triage Priority</Label>
                            <Select value={priority} onValueChange={(val: any) => setPriority(val)}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="P1_CRITICAL">P1 - Critical (Immediate)</SelectItem>
                                    <SelectItem value="P2_EMERGENT">P2 - Emergent (&lt;15m)</SelectItem>
                                    <SelectItem value="P3_URGENT">P3 - Urgent (&lt;60m)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Required Specialty</Label>
                            <Select value={requiredSpecialty} onValueChange={setRequiredSpecialty}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="CARDIOLOGY">Cardiology</SelectItem>
                                    <SelectItem value="TRAUMA">Trauma Surgery</SelectItem>
                                    <SelectItem value="NEUROLOGY">Neurology</SelectItem>
                                    <SelectItem value="PULMONOLOGY">Pulmonology / Critical Care</SelectItem>
                                    <SelectItem value="GENERAL_SURGERY">General Surgery</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Primary Resource Needed</Label>
                            <Select value={requiredResource} onValueChange={setRequiredResource}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ICU_BED">ICU Bed</SelectItem>
                                    <SelectItem value="GENERAL_BED">General Bed</SelectItem>
                                    <SelectItem value="OPERATION_THEATRE">Operation Theatre</SelectItem>
                                    <SelectItem value="TRAUMA_BAY">Trauma Bay</SelectItem>
                                    <SelectItem value="CATH_LAB">Cath Lab</SelectItem>
                                    <SelectItem value="CT_SCAN">CT Scanner</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                            <Label className="text-xs">Vitals (Heart Rate / SBP / SpO2 / GCS)</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <Input placeholder="HR" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} className="h-8 text-xs" />
                                <Input placeholder="SBP" value={sbp} onChange={(e) => setSbp(e.target.value)} className="h-8 text-xs" />
                                <Input placeholder="SpO2" value={spo2} onChange={(e) => setSpo2(e.target.value)} className="h-8 text-xs" />
                                <Input placeholder="GCS" value={gcs} onChange={(e) => setGcs(e.target.value)} className="h-8 text-xs" />
                            </div>
                        </div>

                        <div className="space-y-1 sm:col-span-3">
                            <Label className="text-xs">Incident Coordinates & Address</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <Input placeholder="Latitude" value={latitude} onChange={(e) => setLatitude(e.target.value)} className="h-8 text-xs" />
                                <Input placeholder="Longitude" value={longitude} onChange={(e) => setLongitude(e.target.value)} className="h-8 text-xs" />
                                <Input placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} className="h-8 text-xs" />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCustomForm(false)}
                            className="text-xs"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5"
                        >
                            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />}
                            Triage & Allocate Hospital
                        </Button>
                    </div>
                </form>
            )}
        </Card>
    );
}
