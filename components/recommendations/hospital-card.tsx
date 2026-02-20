"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ChevronDown,
  BedDouble,
  ShieldCheck,
  Check,
  X,
  Info,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface FitReason {
  label: string
  description: string
  match: boolean
}

export interface Hospital {
  id: string
  name: string
  treatmentPath: string
  suitabilityScore: number
  costRange: string
  insuranceAccepted: string[]
  bedAvailability: "Low" | "Medium" | "High"
  icuReadiness: boolean
  fitReasons: FitReason[]
  distance?: number | null
}

const bedColors: Record<string, string> = {
  Low: "bg-destructive/10 text-destructive border-destructive/30",
  Medium: "bg-chart-4/20 text-chart-3 border-chart-4/40",
  High: "bg-accent/15 text-accent border-accent/30",
}

export function HospitalCard({ hospital }: { hospital: Hospital }) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleViewCostBreakdown = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("hospitalId", hospital.id)
    params.set("hospitalName", hospital.name)
    params.set("costRange", hospital.costRange)
    params.set("suitabilityScore", hospital.suitabilityScore.toString())
    router.push(`/cost-dashboard?${params.toString()}`)
  }

  return (
    <Card className="rounded-2xl border border-border/60 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-0">
        {/* Main content */}
        <div className="flex flex-col gap-6 p-6">
          {/* Header row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex flex-col gap-1.5 leading-tight">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-foreground">
                  {hospital.name}
                </h3>
                {hospital.distance !== undefined && hospital.distance !== null && (
                  <Badge variant="outline" className="text-[10px] font-bold py-0 h-4 border-slate-200 text-slate-500">
                    {hospital.distance.toFixed(1)} km
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {hospital.treatmentPath}
              </p>
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Est. Cost
              </span>
              <span className="text-base font-semibold text-foreground">
                {hospital.costRange}
              </span>
            </div>
          </div>

          {/* Suitability score */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help items-center gap-1.5 text-sm font-medium text-foreground">
                      Suitability Score
                      <Info className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                    Suitability is calculated based on specialty match, infrastructure readiness, urgency fit, and cost compatibility.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-sm font-semibold text-primary">
                {hospital.suitabilityScore}%
              </span>
            </div>
            <Progress
              value={hospital.suitabilityScore}
              className="h-2.5 rounded-full"
            />
          </div>

          {/* Insurance badges */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Insurance Accepted
            </span>
            <div className="flex flex-wrap gap-2">
              {hospital.insuranceAccepted.map((ins) => (
                <Badge
                  key={ins}
                  variant="secondary"
                  className="gap-1.5 rounded-lg border border-border/60 px-3 py-1 text-xs font-medium"
                >
                  <ShieldCheck
                    className="h-3 w-3 text-primary"
                    aria-hidden="true"
                  />
                  {ins}
                </Badge>
              ))}
            </div>
          </div>

          {/* Capacity indicators */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
              <BedDouble
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">
                Bed Availability:
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  bedColors[hospital.bedAvailability]
                )}
              >
                {hospital.bedAvailability}
              </Badge>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
              <ShieldCheck
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="text-xs text-muted-foreground">
                ICU Readiness:
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-medium",
                  hospital.icuReadiness
                    ? "bg-accent/15 text-accent border-accent/30"
                    : "bg-destructive/10 text-destructive border-destructive/30"
                )}
              >
                {hospital.icuReadiness ? "Yes" : "No"}
              </Badge>
            </div>
          </div>

          {/* View Cost Breakdown CTA */}
          <Button
            variant="outline"
            className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
            onClick={handleViewCostBreakdown}
          >
            View Cost Breakdown
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Expandable section */}
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="border-t border-border/60">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-6 py-3.5 text-sm font-medium text-primary transition-colors hover:bg-muted/40">
              <span>Why this option fits you</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  isOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex flex-col gap-3 border-t border-border/40 bg-muted/20 px-6 py-5">
                {hospital.fitReasons.map((reason) => (
                  <div
                    key={reason.label}
                    className="flex items-start gap-3"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                        reason.match
                          ? "bg-accent/15 text-accent"
                          : "bg-destructive/10 text-destructive"
                      )}
                    >
                      {reason.match ? (
                        <Check className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <X className="h-3 w-3" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {reason.label}
                      </span>
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        {reason.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
