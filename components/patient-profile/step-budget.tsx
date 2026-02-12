"use client"

import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"

interface StepBudgetProps {
  value: number[]
  onChange: (value: number[]) => void
}

function formatCurrency(amount: number) {
  if (amount >= 100000) {
    return `${(amount / 100000).toFixed(amount % 100000 === 0 ? 0 : 1)}L`
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`
  }
  return amount.toString()
}

export function StepBudget({ value, onChange }: StepBudgetProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Budget Range</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set your approximate budget range to find treatment options that fit.
        </p>
      </div>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Label>Select range</Label>
          <Slider
            value={value}
            onValueChange={onChange}
            min={50000}
            max={2500000}
            step={50000}
            className="py-2"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background px-6 py-3">
            <span className="text-xs text-muted-foreground">Min</span>
            <span className="text-lg font-semibold text-foreground">
              {"₹"}{formatCurrency(value[0])}
            </span>
          </div>
          <div className="h-px flex-1 bg-border mx-4" />
          <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background px-6 py-3">
            <span className="text-xs text-muted-foreground">Max</span>
            <span className="text-lg font-semibold text-foreground">
              {"₹"}{formatCurrency(value[1])}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
