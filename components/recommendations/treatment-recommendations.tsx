"use client"

import { useMemo, useState } from "react"
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
import { Building2, SlidersHorizontal } from "lucide-react"
import { HospitalCard, type Hospital } from "./hospital-card"

function formatBudget(value: number): string {
  if (value >= 100000) {
    return `${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`
  }
  return `${(value / 1000).toFixed(0)}K`
}

const hospitalData: Hospital[] = [
  {
    id: "city-general",
    name: "City General Hospital",
    treatmentPath: "Arthroscopic Surgery",
    suitabilityScore: 92,
    costRange: "\u20B92.5L \u2013 \u20B94.2L",
    insuranceAccepted: ["Private", "Government"],
    bedAvailability: "High",
    icuReadiness: true,
    fitReasons: [
      {
        label: "Specialty Match",
        description:
          "Dedicated orthopedic wing with 15+ years of arthroscopic procedures and board-certified specialists.",
        match: true,
      },
      {
        label: "Infrastructure Readiness",
        description:
          "Fully equipped operation theaters with latest arthroscopy equipment, post-op recovery suites, and 24/7 nursing support.",
        match: true,
      },
      {
        label: "Cost Compatibility",
        description:
          "Estimated cost falls within your specified budget range of \u20B92L\u2013\u20B95L.",
        match: true,
      },
      {
        label: "Urgency Match",
        description:
          "Planned procedures can be scheduled within 2 weeks based on current availability.",
        match: true,
      },
    ],
  },
  {
    id: "apollo-multispecialty",
    name: "Apollo Multispecialty Centre",
    treatmentPath: "Arthroscopic Surgery",
    suitabilityScore: 84,
    costRange: "\u20B93.8L \u2013 \u20B95.5L",
    insuranceAccepted: ["Private"],
    bedAvailability: "Medium",
    icuReadiness: true,
    fitReasons: [
      {
        label: "Specialty Match",
        description:
          "Multi-specialty facility with experienced orthopedic surgeons and high case volume.",
        match: true,
      },
      {
        label: "Infrastructure Readiness",
        description:
          "Modern operation theaters with robotic-assisted capabilities. Dedicated physiotherapy unit on-site.",
        match: true,
      },
      {
        label: "Cost Compatibility",
        description:
          "Upper estimate slightly exceeds budget ceiling. Discuss payment plans with the billing department.",
        match: false,
      },
      {
        label: "Urgency Match",
        description:
          "Current wait time for planned procedures is approximately 3 weeks.",
        match: true,
      },
    ],
  },
  {
    id: "district-medical",
    name: "District Medical College Hospital",
    treatmentPath: "Arthroscopic Surgery",
    suitabilityScore: 71,
    costRange: "\u20B91.2L \u2013 \u20B92.8L",
    insuranceAccepted: ["Government", "Self-Funded"],
    bedAvailability: "Low",
    icuReadiness: false,
    fitReasons: [
      {
        label: "Specialty Match",
        description:
          "General orthopedic department with growing arthroscopy program. Faculty-supervised residents.",
        match: true,
      },
      {
        label: "Infrastructure Readiness",
        description:
          "Basic arthroscopy setup available. ICU facilities are currently at capacity; external transfer protocol in place.",
        match: false,
      },
      {
        label: "Cost Compatibility",
        description:
          "Highly affordable option, well within budget. Government subsidies may further reduce out-of-pocket costs.",
        match: true,
      },
      {
        label: "Urgency Match",
        description:
          "Wait time can be 4\u20136 weeks due to higher patient volume and limited slots.",
        match: false,
      },
    ],
  },
]

type SortOption = "suitability" | "lowest-cost" | "fastest-recovery"

export function TreatmentRecommendations() {
  const searchParams = useSearchParams()
  const [sortBy, setSortBy] = useState<SortOption>("suitability")

  const treatment = searchParams.get("treatment") || "N/A"
  const urgency = searchParams.get("urgency") || "N/A"
  const budgetMin = Number(searchParams.get("budgetMin") || 200000)
  const budgetMax = Number(searchParams.get("budgetMax") || 1000000)
  const insurance = searchParams.get("insurance") || "N/A"

  const contextItems = [
    { label: "Treatment", value: treatment },
    { label: "Urgency", value: urgency },
    {
      label: "Budget",
      value: `\u20B9${formatBudget(budgetMin)}\u2013\u20B9${formatBudget(budgetMax)}`,
    },
    { label: "Insurance", value: insurance },
  ]

  const sortedHospitals = useMemo(() => {
    const sorted = [...hospitalData]
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
  }, [sortBy])

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

          {/* Hospital Cards */}
          <div className="flex flex-col gap-6">
            {sortedHospitals.map((hospital) => (
              <HospitalCard key={hospital.id} hospital={hospital} />
            ))}
          </div>

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
