"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { User, Building2, Check, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AccountType = "patient" | "hospital" | null

export default function SignUpSelectionPage() {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<AccountType>(null)

  const handleContinue = () => {
    if (selectedType === "patient") {
      router.push("/signup/patient")
    } else if (selectedType === "hospital") {
      router.push("/signup/hospital")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-2xl rounded-2xl border-border/60 bg-white shadow-lg overflow-hidden">
        <CardContent className="p-8 sm:p-12">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Create Your Account
            </h1>
            <p className="mt-3 text-base text-muted-foreground">
              Choose how you want to use the platform.
            </p>
          </div>

          {/* Selection Cards */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Patient Card */}
            <button
              onClick={() => setSelectedType("patient")}
              className={cn(
                "group relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-md",
                selectedType === "patient"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/60 bg-card hover:border-primary/30"
              )}
            >
              <div className={cn(
                "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-300",
                selectedType === "patient"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                <User className="h-8 w-8" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">Patient Account</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Compare treatment options and find suitable hospitals.
                </p>
              </div>
              {selectedType === "patient" && (
                <div className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>

            {/* Hospital Card */}
            <button
              onClick={() => setSelectedType("hospital")}
              className={cn(
                "group relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-md",
                selectedType === "hospital"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/60 bg-card hover:border-primary/30"
              )}
            >
              <div className={cn(
                "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-300",
                selectedType === "hospital"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                <Building2 className="h-8 w-8" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">Hospital Account</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Register your hospital and manage capacity, pricing, and infrastructure data.
                </p>
              </div>
              {selectedType === "hospital" && (
                <div className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>
          </div>

          {/* Action Button */}
          <div className="mt-12 flex flex-col items-center gap-4">
            <Button
              onClick={handleContinue}
              disabled={!selectedType}
              className="h-12 w-full max-w-xs rounded-xl bg-primary text-base font-medium transition-all duration-300 hover:bg-primary/90"
            >
              Continue
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                onClick={() => router.push("/login")}
                className="font-medium text-primary hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
