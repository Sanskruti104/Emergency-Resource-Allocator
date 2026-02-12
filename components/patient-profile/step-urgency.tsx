"use client"

import { cn } from "@/lib/utils"
import { AlertCircle, Calendar } from "lucide-react"

const urgencyOptions = [
  {
    value: "emergency",
    label: "Emergency",
    description: "Within days -- requires immediate attention",
    icon: AlertCircle,
  },
  {
    value: "planned",
    label: "Planned",
    description: "Can wait -- scheduled at convenience",
    icon: Calendar,
  },
]

interface StepUrgencyProps {
  value: string
  onChange: (value: string) => void
}

export function StepUrgency({ value, onChange }: StepUrgencyProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Treatment Urgency</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Let us know if this is time-sensitive so we can prioritize accordingly.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {urgencyOptions.map((option) => {
          const Icon = option.icon
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "flex items-center gap-4 rounded-xl border-2 px-5 py-4 text-left transition-all",
                "hover:border-primary/40 hover:bg-primary/5",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                value === option.value
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-background"
              )}
            >
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  value === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.description}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
