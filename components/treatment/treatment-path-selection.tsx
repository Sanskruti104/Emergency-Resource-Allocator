"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Navbar } from "@/components/navbar"
import {
  Activity,
  Clock,
  Gauge,
  Pill,
  Syringe,
  Stethoscope,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

function formatBudget(value: number): string {
  if (value >= 100000) {
    return `${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`
  }
  return `${(value / 1000).toFixed(0)}K`
}

const intensityColors: Record<string, string> = {
  Low: "bg-accent/15 text-accent border-accent/30",
  Medium: "bg-primary/10 text-primary border-primary/30",
  High: "bg-destructive/10 text-destructive border-destructive/30",
}

interface TreatmentPath {
  id: string
  name: string
  description: string
  duration: string
  intensity: "Low" | "Medium" | "High"
  icon: React.ReactNode
}

const treatmentPaths: TreatmentPath[] = [
  {
    id: "conservative",
    name: "Conservative Management",
    description:
      "Non-invasive approach focusing on physical therapy, medication, and lifestyle modifications to manage symptoms.",
    duration: "4-8 weeks",
    intensity: "Low",
    icon: <Pill className="h-6 w-6" />,
  },
  {
    id: "minimally-invasive",
    name: "Minimally Invasive Procedure",
    description:
      "Targeted intervention using advanced techniques with smaller incisions, shorter recovery, and reduced tissue impact.",
    duration: "1-3 weeks",
    intensity: "Medium",
    icon: <Syringe className="h-6 w-6" />,
  },
  {
    id: "surgical",
    name: "Surgical Intervention",
    description:
      "Comprehensive surgical approach for definitive treatment, typically recommended when other options are insufficient.",
    duration: "6-12 weeks",
    intensity: "High",
    icon: <Stethoscope className="h-6 w-6" />,
  },
]

export function TreatmentPathSelection() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [isProfileLoading, setIsProfileLoading] = useState(true)

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/patient/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.found) {
            setProfile(data.profile)
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile:", error)
      } finally {
        setIsProfileLoading(false)
      }
    }
    fetchProfile()
  }, [])

  // Priority: Search Params > Profile Data > Default
  const age = searchParams.get("age") || profile?.ageGroup || "N/A"

  // Use conditionName from treatmentPlan if available, else falling back to category
  const conditionName = profile?.treatmentPlan?.conditionName || profile?.diagnosisCategory
  const diagnosis = searchParams.get("diagnosis") || conditionName || "N/A"

  const urgency = searchParams.get("urgency") || profile?.urgency || "N/A"
  const budgetMin = Number(searchParams.get("budgetMin")) || profile?.budgetMin || 10000
  const budgetMax = Number(searchParams.get("budgetMax")) || profile?.budgetMax || 20000
  const insurance = searchParams.get("insurance") || profile?.insuranceType || "N/A"

  const contextItems = [
    { label: "Age", value: age },
    { label: "Diagnosis", value: diagnosis },
    { label: "Urgency", value: urgency },
    { label: "Budget", value: `\u20B9${formatBudget(budgetMin)}\u2013\u20B9${formatBudget(budgetMax)}` },
    { label: "Insurance", value: insurance },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        {/* Context Banner */}
        <div className="border-b border-border/60 bg-muted/40">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
            {contextItems.map((item) => (
              <span
                key={item.label}
                className="text-sm text-muted-foreground"
              >
                <span className="font-medium text-foreground">
                  {item.label}:
                </span>{" "}
                {item.value}
              </span>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          {/* Header */}
          <div className="mb-10 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium tracking-wide text-primary uppercase">
                Treatment Options
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
              Available Treatment Approaches
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground text-pretty leading-relaxed">
              These are common medical approaches doctors consider. Final
              decisions are made by healthcare professionals.
            </p>
          </div>

          {/* Treatment Cards Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {treatmentPaths.map((path) => {
              const isSelected = selectedPath === path.id
              return (
                <Card
                  key={path.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedPath(path.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelectedPath(path.id)
                    }
                  }}
                  className={cn(
                    "cursor-pointer rounded-2xl border-2 shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5",
                    isSelected
                      ? "border-primary bg-primary/[0.03] shadow-primary/10"
                      : "border-transparent"
                  )}
                >
                  <CardContent className="flex flex-col gap-5 p-6">
                    {/* Icon */}
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-xl transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {path.icon}
                    </div>

                    {/* Name */}
                    <h3 className="text-lg font-semibold text-foreground">
                      {path.name}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {path.description}
                    </p>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="gap-1.5 rounded-lg border border-border/60 px-3 py-1 text-xs"
                      >
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {path.duration}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5 rounded-lg px-3 py-1 text-xs",
                          intensityColors[path.intensity]
                        )}
                      >
                        <Gauge className="h-3 w-3" aria-hidden="true" />
                        {path.intensity}
                      </Badge>
                    </div>

                    {/* Select Button */}
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      className="mt-auto w-full rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedPath(path.id)
                      }}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Bottom CTA */}
          <div className="mt-12 flex flex-col items-center gap-3">
            <Button
              size="lg"
              disabled={!selectedPath}
              className="h-12 rounded-xl px-10 text-base"
              onClick={() => {
                if (!selectedPath) return
                const selected = treatmentPaths.find((p) => p.id === selectedPath)
                const params = new URLSearchParams({
                  age,
                  diagnosis,
                  urgency,
                  budgetMin: budgetMin.toString(),
                  budgetMax: budgetMax.toString(),
                  insurance,
                  treatment: selected?.name || "",
                  treatmentId: selectedPath,
                })
                router.push(`/recommendations?${params.toString()}`)
              }}
            >
              Compare Hospitals
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <p className="text-xs text-muted-foreground">
              View hospitals that offer this treatment approach in your budget
              range
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
