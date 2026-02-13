"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Navbar } from "@/components/navbar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { auth } from "@/lib/firebase"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { toast } from "sonner"

const patientSchema = z.object({
    fullName: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    understandDisclaimer: z.literal(true, {
        errorMap: () => ({ message: "You must understand the disclaimer to continue" }),
    }),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

type PatientFormValues = z.infer<typeof patientSchema>

export default function PatientSignUpPage() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors, isValid },
        setValue,
        setError,
        watch,
    } = useForm<PatientFormValues>({
        resolver: zodResolver(patientSchema),
        mode: "onChange",
        defaultValues: {
            understandDisclaimer: false as unknown as true,
        }
    })

    const understandValue = watch("understandDisclaimer")

    const onSubmit = async (data: PatientFormValues) => {
        setIsSubmitting(true)
        try {
            if (!auth) {
                throw new Error("Authentication is not configured. Please check your environment variables.")
            }
            // 1. Create user in Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password)
            const user = userCredential.user

            // 2. Register in MongoDB via internal API
            const response = await fetch("/api/users/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    uid: user.uid,
                    role: "patient",
                    fullName: data.fullName,
                    email: data.email,
                    phone: data.phone,
                }),
            })

            if (!response.ok) {
                // If the API call fails, we still have the user in Firebase, 
                // but for consistency we might want to handle this.
                // For now, we'll just throw an error.
                throw new Error("Failed to register in database")
            }

            setIsSuccess(true)
            setTimeout(() => {
                router.push("/profile")
            }, 2000)
        } catch (error: any) {
            console.error("Signup error:", error)
            let errorMessage = "An error occurred during registration. Please try again."

            if (error.code === "auth/email-already-in-use") {
                errorMessage = "This email is already registered."
                setError("email", { type: "manual", message: errorMessage })
            } else if (error.code === "auth/weak-password") {
                errorMessage = "The password is too weak."
                setError("password", { type: "manual", message: errorMessage })
            } else if (error.code === "auth/network-request-failed") {
                errorMessage = "Network error. Please check your connection."
            } else if (error.message === "Failed to register in database") {
                errorMessage = "Account created but database sync failed. Please contact support."
            }

            toast.error(errorMessage)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isSuccess) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <Navbar />
                <main className="flex-1 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md rounded-2xl border-border/60 shadow-lg text-center p-8">
                        <div className="flex justify-center mb-6">
                            <div className="rounded-full bg-primary/10 p-3">
                                <CheckCircle2 className="h-12 w-12 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Registration Successful!</h1>
                        <p className="text-muted-foreground mb-6">
                            Your patient account has been created. Redirecting you to your profile...
                        </p>
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </Card>
                </main>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex-1 flex items-center justify-center p-4 py-12">
                <Card className="w-full max-w-md rounded-2xl border-border/60 shadow-lg bg-white">
                    <CardContent className="p-8">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => router.push("/signup-selection")}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>

                        <div className="mb-8">
                            <h1 className="text-3xl font-bold tracking-tight">Patient Registration</h1>
                            <p className="text-sm text-muted-foreground mt-2 text-balance">
                                Join MedDecision to compare treatment options and find the best care.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    placeholder="John Doe"
                                    className={cn("rounded-xl", errors.fullName && "border-destructive focus-visible:ring-destructive")}
                                    {...register("fullName")}
                                />
                                {errors.fullName && (
                                    <p className="text-xs font-medium text-destructive">{errors.fullName.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john@example.com"
                                    className={cn("rounded-xl", errors.email && "border-destructive focus-visible:ring-destructive")}
                                    {...register("email")}
                                />
                                {errors.email && (
                                    <p className="text-xs font-medium text-destructive">{errors.email.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone Number</Label>
                                <Input
                                    id="phone"
                                    placeholder="+91 98765 43210"
                                    className={cn("rounded-xl", errors.phone && "border-destructive focus-visible:ring-destructive")}
                                    {...register("phone")}
                                />
                                {errors.phone && (
                                    <p className="text-xs font-medium text-destructive">{errors.phone.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    className={cn("rounded-xl", errors.password && "border-destructive focus-visible:ring-destructive")}
                                    {...register("password")}
                                />
                                {errors.password && (
                                    <p className="text-xs font-medium text-destructive">{errors.password.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    className={cn("rounded-xl", errors.confirmPassword && "border-destructive focus-visible:ring-destructive")}
                                    {...register("confirmPassword")}
                                />
                                {errors.confirmPassword && (
                                    <p className="text-xs font-medium text-destructive">{errors.confirmPassword.message}</p>
                                )}
                            </div>

                            <div className="flex items-start gap-3 pt-2">
                                <Checkbox
                                    id="understandDisclaimer"
                                    className="mt-1 rounded-sm border-border"
                                    checked={understandValue}
                                    onCheckedChange={(checked) => setValue("understandDisclaimer", checked as true, { shouldValidate: true })}
                                />
                                <Label
                                    htmlFor="understandDisclaimer"
                                    className="text-xs leading-relaxed text-muted-foreground font-normal cursor-pointer select-none"
                                >
                                    I understand this platform provides decision support, not medical advice.
                                </Label>
                            </div>
                            {errors.understandDisclaimer && (
                                <p className="text-xs font-medium text-destructive">{errors.understandDisclaimer.message}</p>
                            )}

                            <Button
                                type="submit"
                                className="w-full rounded-xl bg-primary h-11 text-base font-medium mt-4 lg:mt-6 transition-all active:scale-[0.98]"
                                disabled={!isValid || isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creating Account...
                                    </>
                                ) : (
                                    "Create Patient Account"
                                )}
                            </Button>

                            <p className="text-center text-sm text-muted-foreground mt-4">
                                Already have an account?{" "}
                                <button
                                    type="button"
                                    onClick={() => router.push("/login/patient")}
                                    className="font-semibold text-primary hover:underline hover:underline-offset-4"
                                >
                                    Sign In
                                </button>
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
