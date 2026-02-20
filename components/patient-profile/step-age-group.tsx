"use client"

import { cn } from "@/lib/utils"

const ageGroups = [
  { value: "0-18", label: "0 -- 18", description: "Pediatric" },
  { value: "19-40", label: "19 -- 40", description: "Young Adult" },
  { value: "41-60", label: "41 -- 60", description: "Middle-aged" },
  { value: "60+", label: "60+", description: "Senior" },
]

interface StepAgeGroupProps {
  value: string
  onChange: (value: string) => void
}

export function StepAgeGroup({ value, onChange }: StepAgeGroupProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Select Age Group</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This helps us tailor treatment options and recovery expectations.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ageGroups.map((group) => (
          <button
            key={group.value}
            type="button"
            onClick={() => onChange(group.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-5 text-center transition-all",
              "hover:border-primary/40 hover:bg-primary/5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              value === group.value
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border bg-background"
            )}
          >
            <span className="text-lg font-semibold text-foreground">{group.label}</span>
            <span className="text-xs text-muted-foreground">{group.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
