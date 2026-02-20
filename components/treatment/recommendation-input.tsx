"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, Info, Landmark, Clock, Wallet, MapPin, SlidersHorizontal, ArrowLeft, ArrowRight, Stethoscope, ShieldCheck } from "lucide-react"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select"
import { LocationPicker } from "./location-picker"

interface RecommendationInputProps {
    onSearch: (data: any) => void
    isLoading: boolean
}

export function RecommendationInput({ onSearch, isLoading }: RecommendationInputProps) {
    const [step, setStep] = useState(1);
    const [query, setQuery] = useState("")
    const [location, setLocation] = useState<any>(null)
    const [urgency, setUrgency] = useState("Non-emergency")
    const [budgetMin, setBudgetMin] = useState("")
    const [budgetMax, setBudgetMax] = useState("")
    const [insurance, setInsurance] = useState("None")

    const handleNext = () => setStep(s => s + 1);
    const handlePrev = () => setStep(s => s - 1);

    const handleSubmit = () => {
        if (query.trim() && location?.city && location?.state) {
            onSearch({
                query,
                ...location,
                urgency,
                budgetMin: parseInt(budgetMin) || 0,
                budgetMax: parseInt(budgetMax) || 0,
                insuranceType: insurance
            })
        }
    };

    const isStep1Valid = query.trim().length > 3;
    const isStep2Valid = location?.latitude && location?.longitude;
    const isFormValid = isStep1Valid && isStep2Valid;

    const steps = [
        { id: 1, title: "Clinical Inquiry", icon: Stethoscope },
        { id: 2, title: "Location", icon: MapPin },
        { id: 3, title: "Preferences", icon: SlidersHorizontal }
    ];

    return (
        <div className="w-full max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Progress Indicator */}
            <div className="flex justify-between items-center px-4 md:px-10">
                {steps.map((s, i) => (
                    <div key={s.id} className="flex items-center group">
                        <div className={`
                            flex items-center justify-center h-10 w-10 rounded-2xl transition-all duration-300
                            ${step >= s.id ? "bg-primary text-white shadow-lg shadow-primary/30" : "bg-slate-100 text-slate-400"}
                            ${step === s.id ? "scale-110 ring-4 ring-primary/10" : ""}
                        `}>
                            <s.icon className="h-5 w-5" />
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`h-0.5 w-10 md:w-20 mx-2 transition-colors duration-500 ${step > s.id ? "bg-primary" : "bg-slate-100"}`} />
                        )}
                    </div>
                ))}
            </div>

            <div className="text-center space-y-2">
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 italic">
                    {steps[step - 1].title}
                </h1>
                <p className="text-slate-500 font-medium">Step {step} of 3</p>
            </div>

            <div className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 min-h-[400px] flex flex-col justify-between relative overflow-hidden">

                {/* Decorative background element */}
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

                <div className="relative z-10 flex-1 flex flex-col justify-center">
                    {/* Step 1: Query */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="space-y-4">
                                <Label className="text-xl font-bold text-slate-800">What symptoms or procedures are you inquiring about?</Label>
                                <div className="relative flex items-center">
                                    <Search className="absolute left-5 h-6 w-6 text-slate-400" />
                                    <Input
                                        autoFocus
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Heart bypass, Knee pain, Eye cataract..."
                                        className="h-20 pl-14 pr-6 rounded-3xl text-xl shadow-inner border-slate-200 bg-slate-50/30 focus-visible:ring-primary/20 transition-all focus:bg-white"
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    {["Angioplasty", "Knee Replacement", "Cataract", "Spine Surgery", "Gallstones"].map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => setQuery(tag)}
                                            className="px-4 py-1.5 rounded-full bg-slate-100 text-slate-600 text-sm font-bold hover:bg-primary/10 hover:text-primary transition-colors"
                                        >
                                            + {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Location */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                            <LocationPicker onChange={setLocation} />
                        </div>
                    )}

                    {/* Step 3: Preferences */}
                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                                        <Clock className="h-4 w-4 text-primary" />
                                        Urgency
                                    </div>
                                    <Select value={urgency} onValueChange={setUrgency}>
                                        <SelectTrigger className="rounded-2xl h-14 bg-slate-50/50 border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl">
                                            <SelectItem value="Emergency">Immediate (Emergency)</SelectItem>
                                            <SelectItem value="Urgent">Within 1-2 Weeks (Urgent)</SelectItem>
                                            <SelectItem value="Non-emergency">Planned (Non-emergency)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-slate-900 font-bold">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                        Insurance
                                    </div>
                                    <Select value={insurance} onValueChange={setInsurance}>
                                        <SelectTrigger className="rounded-2xl h-14 bg-slate-50/50 border-slate-200">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl">
                                            <SelectItem value="None">Out-of-pocket</SelectItem>
                                            <SelectItem value="Private">Private Insurance</SelectItem>
                                            <SelectItem value="Govt - PMJAY">Govt (PMJAY)</SelectItem>
                                            <SelectItem value="Govt - State">State Scheme</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-slate-900 font-bold">
                                    <Wallet className="h-4 w-4 text-primary" />
                                    Estimated Budget (Optional)
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                        <Input
                                            type="number"
                                            placeholder="Min"
                                            value={budgetMin}
                                            onChange={(e) => setBudgetMin(e.target.value)}
                                            className="rounded-2xl h-14 pl-8 bg-slate-50/50 border-slate-200"
                                        />
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                        <Input
                                            type="number"
                                            placeholder="Max"
                                            value={budgetMax}
                                            onChange={(e) => setBudgetMax(e.target.value)}
                                            className="rounded-2xl h-14 pl-8 bg-slate-50/50 border-slate-200"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center pt-10 relative z-10">
                    {step > 1 ? (
                        <Button variant="ghost" onClick={handlePrev} className="rounded-2xl h-12 pr-6 hover:bg-slate-100 font-bold text-slate-600">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back
                        </Button>
                    ) : (
                        <div />
                    )}

                    {step < 3 ? (
                        <Button
                            onClick={handleNext}
                            disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                            className="rounded-2xl h-14 px-10 text-lg font-bold shadow-xl shadow-primary/20 transition-all hover:scale-105"
                        >
                            Next Step <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={!isFormValid || isLoading}
                            className="rounded-2xl h-16 px-12 text-xl font-black shadow-2xl shadow-primary/30 transition-all hover:scale-105 bg-slate-900 group"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                                    Analyzing Path...
                                </>
                            ) : (
                                <>
                                    Identify Treatment Path
                                    <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Facts Badge */}
            <div className="flex justify-center">
                <div className="inline-flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-widest">
                    <Info className="h-4 w-4 text-primary" />
                    Deterministic Resource Mapping Active
                </div>
            </div>
        </div>
    )
}
