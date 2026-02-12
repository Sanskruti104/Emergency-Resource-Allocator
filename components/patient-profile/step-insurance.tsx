"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

const insuranceTypes = [
  { value: "private", label: "Private Insurance" },
  { value: "government", label: "Government Scheme" },
  { value: "self-funded", label: "Self-Funded" },
]

interface StepInsuranceProps {
  value: string
  onChange: (value: string) => void
}

export function StepInsurance({ value, onChange }: StepInsuranceProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Insurance Type</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your insurance type helps us match hospitals that accept your coverage.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="insurance-type">Coverage type</Label>
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id="insurance-type" className="h-12 rounded-xl">
            <SelectValue placeholder="Choose your insurance type" />
          </SelectTrigger>
          <SelectContent>
            {insuranceTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
