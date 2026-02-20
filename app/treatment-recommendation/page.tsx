"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { RecommendationInput } from "@/components/treatment/recommendation-input"
import { ConditionCard } from "@/components/treatment/condition-card"
import { TreatmentOptionCard } from "@/components/treatment/treatment-option-card"
import { Condition, RecommendationResult } from "@/lib/medical-data"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Info, Stethoscope, ArrowRight } from "lucide-react"

export default function TreatmentRecommendationPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<RecommendationResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSearch = async (formData: any) => {
        setIsLoading(true)
        setError(null)
        setResult(null)

        try {
            // 1. Save data to Patient Profile
            const profileRes = await fetch("/api/patient/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!profileRes.ok) {
                console.warn("Failed to save profile, continuing with search...");
            }

            // 2. Identify Condition / Treatment Path
            const res = await fetch("/api/treatment/recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: formData.query }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || "Something went wrong")
            }

            if (data.found) {
                // Attach the location context to the result for session state
                const enrichedResult = {
                    ...data.condition,
                    patientContext: {
                        latitude: formData.latitude,
                        longitude: formData.longitude,
                        travelFlexibility: formData.travelFlexibility
                    }
                };
                setResult(enrichedResult)
            } else {
                setError(data.message || "We couldn't find a matching condition. Please try different keywords.")
            }

        } catch (err: any) {
            console.error(err)
            setError(err.message || "Failed to get recommendations. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const handleCompare = (selectedSubTreatment?: string) => {
        if (!result) return;

        const params = new URLSearchParams({
            diagnosis: result.conditionCategory || "",
            treatment: (typeof selectedSubTreatment === 'string' ? selectedSubTreatment : null) || result.treatments?.[0]?.name || result.selectedTreatment || "",
            latitude: result.patientContext?.latitude?.toString() || "",
            longitude: result.patientContext?.longitude?.toString() || "",
            travelFlexibility: result.patientContext?.travelFlexibility || "Local only"
        });

        router.push(`/recommendations?${params.toString()}`);
    }

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">

                {/* Search Section */}
                <section className={`transition-all duration-700 ease-in-out ${result ? "py-4" : "py-12 md:py-20"}`}>
                    <RecommendationInput onSearch={handleSearch} isLoading={isLoading} />
                </section>

                {/* Error State */}
                {error && (
                    <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-2">
                        <Alert variant="destructive" className="bg-rose-50 border-rose-100 shadow-sm rounded-2xl">
                            <Info className="h-4 w-4" />
                            <AlertTitle className="font-bold">No Match Found</AlertTitle>
                            <AlertDescription className="font-medium text-rose-700">{error}</AlertDescription>
                        </Alert>
                    </div>
                )}

                {/* Results Section */}
                {result && (
                    <div className="space-y-10 py-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

                        {/* 1. Condition Overview */}
                        <ConditionCard condition={result} />

                        {/* 2. Treatment Options (If traditional data) or Selected Treatment (If engine output) */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-1 bg-primary rounded-full" />
                                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Identified Clinical Path</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {result.treatments ? (
                                    result.treatments.map((treatment: any) => (
                                        <TreatmentOptionCard key={treatment.id} treatment={treatment} />
                                    ))
                                ) : (
                                    <div className="md:col-span-2 bg-slate-50 border border-slate-100 p-8 rounded-3xl space-y-4">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-900">{result.selectedTreatment}</h3>
                                                <p className="text-slate-500 font-medium">Standard of Care Procedure</p>
                                            </div>
                                            <Badge className="bg-primary/10 text-primary border-none">Intensity: {result.resourceIntensity}</Badge>
                                        </div>
                                        <div className="flex gap-6 py-2">
                                            <div className="text-sm font-bold text-slate-600">Requires ICU: {result.requiresICU ? "Yes" : "No"}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* 3. Call to Action */}
                        <div className="flex justify-center pt-8 pb-12">
                            <Button
                                size="lg"
                                onClick={() => handleCompare()}
                                className="h-16 px-10 rounded-[2rem] text-xl font-bold shadow-2xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all active:scale-95"
                            >
                                Compare Hospitals for This Treatment
                                <ArrowRight className="ml-2 h-6 w-6" />
                            </Button>
                        </div>

                    </div>
                )}
            </main>
        </div>
    )
}
