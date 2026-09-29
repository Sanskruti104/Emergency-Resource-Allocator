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
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CheckCircle2, AlertCircle, User, Mail, Phone, Shield } from "lucide-react"
import { toast } from "sonner"

const patientSignupSchema = z
    .object({
        fullName: z
            .string()
            .min(2, "Full name must be at least 2 characters")
            .max(70, "Full name must be under 70 characters"),
        email: z
            .string()
            .email("Please enter a valid email address (e.g. name@example.com)")
            .min(5, "Email is required"),
        phone: z
            .string()
            .min(10, "Phone number must be at least 10 digits")
            .regex(/^[0-9+\s\-()]+$/, "Please enter a valid phone number format"),
        password: z
            .string()
            .min(8, "Password must be at least 8 characters long"),
        confirmPassword: z.string().min(1, "Please confirm your password"),
        understandDisclaimer: z.literal(true, {
            errorMap: () => ({ message: "You must acknowledge the clinical disclaimer to proceed" }),
        }),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    })

type PatientSignupValues = z.infer<typeof patientSignupSchema>

export default function PatientSignUpPage() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)
    const [serverError, setServerError] = useState<string | null>(null)

    const {
        register,
        handleSubmit,
        formState: { errors },
        setValue,
        setError,
        watch,
    } = useForm<PatientSignupValues>({
        resolver: zodResolver(patientSignupSchema),
        mode: "onBlur",
        defaultValues: {
            fullName: "",
            email: "",
            phone: "",
            password: "",
            confirmPassword: "",
            understandDisclaimer: false as unknown as true,
        },
    })

    const passwordValue = watch("password") || ""
    const confirmPasswordValue = watch("confirmPassword") || ""
    const disclaimerValue = watch("understandDisclaimer")

    const passwordMatchStatus =
        confirmPasswordValue.length > 0
            ? passwordValue === confirmPasswordValue
                ? "match"
                : "mismatch"
            : "idle"

    const onSubmit = async (data: PatientSignupValues) => {
        setIsSubmitting(true)
        setServerError(null)

        try {
            // Patient registration strictly via MongoDB authentication endpoint
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    fullName: data.fullName.trim(),
                    email: data.email.toLowerCase().trim(),
                    phone: data.phone.trim(),
                    password: data.password,
                    role: "patient",
                }),
            })

            const result = await response.json()

            if (!response.ok) {
                if (
                    response.status === 409 ||
                    result.error?.toLowerCase().includes("already registered") ||
                    result.error?.toLowerCase().includes("already in use")
                ) {
                    const message = "An account with this email already exists."
                    setError("email", { type: "manual", message })
                    setServerError("This email address is already registered. Please sign in or use another email.")
                    toast.error(message)
                    return
                }

                const errorMessage = result.error || "Unable to complete registration. Please check your details."
                setServerError(errorMessage)
                toast.error(errorMessage)
                return
            }

            // Success state
            setIsSuccess(true)
            toast.success("Account created successfully!")
            setTimeout(() => {
                router.push("/profile")
            }, 1500)
        } catch (error: any) {
            console.error("Patient signup network error:", error)
            const fallbackMessage = "Network error. Please verify your connection and try again."
            setServerError(fallbackMessage)
            toast.error(fallbackMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <AuthShell mode="signup">
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
                            Account Created Successfully
                        </h2>
                        <p className="text-sm text-slate-500 max-w-sm mx-auto">
                            Welcome to MedDecision. Initializing your secure session and redirecting to your clinical profile...
                        </p>
                    </div>
                    <div className="pt-2 flex justify-center items-center gap-2 text-xs font-medium text-teal-700">
                        <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                        <span>Securing clinical workspace...</span>
                    </div>
                </div>
            ) : (
                <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-8 md:p-10">
                    {/* Header */}
                    <div className="mb-6 text-left space-y-1">
                        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200/60 mb-1">
                            <Shield className="h-3 w-3" />
                            Patient Portal Access
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                            Create your patient account
                        </h1>
                        <p className="text-sm text-slate-500">
                            Enter your details to get started with MedDecision.
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
                                <span className="font-semibold block">Registration Error</span>
                                {serverError}
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                        {/* 1. Full Name */}
                        <AuthInput
                            label="Full Name"
                            id="fullName"
                            type="text"
                            placeholder="e.g. Jane Doe"
                            icon={<User className="h-4 w-4" />}
                            error={errors.fullName?.message}
                            autoComplete="name"
                            disabled={isSubmitting}
                            {...register("fullName")}
                        />

                        {/* 2. Email Address */}
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

                        {/* 3. Phone Number */}
                        <AuthInput
                            label="Phone Number"
                            id="phone"
                            type="tel"
                            placeholder="+91 98765 43210"
                            icon={<Phone className="h-4 w-4" />}
                            error={errors.phone?.message}
                            autoComplete="tel"
                            disabled={isSubmitting}
                            helperText="Used for critical facility notifications and care updates."
                            {...register("phone")}
                        />

                        {/* 4. Password */}
                        <PasswordInput
                            label="Password"
                            id="password"
                            placeholder="At least 8 characters"
                            showStrength={true}
                            error={errors.password?.message}
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            {...register("password")}
                        />

                        {/* 5. Confirm Password */}
                        <PasswordInput
                            label="Confirm Password"
                            id="confirmPassword"
                            placeholder="Re-enter your password"
                            matchStatus={passwordMatchStatus}
                            error={errors.confirmPassword?.message}
                            autoComplete="new-password"
                            disabled={isSubmitting}
                            {...register("confirmPassword")}
                        />

                        {/* Clinical Disclaimer Checkbox */}
                        <div className="pt-2">
                            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                                <Checkbox
                                    id="understandDisclaimer"
                                    checked={disclaimerValue === true}
                                    onCheckedChange={(checked) =>
                                        setValue("understandDisclaimer", checked === true ? true : (false as unknown as true), {
                                            shouldValidate: true,
                                        })
                                    }
                                    disabled={isSubmitting}
                                    className="mt-0.5 rounded border-slate-300 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 focus-visible:ring-teal-500"
                                    aria-describedby="disclaimer-label"
                                />
                                <label
                                    id="disclaimer-label"
                                    htmlFor="understandDisclaimer"
                                    className="text-xs text-slate-600 leading-relaxed select-none cursor-pointer"
                                >
                                    I understand that MedDecision provides intelligent decision support and clinical resource coordination, not emergency medical advice.
                                </label>
                            </div>
                            {errors.understandDisclaimer && (
                                <p className="text-xs font-medium text-rose-600 flex items-center gap-1 pt-1.5" role="alert">
                                    <span className="inline-block h-1 w-1 rounded-full bg-rose-600" />
                                    {errors.understandDisclaimer.message}
                                </p>
                            )}
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
                                        <span>Creating account...</span>
                                    </>
                                ) : (
                                    <span>Create account</span>
                                )}
                            </Button>
                        </div>
                    </form>

                    {/* Secondary Navigation */}
                    <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-500">
                            Already have an account?{" "}
                            <Link
                                href="/login/patient"
                                className="font-semibold text-teal-600 hover:text-teal-700 hover:underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            )}
        </AuthShell>
    )
}
