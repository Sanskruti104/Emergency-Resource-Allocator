import type { Metadata } from "next"
import { PatientProfileFlow } from "@/components/patient-profile/patient-profile-flow"

export const metadata: Metadata = {
  title: "Patient Profile - MedDecision",
  description:
    "Complete your treatment planning questionnaire to receive personalized hospital and treatment recommendations.",
}

export default function ProfilePage() {
  return <PatientProfileFlow />
}
