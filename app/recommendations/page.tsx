import type { Metadata } from "next"
import { Suspense } from "react"
import { TreatmentRecommendations } from "@/components/recommendations/treatment-recommendations"

export const metadata: Metadata = {
  title: "Hospital Recommendations - MedDecision",
  description:
    "View contextual hospital options ranked by suitability to your treatment needs, budget, and insurance.",
}

export default function RecommendationsPage() {
  return (
    <Suspense>
      <TreatmentRecommendations />
    </Suspense>
  )
}
