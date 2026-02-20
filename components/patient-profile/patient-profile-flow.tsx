"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { StepBasicContext } from "./step-basic-context"
import { StepTreatmentContext } from "./step-treatment-context"
import { StepFinancialContext } from "./step-financial-context"
import { StepPreferences } from "./step-preferences"

const TOTAL_STEPS = 4

const stepLabels = [
  "Basic Context",
  "Treatment Context",
  "Financial & Insurance",
  "Preferences",
]

interface FormData {
  // Step 1
  ageGroup: string
  city: string
  travelCapability: string
  // Step 2
  diagnosisCategory: string
  conditionKey: string
  urgency: string
  timeline: string
  // Step 3
  budgetMin: number
  budgetMax: number
  insuranceType: string
  governmentScheme: string
  // Step 4
  roomPreference: string
  icuRequirement: boolean
  languagePreference: string
}

export function PatientProfileFlow() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [formData, setFormData] = useState<FormData>({
    ageGroup: "",
    city: "",
    travelCapability: "",
    diagnosisCategory: "",
    conditionKey: "",
    urgency: "",
    timeline: "",
    budgetMin: 5000,
    budgetMax: 10000,
    insuranceType: "",
    governmentScheme: "",
    roomPreference: "",
    icuRequirement: false,
    languagePreference: "",
  })

  // Fetch existing profile on mount
  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/patient/profile")
        if (res.ok) {
          const data = await res.json()
          if (data.found && data.profile) {
            setFormData(prev => ({ ...prev, ...data.profile }))
          }
        }
      } catch (error) {
        console.error("Failed to fetch profile", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProfile()
  }, [])

  const progressValue = (currentStep / TOTAL_STEPS) * 100

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const canContinue = useCallback(() => {
    switch (currentStep) {
      case 1:
        return !!formData.ageGroup && !!formData.city && !!formData.travelCapability
      case 2:
        return !!formData.diagnosisCategory && !!formData.urgency && !!formData.timeline
      case 3:
        return !!formData.insuranceType // Budget has defaults, Scheme is optional
      case 4:
        return !!formData.roomPreference // Others are optional/boolean
      default:
        return false
    }
  }, [currentStep, formData])

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS && canContinue()) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSubmit = async () => {
    if (!canContinue()) return

    setIsSubmitting(true)
    try {
      console.log("Submitting Profile Data:", formData);
      const res = await fetch("/api/patient/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const result = await res.json();
      console.log("Submission Result:", result);

      if (!res.ok) {
        throw new Error(result.error || "Failed to save profile")
      }

      toast.success("Profile saved successfully")

      // Redirect to treatment path or dashboard
      // For now, let's redirect to a hypothetical treatment path page
      // or just force a refresh to show saved state
      router.push("/treatment-path")

    } catch (error: any) {
      toast.error(error.message || "Something went wrong. Please try again.")
      console.error("Profile Submission Error:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Step indicator */}
        <div className="mb-8 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <span className="text-sm font-medium text-primary">
              {stepLabels[currentStep - 1]}
            </span>
          </div>
          <Progress value={progressValue} className="h-2 w-full" />
        </div>

        {/* Main card */}
        <Card className="rounded-2xl border-border/60 shadow-lg overflow-hidden">
          <CardContent className="p-6 sm:p-10">
            <div className="min-h-[300px]">
              {currentStep === 1 && (
                <StepBasicContext formData={formData} onChange={handleFieldChange} />
              )}
              {currentStep === 2 && (
                <StepTreatmentContext formData={formData} onChange={handleFieldChange} />
              )}
              {currentStep === 3 && (
                <StepFinancialContext formData={formData} onChange={handleFieldChange} />
              )}
              {currentStep === 4 && (
                <StepPreferences formData={formData} onChange={handleFieldChange} />
              )}
            </div>

            {/* Navigation buttons */}
            <div className="mt-10 flex items-center justify-between gap-4 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1 || isSubmitting}
                className="h-12 px-6 rounded-xl"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {currentStep < TOTAL_STEPS ? (
                <Button
                  onClick={handleNext}
                  disabled={!canContinue()}
                  className="h-12 px-8 rounded-xl"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canContinue() || isSubmitting}
                  className="h-12 px-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Complete Profile
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <p className="mt-6 text-center text-xs text-muted-foreground max-w-md mx-auto">
          Your information is used securely to match you with the best treatment options.
          We prioritize your privacy and do not share data without consent.
        </p>
      </div>
    </div>
  )
}
