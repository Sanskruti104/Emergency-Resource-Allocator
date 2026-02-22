"use client"

import { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Building2, SlidersHorizontal, Loader2, AlertCircle, X as CloseIcon } from "lucide-react"
import { HospitalCard, type Hospital } from "./hospital-card"
import { ExplainabilityDashboard } from "@/components/medical/ExplainabilityUI"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

function formatBudget(value: number): string {
  if (value >= 100000) {
    return `${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`
  }
  return `${(value / 1000).toFixed(0)}K`
}

type SortOption = "suitability" | "lowest-cost" | "fastest-recovery"

export function TreatmentRecommendations() {
  const searchParams = useSearchParams()
  const [sortBy, setSortBy] = useState<SortOption>("suitability")
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  // --- XAI Integration State ---
  const [selectedHospitalForXAI, setSelectedHospitalForXAI] = useState<Hospital | null>(null)
  const [isXAIModalOpen, setIsXAIModalOpen] = useState(false)

  const treatment = searchParams.get("treatment") || "N/A"
  const urgency = searchParams.get("urgency") || "N/A"
  const budgetMin = Number(searchParams.get("budgetMin") || 0)
  const budgetMax = Number(searchParams.get("budgetMax") || 1000000)
  const insurance = searchParams.get("insurance") || "N/A"
  const diagnosis = searchParams.get("diagnosis")
  const lat = searchParams.get("latitude")
  const lng = searchParams.get("longitude")
  const travelFlex = searchParams.get("travelFlexibility")

  const contextItems = [
    { label: "Treatment", value: treatment },
    { label: "Urgency", value: urgency },
    {
      label: "Budget",
      value: budgetMax > 0 ? `\u20B9${formatBudget(budgetMin)}\u2013\u20B9${formatBudget(budgetMax)}` : "Any",
    },
    { label: "Insurance", value: insurance },
  ]

  const handleOpenXAI = (hospital: Hospital) => {
    setSelectedHospitalForXAI(hospital)
    setIsXAIModalOpen(true)
  }

  useEffect(() => {
    async function fetchMatches() {
      setIsLoading(true)
      try {
        // Switching to the Unified Recommendation Engine
        const payload = {
          treatmentId: diagnosis,
          treatmentName: treatment,
          symptoms: searchParams.get("symptoms") || "",
          patientOverride: {
            budgetMax,
            insuranceType: insurance,
            latitude: lat,
            longitude: lng,
            travelFlexibility: travelFlex,
            urgency
          }
        }

        const res = await fetch("/api/recommendation/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        if (!res.ok) throw new Error("Failed to fetch contextual recommendations")

        const data = await res.json()
        if (data.matches) {
          const mappedHospitals = data.matches.map((h: any) => ({
            id: h.id || h._id,
            name: h.hospitalName,
            treatmentPath: treatment,
            suitabilityScore: h.suitability_score || 0,
            costRange: `₹${(h.financial_adjudication?.out_of_pocket || 0).toLocaleString()}`,
            insuranceAccepted: h.insuranceNetworks || [insurance],
            bedAvailability: h.capacity?.totalBeds > 50 ? "High" : "Medium",
            icuReadiness: h.capacity?.icuBeds > 0,
            fitReasons: h.fitReasons || [
              { label: "AI Predicted Suitability", description: h.recommendation_status || "Highly Recommended", match: true }
            ],
            distance: h.distance || 12.5,
            rating: h.rating,
            xai_report: h // The full recommendation object contains XAI data
          }))
          setHospitals(mappedHospitals)
        }
      } catch (err) {
        console.error(err)
        setError("Could not load recommendations at this time.")
      } finally {
        setIsLoading(false)
      }
    }

    fetchMatches()
  }, [treatment, urgency, budgetMin, budgetMax, insurance, diagnosis, lat, lng, travelFlex])

  const sortedHospitals = useMemo(() => {
    const sorted = [...hospitals]
    switch (sortBy) {
      case "suitability":
        sorted.sort((a, b) => b.suitabilityScore - a.suitabilityScore)
        break
      case "lowest-cost":
        sorted.sort((a, b) => {
          const extractMin = (range: string) => {
            const match = range.match(/[\d.]+/)
            return match ? parseFloat(match[0]) : 0
          }
          return extractMin(a.costRange) - extractMin(b.costRange)
        })
        break
      case "fastest-recovery":
        sorted.sort((a, b) => {
          const bedScore: Record<string, number> = {
            High: 3,
            Medium: 2,
            Low: 1,
          }
          return (
            (bedScore[b.bedAvailability] || 0) -
            (bedScore[a.bedAvailability] || 0)
          )
        })
        break
    }
    return sorted
  }, [sortBy, hospitals])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      {/* Sticky Context Summary */}
      <div className="sticky top-[6.625rem] z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-2 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          {contextItems.map((item) => (
            <Badge
              key={item.label}
              variant="secondary"
              className="gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-normal"
            >
              <span className="font-medium text-foreground">
                {item.label}:
              </span>
              <span className="text-muted-foreground">{item.value}</span>
            </Badge>
          ))}
        </div>
      </div>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          {/* Header + Sort */}
          <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Building2
                  className="h-5 w-5 text-primary"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium tracking-wide text-primary uppercase">
                  Hospital Options
                </span>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
                Contextual Hospital Options
              </h1>
              <p className="max-w-xl text-base text-muted-foreground text-pretty leading-relaxed">
                Options are ranked based on suitability to your selected
                constraints — not ratings.
              </p>
            </div>

            {/* Sort dropdown */}
            <div className="flex items-center gap-2 shrink-0">
              <SlidersHorizontal
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortOption)}
              >
                <SelectTrigger className="w-[180px] rounded-xl border-border/60 bg-background text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="suitability">Best Value</SelectItem>
                  <SelectItem value="lowest-cost">Lowest Cost</SelectItem>
                  <SelectItem value="fastest-recovery">
                    Fastest Recovery
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content Area */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">Finding the best matches for you...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive mb-3" />
              <p className="text-destructive font-medium">{error}</p>
            </div>
          ) : sortedHospitals.length === 0 ? (
            <div className="text-center py-20 rounded-xl border border-dashed">
              <p className="text-muted-foreground">No matching hospitals found in your area matching criteria.</p>
              <p className="text-sm text-muted-foreground mt-2">Try adjusting your budget or filters.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {sortedHospitals.map((hospital) => (
                <HospitalCard
                  key={hospital.id}
                  hospital={hospital}
                  onViewXAI={() => handleOpenXAI(hospital)}
                />
              ))}
            </div>
          )}

          {/* XAI Explanation Modal */}
          <Dialog open={isXAIModalOpen} onOpenChange={setIsXAIModalOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto rounded-3xl p-8 border-none bg-white dark:bg-slate-950">
              <DialogHeader className="pr-12">
                <DialogTitle className="text-2xl font-bold sr-only">Explainable AI Analysis</DialogTitle>
                <DialogDescription className="sr-only">Detailed breakdown of why this hospital was recommended.</DialogDescription>
              </DialogHeader>
              {selectedHospitalForXAI && (
                <ExplainabilityDashboard data={selectedHospitalForXAI.xai_report} />
              )}
            </DialogContent>
          </Dialog>

          {/* Disclaimer */}
          <div className="mt-10 rounded-xl border border-border/60 bg-muted/30 px-6 py-4 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Estimates are simulated for demonstration. Always confirm with
              healthcare providers. These options do not constitute medical
              advice.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
