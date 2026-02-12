"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { StepAgeGroup } from "./step-age-group"
import { StepDiagnosis } from "./step-diagnosis"
import { StepUrgency } from "./step-urgency"
import { StepBudget } from "./step-budget"
import { StepInsurance } from "./step-insurance"

const TOTAL_STEPS = 5

const stepLabels = [
  "Age Group",
  "Diagnosis",
  "Urgency",
  "Budget",
  "Insurance",
]

interface FormData {
  ageGroup: string
  diagnosis: string
  urgency: string
  budget: number[]
  insurance: string
}

export function PatientProfileFlow() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [direction, setDirection] = useState<"forward" | "backward">("forward")
  const [isAnimating, setIsAnimating] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    ageGroup: "",
    diagnosis: "",
    urgency: "",
    budget: [200000, 1000000],
    insurance: "",
  })

  const progressValue = (currentStep / TOTAL_STEPS) * 100

  const canContinue = useCallback(() => {
    switch (currentStep) {
      case 1:
        return formData.ageGroup !== ""
      case 2:
        return formData.diagnosis !== ""
      case 3:
        return formData.urgency !== ""
      case 4:
        return true
      case 5:
        return formData.insurance !== ""
      default:
        return false
    }
  }, [currentStep, formData])

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS && canContinue()) {
      setDirection("forward")
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1)
        setIsAnimating(false)
      }, 150)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setDirection("backward")
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1)
        setIsAnimating(false)
      }, 150)
    }
  }

  const handleSubmit = () => {
    const params = new URLSearchParams({
      age: formData.ageGroup,
      diagnosis: formData.diagnosis,
      urgency: formData.urgency,
      budgetMin: formData.budget[0].toString(),
      budgetMax: formData.budget[1].toString(),
      insurance: formData.insurance,
    })
    router.push(`/treatment?${params.toString()}`)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Step {currentStep} of {TOTAL_STEPS}
            </span>
            <span className="text-sm font-medium text-primary">
              {stepLabels[currentStep - 1]}
            </span>
          </div>
          <Progress value={progressValue} className="h-2" />
          {/* Step dots */}
          <div className="flex items-center justify-between px-1">
            {stepLabels.map((label, index) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    index + 1 < currentStep && "bg-primary text-primary-foreground",
                    index + 1 === currentStep && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                    index + 1 > currentStep && "bg-secondary text-muted-foreground"
                  )}
                >
                  {index + 1 < currentStep ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    index + 1
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main card */}
        <Card className="rounded-2xl border-border/60 shadow-lg">
          <CardContent className="p-8">
            <div
              className={cn(
                "transition-all duration-150 ease-in-out",
                isAnimating && direction === "forward" && "translate-x-4 opacity-0",
                isAnimating && direction === "backward" && "-translate-x-4 opacity-0",
                !isAnimating && "translate-x-0 opacity-100"
              )}
            >
              {currentStep === 1 && (
                <StepAgeGroup
                  value={formData.ageGroup}
                  onChange={(v) => setFormData((prev) => ({ ...prev, ageGroup: v }))}
                />
              )}
              {currentStep === 2 && (
                <StepDiagnosis
                  value={formData.diagnosis}
                  onChange={(v) => setFormData((prev) => ({ ...prev, diagnosis: v }))}
                />
              )}
              {currentStep === 3 && (
                <StepUrgency
                  value={formData.urgency}
                  onChange={(v) => setFormData((prev) => ({ ...prev, urgency: v }))}
                />
              )}
              {currentStep === 4 && (
                <StepBudget
                  value={formData.budget}
                  onChange={(v) => setFormData((prev) => ({ ...prev, budget: v }))}
                />
              )}
              {currentStep === 5 && (
                <StepInsurance
                  value={formData.insurance}
                  onChange={(v) => setFormData((prev) => ({ ...prev, insurance: v }))}
                />
              )}
            </div>

            {/* Navigation buttons */}
            <div className="mt-8 flex items-center justify-between gap-3">
              <Button
                variant="secondary"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="h-11 rounded-xl px-6"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              {currentStep < TOTAL_STEPS ? (
                <Button
                  onClick={handleNext}
                  disabled={!canContinue()}
                  className="h-11 rounded-xl px-8"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!canContinue()}
                  className="h-11 rounded-xl bg-accent px-8 text-accent-foreground hover:bg-accent/90"
                >
                  <Check className="mr-2 h-4 w-4" />
                  Submit Profile
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Your information is used only for treatment matching. We do not store personal health records.
        </p>
      </div>
    </div>
  )
}
