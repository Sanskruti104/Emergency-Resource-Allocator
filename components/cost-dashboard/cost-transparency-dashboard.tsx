"use client"

import { useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Stethoscope,
  FlaskConical,
  BedDouble,
  HeartPulse,
  Info,
  TrendingDown,
  Zap,
  Award,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

interface CostItem {
  id: string
  label: string
  icon: React.ReactNode
  costMin: number
  costMax: number
  description: string
  tooltip: string
}

function formatINR(value: number): string {
  if (value >= 100000) {
    const lakhs = value / 100000
    return `\u20B9${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)}L`
  }
  if (value >= 1000) {
    const thousands = value / 1000
    return `\u20B9${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}K`
  }
  return `\u20B9${value}`
}

function formatINRFull(value: number): string {
  return `\u20B9${value.toLocaleString("en-IN")}`
}

const costDataByHospital: Record<string, CostItem[]> = {
  "city-general": [
    {
      id: "base",
      label: "Base Treatment Cost",
      icon: <Stethoscope className="h-5 w-5" aria-hidden="true" />,
      costMin: 150000,
      costMax: 250000,
      description:
        "Core surgical procedure charges including surgeon fees, anesthesia, and operating theater usage.",
      tooltip:
        "Includes surgeon consultation, anesthesia charges, OT booking, surgical consumables, and implant costs if applicable.",
    },
    {
      id: "diagnostics",
      label: "Diagnostics & Pre-op",
      icon: <FlaskConical className="h-5 w-5" aria-hidden="true" />,
      costMin: 25000,
      costMax: 45000,
      description:
        "Pre-operative lab work, imaging (X-ray, MRI), cardiac clearance, and consultation fees.",
      tooltip:
        "Covers blood panels, imaging scans, ECG, pre-anesthetic checkup, and specialist consultations required before surgery.",
    },
    {
      id: "stay",
      label: "Hospital Stay",
      icon: <BedDouble className="h-5 w-5" aria-hidden="true" />,
      costMin: 50000,
      costMax: 80000,
      description:
        "Room charges, nursing care, medications, and post-operative monitoring for 3\u20135 day stay.",
      tooltip:
        "Based on semi-private room. Includes nursing, IV medications, meals, and daily doctor rounds. ICU charges extra if needed.",
    },
    {
      id: "followup",
      label: "Follow-up & Recovery",
      icon: <HeartPulse className="h-5 w-5" aria-hidden="true" />,
      costMin: 25000,
      costMax: 45000,
      description:
        "Post-discharge consultations, physiotherapy sessions, medications, and wound care supplies.",
      tooltip:
        "Estimated for 4\u20136 weeks of recovery. Includes 3\u20134 follow-up visits, 8\u201312 physiotherapy sessions, and prescribed medications.",
    },
  ],
  "apollo-multispecialty": [
    {
      id: "base",
      label: "Base Treatment Cost",
      icon: <Stethoscope className="h-5 w-5" aria-hidden="true" />,
      costMin: 220000,
      costMax: 320000,
      description:
        "Core procedure with robotic-assisted option. Premium surgeon fees and advanced surgical suite.",
      tooltip:
        "Includes senior surgeon fees, robotic assistance surcharge, OT booking, advanced consumables, and imported implants.",
    },
    {
      id: "diagnostics",
      label: "Diagnostics & Pre-op",
      icon: <FlaskConical className="h-5 w-5" aria-hidden="true" />,
      costMin: 35000,
      costMax: 60000,
      description:
        "Comprehensive pre-op workup including advanced imaging, specialist panels, and fitness assessment.",
      tooltip:
        "Covers full blood panel, 3T MRI, CT if needed, cardiac evaluation, pulmonary function test, and multi-specialist clearance.",
    },
    {
      id: "stay",
      label: "Hospital Stay",
      icon: <BedDouble className="h-5 w-5" aria-hidden="true" />,
      costMin: 80000,
      costMax: 120000,
      description:
        "Premium room with dedicated nursing, advanced monitoring, and 4\u20136 day typical stay.",
      tooltip:
        "Private room with en-suite. Includes 24/7 nursing, digital monitoring, meals, pharmacy, and daily consultant rounds.",
    },
    {
      id: "followup",
      label: "Follow-up & Recovery",
      icon: <HeartPulse className="h-5 w-5" aria-hidden="true" />,
      costMin: 45000,
      costMax: 50000,
      description:
        "Structured recovery program with in-house physiotherapy, telemedicine follow-ups, and medication plan.",
      tooltip:
        "Covers 6\u20138 weeks recovery. Includes 5\u20136 in-person visits, 10\u201315 physio sessions, teleconsultations, and medication.",
    },
  ],
  "district-medical": [
    {
      id: "base",
      label: "Base Treatment Cost",
      icon: <Stethoscope className="h-5 w-5" aria-hidden="true" />,
      costMin: 60000,
      costMax: 120000,
      description:
        "Standard arthroscopic procedure. Government-subsidized surgeon fees and basic surgical suite.",
      tooltip:
        "Includes faculty surgeon fees, anesthesia, OT charges, and standard consumables. Government subsidies may apply.",
    },
    {
      id: "diagnostics",
      label: "Diagnostics & Pre-op",
      icon: <FlaskConical className="h-5 w-5" aria-hidden="true" />,
      costMin: 15000,
      costMax: 30000,
      description:
        "Essential pre-operative investigations and basic imaging through hospital lab.",
      tooltip:
        "Covers routine blood work, X-ray, basic MRI (may have wait time), ECG, and pre-anesthetic assessment.",
    },
    {
      id: "stay",
      label: "Hospital Stay",
      icon: <BedDouble className="h-5 w-5" aria-hidden="true" />,
      costMin: 20000,
      costMax: 50000,
      description:
        "General ward or semi-private. 3\u20137 day stay with standard nursing care and monitoring.",
      tooltip:
        "General ward rate. Includes nursing care, standard medications, meals, and daily rounds. Private room at additional cost.",
    },
    {
      id: "followup",
      label: "Follow-up & Recovery",
      icon: <HeartPulse className="h-5 w-5" aria-hidden="true" />,
      costMin: 25000,
      costMax: 80000,
      description:
        "OPD follow-ups and basic physiotherapy through hospital outpatient department.",
      tooltip:
        "Covers 4\u20136 weeks. Includes 2\u20133 OPD visits, 6\u20138 physiotherapy sessions, and generic medication prescriptions.",
    },
  ],
}

interface TradeOff {
  id: string
  label: string
  icon: React.ReactNode
  description: string
  color: string
}

const tradeOffs: TradeOff[] = [
  {
    id: "best-value",
    label: "Best Value",
    icon: <Award className="h-4 w-4" aria-hidden="true" />,
    description:
      "Balances quality of care, infrastructure, and cost. Recommended when all factors are equally important.",
    color:
      "bg-primary/10 text-primary border-primary/30",
  },
  {
    id: "lowest-cost",
    label: "Lowest Upfront Cost",
    icon: <TrendingDown className="h-4 w-4" aria-hidden="true" />,
    description:
      "Minimizes initial out-of-pocket expense. May involve longer wait times or shared wards.",
    color:
      "bg-accent/15 text-accent border-accent/30",
  },
  {
    id: "fastest-recovery",
    label: "Fastest Recovery",
    icon: <Zap className="h-4 w-4" aria-hidden="true" />,
    description:
      "Prioritizes advanced techniques and premium post-op care for quicker return to normal activity.",
    color:
      "bg-chart-5/15 text-chart-5 border-chart-5/30",
  },
]

export function CostTransparencyDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const hospitalId = searchParams.get("hospitalId") || "city-general"
  const hospitalName =
    searchParams.get("hospitalName") || "City General Hospital"
  const treatment = searchParams.get("treatment") || "N/A"
  const urgency = searchParams.get("urgency") || "N/A"
  const budgetMin = Number(searchParams.get("budgetMin") || 200000)
  const budgetMax = Number(searchParams.get("budgetMax") || 1000000)
  const insurance = searchParams.get("insurance") || "N/A"

  const costItems = costDataByHospital[hospitalId] || costDataByHospital["city-general"]

  const totalMin = costItems.reduce((sum, item) => sum + item.costMin, 0)
  const totalMax = costItems.reduce((sum, item) => sum + item.costMax, 0)

  const contextItems = [
    { label: "Urgency", value: urgency },
    {
      label: "Budget",
      value: `${formatINR(budgetMin)}\u2013${formatINR(budgetMax)}`,
    },
    { label: "Insurance", value: insurance },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to recommendations
          </Button>

          {/* Header */}
          <div className="mb-10 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
                {hospitalName}
              </h1>
              <p className="text-base text-muted-foreground">
                {treatment}
              </p>
            </div>

            {/* Context badges */}
            <div className="flex flex-wrap items-center gap-2">
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

          {/* Cost breakdown cards */}
          <div className="mb-10 flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Cost Breakdown
            </h2>
            <p className="text-sm text-muted-foreground">
              Estimated cost components for this treatment at {hospitalName}.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {costItems.map((item) => (
              <Card
                key={item.id}
                className="rounded-2xl border border-border/60 shadow-sm"
              >
                <CardContent className="flex flex-col gap-4 p-6">
                  {/* Icon + label + tooltip */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        {item.icon}
                      </div>
                      <span className="text-sm font-semibold text-foreground leading-tight">
                        {item.label}
                      </span>
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={`Info about ${item.label}`}
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="max-w-xs text-xs leading-relaxed"
                        >
                          {item.tooltip}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Cost range */}
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-foreground">
                      {formatINRFull(item.costMin)}
                    </span>
                    <span className="text-sm text-muted-foreground">{"\u2013"}</span>
                    <span className="text-xl font-bold text-foreground">
                      {formatINRFull(item.costMax)}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Total estimated cost */}
          <Card className="mt-8 rounded-2xl border-2 border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="flex flex-col items-center gap-2 p-6 sm:flex-row sm:justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-muted-foreground">
                  Total Estimated Cost Range
                </span>
                <span className="text-xs text-muted-foreground">
                  Sum of all components above
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground sm:text-3xl">
                  {formatINRFull(totalMin)}
                </span>
                <span className="text-base text-muted-foreground">{"\u2013"}</span>
                <span className="text-2xl font-bold text-foreground sm:text-3xl">
                  {formatINRFull(totalMax)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Trade-off Insights */}
          <div className="mt-14 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                Trade-Off Insights
              </h2>
              <p className="text-sm text-muted-foreground">
                Consider these perspectives when evaluating your decision.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {tradeOffs.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
                >
                  <Badge
                    variant="outline"
                    className={`w-fit gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${t.color}`}
                  >
                    {t.icon}
                    {t.label}
                  </Badge>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-14 rounded-xl border border-border/60 bg-muted/30 px-6 py-4 text-center">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Cost estimates are indicative and may vary based on clinical
              evaluation. Final costs depend on surgical findings, length of
              stay, and individual recovery. Always confirm with the hospital
              billing department.
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
