"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { RecommendationInput } from "@/components/treatment/recommendation-input"
import { ConditionCard } from "@/components/treatment/condition-card"
import { TreatmentOptionCard } from "@/components/treatment/treatment-option-card"
import { Condition } from "@/lib/medical-data"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Info, Stethoscope, ArrowRight } from "lucide-react"

export default function TreatmentRecommendationPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [result, setResult] = useState<Condition | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSearch = async (query: string) => {
        setIsLoading(true)
        setError(null)
        setResult(null)

        try {
            const res = await fetch("/api/treatment/recommend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || "Something went wrong")
            }

            if (data.found) {
                setResult(data.condition)
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

    const handleCompare = () => {
        // In a real app, we would pass the selected treatment context
        // to the recommendations page via query params or context.
        router.push("/recommendations")
    }

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col">
            <Navbar />

            <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">

                {/* Search Section */}
                <section className={`transition-all duration-500 ease-in-out ${result ? "py-8" : "py-24 md:py-32"}`}>
                    <RecommendationInput onSearch={handleSearch} isLoading={isLoading} />
                </section>

                {/* Error State */}
                {error && (
                    <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-2">
                        <Alert variant="destructive" className="bg-white border-red-100 shadow-sm">
                            <Info className="h-4 w-4" />
                            <AlertTitle>No Match Found</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    </div>
                )}

                {/* Results Section */}
                {result && (
                    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700">

                        {/* 1. Condition Overview */}
                        <ConditionCard condition={result} />

                        {/* 2. Treatment Options */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-2">
                                <Stethoscope className="h-5 w-5 text-primary" />
                                <h2 className="text-xl font-semibold text-gray-900">Common Treatment Approaches</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {result.treatments.map((treatment) => (
                                    <TreatmentOptionCard key={treatment.id} treatment={treatment} />
                                ))}
                            </div>
                        </section>

                        {/* 3. Call to Action */}
                        <div className="flex justify-center pt-8 pb-12">
                            <Button
                                size="lg"
                                onClick={handleCompare}
                                className="h-14 px-8 rounded-full text-lg shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all"
                            >
                                Compare Hospitals for This Treatment
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </div>

                    </div>
                )}
            </main>
        </div>
    )
}
