import type { Metadata } from "next"
import { Suspense } from "react"
import { CostTransparencyDashboard } from "@/components/cost-dashboard/cost-transparency-dashboard"

export const metadata: Metadata = {
  title: "Cost Breakdown - MedDecision",
  description:
    "Transparent cost breakdown for your selected hospital and treatment path.",
}

export default function CostDashboardPage() {
  return (
    <Suspense>
      <CostTransparencyDashboard />
    </Suspense>
  )
}
