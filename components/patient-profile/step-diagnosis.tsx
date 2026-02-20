"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

const categories = [
  { value: "orthopedic", label: "Orthopedic" },
  { value: "cardiac", label: "Cardiac" },
  { value: "neurology", label: "Neurology" },
  { value: "general-surgery", label: "General Surgery" },
]

interface StepDiagnosisProps {
  value: string
  onChange: (value: string) => void
}

export function StepDiagnosis({ value, onChange }: StepDiagnosisProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Select Diagnosis Category</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the primary area of treatment to narrow down relevant hospitals and specialists.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="diagnosis-category">Category</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id="diagnosis-category" className="h-12 rounded-xl">
            <SelectValue placeholder="Choose a diagnosis category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
