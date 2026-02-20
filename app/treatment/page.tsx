import type { Metadata } from "next"
import { Suspense } from "react"
import { TreatmentPathSelection } from "@/components/treatment/treatment-path-selection"

export const metadata: Metadata = {
  title: "Treatment Approaches - MedDecision",
  description:
    "Explore available treatment approaches based on your profile. Compare conservative, minimally invasive, and surgical options.",
}

export default function TreatmentPage() {
  return (
    <Suspense>
      <TreatmentPathSelection />
    </Suspense>
  )
}
