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
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { auth } from "@/lib/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { toast } from "sonner"

const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function PatientLoginPage() {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSuccess, setIsSuccess] = useState(false)

    const {
        register,
        handleSubmit,
        formState: { errors },
        setError,
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginFormValues) => {
        setIsSubmitting(true)
        try {
            if (!auth) {
                // For demo purposes, show a helpful message
                toast.error("Firebase authentication is not configured. Please set up Firebase credentials in .env.local")
                return
            }

            // 1. Sign in with Firebase
            const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password)
            const user = userCredential.user

            // 2. Fetch user role from internal API
            const response = await fetch(`/api/users/${user.uid}`)

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("User record not found in database.")
                }
                throw new Error("Failed to verify user role.")
            }

            const userData = await response.json()

            // 3. Verify role
            if (userData.role !== "patient") {
                // Sign out if role doesn't match to prevent unwanted access
                await auth.signOut()
                throw new Error("role-mismatch")
            }

            // 4. Create Session Cookie (Critical for Server Actions / API Routes)
            const idToken = await user.getIdToken();
            await fetch("/api/auth/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken }),
            });

            // Set user role cookie for middleware/persistence if needed
            document.cookie = `user-role=patient; path=/; max-age=${60 * 60 * 24 * 7}` // 7 days

            setIsSuccess(true)
            setTimeout(() => {
                router.push("/profile")
            }, 1000)

        } catch (error: any) {
            console.error("Login error:", error)
            let errorMessage = "Invalid email or password. Please try again."

            if (error.message === "role-mismatch") {
                errorMessage = "This account is not registered as a patient."
            } else if (error.code?.startsWith("auth/")) {
                if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
                    errorMessage = "Invalid email or password."
                } else if (error.code === "auth/network-request-failed") {
                    errorMessage = "Network error. Please check your connection."
                } else {
                    errorMessage = `Authentication error: ${error.code}`
                }
            } else if (error.message === "User record not found in database.") {
                errorMessage = "Account authenticated but profile not found. Please contact support."
            } else if (error.status === 500 || error.message.includes("establish session")) {
                errorMessage = "Server configuration error. Please check environment variables (Firebase Admin)."
            }

            toast.error(errorMessage)

            if (error.message === "role-mismatch") {
                // We don't necessarily want to highlight a field if it's a role issue, 
                // but toast covers it.
            }
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
                        <h1 className="text-2xl font-bold mb-2">Welcome Back!</h1>
                        <p className="text-muted-foreground mb-6">
                            Signing you into your patient account...
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
            <main className="flex-1 flex items-center justify-center p-4 py-12 bg-muted/30">
                <Card className="w-full max-w-md rounded-2xl border-border/60 shadow-lg bg-white">
                    <CardContent className="p-8">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => router.push("/login")}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>

                        <div className="mb-8">
                            <h1 className="text-3xl font-bold tracking-tight">Patient Sign In</h1>
                            <p className="text-sm text-muted-foreground mt-2 text-balance">
                                Sign in to your patient account to manage your treatments.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    <button
                                        type="button"
                                        className="text-xs font-medium text-primary hover:underline"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
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

                            <Button
                                type="submit"
                                className="w-full rounded-xl bg-primary h-11 text-base font-medium mt-6 transition-all active:scale-[0.98]"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Signing In...
                                    </>
                                ) : (
                                    "Sign In"
                                )}
                            </Button>

                            <p className="text-center text-sm text-muted-foreground mt-6">
                                New to MedDecision?{" "}
                                <button
                                    type="button"
                                    onClick={() => router.push("/signup/patient")}
                                    className="font-semibold text-primary hover:underline hover:underline-offset-4"
                                >
                                    Create account
                                </button>
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
