"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthInput } from "@/components/auth/auth-input"
import { PasswordInput } from "@/components/auth/password-input"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, AlertCircle, Mail, Shield } from "lucide-react"
import { toast } from "sonner"

const patientLoginSchema = z.object({
    email: z
        .string()
        .min(1, "Email address is required")
        .email("Please enter a valid email address"),
    password: z
        .string()
        .min(1, "Password is required"),
})

type PatientLoginValues = z.infer<typeof patientLoginSchema>

export default function PatientLoginPage() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [serverError, setServerError] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<PatientLoginValues>({
        resolver: zodResolver(patientLoginSchema),
        mode: "onBlur",
        defaultValues: {
            email: "",
            password: "",
        },
    })

    const onSubmit = async (data: PatientLoginValues) => {
        setIsSubmitting(true)
        setServerError(null)

        try {
            // Authenticate directly against MongoDB endpoint with expectedRole: 'patient'
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: data.email.toLowerCase().trim(),
                    password: data.password,
                    expectedRole: "patient",
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                let friendlyMessage = "Please check your email and password."

                if (result.error === "role-mismatch" || result.message?.includes("patient")) {
                    friendlyMessage = "This account is not registered as a patient."
                } else if (result.error && typeof result.error === "string") {
                    friendlyMessage = result.error
                }

                setServerError(friendlyMessage)
                toast.error(friendlyMessage)
                return
            }

            // Success state
            setIsSuccess(true)
            toast.success("Signed in successfully!")
            setTimeout(() => {
                router.push("/profile")
            }, 1000)
        } catch (error: any) {
            console.error("Patient login network error:", error)
            const fallbackMessage = "Network error. Please verify your connection and try again."
            setServerError(fallbackMessage)
            toast.error(fallbackMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <AuthShell mode="login">
            {isSuccess ? (
                <div
                    className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 text-center space-y-5 animate-in fade-in-50 duration-300"
                    role="status"
                    aria-live="polite"
                >
                    <div className="mx-auto h-14 w-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-sm">
                        <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                    </div>
                    <div className="space-y-1.5">
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                            Authentication Verified
                        </h2>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                            Signing you into your patient portal. Redirecting to your active treatments and profiles...
                        </p>
                    </div>
                    <div className="pt-2 flex justify-center items-center gap-2 text-xs font-medium text-teal-700">
                        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                        <span>Loading clinical context...</span>
                    </div>
                </div>
            ) : (
                <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 md:p-10">
                    {/* Header */}
                    <div className="mb-6 text-left space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200/60 mb-1">
                            <Shield className="h-3 w-3" />
                            Secure Patient Sign In
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                            Welcome back
                        </h1>
                        <p className="text-sm text-slate-500">
                            Sign in to continue to your MedDecision account.
                        </p>
                    </div>

                    {/* Server Error Alert */}
                    {serverError && (
                        <div
                            className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-xs leading-relaxed"
                            role="alert"
                        >
                            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <span className="font-semibold block">Authentication Error</span>
                                {serverError}
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                        {/* 1. Email Address */}
                        <AuthInput
                            label="Email Address"
                            id="email"
                            type="email"
                            placeholder="jane@example.com"
                            icon={<Mail className="h-4 w-4" />}
                            error={errors.email?.message}
                            autoComplete="email"
                            disabled={isSubmitting}
                            {...register("email")}
                        />

                        {/* 2. Password with Show/Hide */}
                        <div>
                            <PasswordInput
                                label="Password"
                                id="password"
                                placeholder="Enter your password"
                                error={errors.password?.message}
                                autoComplete="current-password"
                                disabled={isSubmitting}
                                {...register("password")}
                            />
                        </div>

                        {/* Submit CTA */}
                        <div className="pt-2">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full h-11 rounded-xl bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-medium text-sm transition-all duration-150 shadow-sm hover:shadow focus-visible:ring-4 focus-visible:ring-teal-500/20"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                        <span>Signing in...</span>
                                    </>
                                ) : (
                                    <span>Sign in</span>
                                )}
                            </Button>
                        </div>
                    </form>

                    {/* Secondary Navigation */}
                    <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-500">
                            New to MedDecision?{" "}
                            <Link
                                href="/signup/patient"
                                className="font-semibold text-teal-600 hover:text-teal-700 hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                            >
                                Create a patient account
                            </Link>
                        </p>
                    </div>
                </div>
            )}
        </AuthShell>
    )
}
