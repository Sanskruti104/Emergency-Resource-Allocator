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
import { ArrowLeft, Loader2, Building2, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { auth } from "@/lib/firebase"
import { signInWithEmailAndPassword } from "firebase/auth"
import { toast } from "sonner"

const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function HospitalLoginPage() {
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

            // 2. Get ID Token
            const idToken = await user.getIdToken()

            // 3. Call Session API to set secure cookies
            const sessionResponse = await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
            })

            if (!sessionResponse.ok) {
                const errorData = await sessionResponse.json()
                throw new Error(errorData.error || "Failed to establish session.")
            }

            const sessionData = await sessionResponse.json()
            const { role } = sessionData;
            console.log("Login session response:", sessionData);

            // 4. Verify role double check (though API already does it)
            if (role !== "hospital") {
                await fetch('/api/auth/session', { method: 'DELETE' })
                await auth.signOut()
                throw new Error(`role-mismatch:${role}`)
            }

            setIsSuccess(true)
            setTimeout(() => {
                router.push("/hospital/dashboard")
            }, 1500)

        } catch (error: any) {
            console.error("Login error:", error)
            let errorMessage = "Invalid email or password. Please try again."

            if (error.message.startsWith("role-mismatch")) {
                const foundRole = error.message.split(":")[1] || "unknown";
                errorMessage = `This account is registered as a ${foundRole}, not a hospital.`
            }
            else if (error.code?.startsWith("auth/")) {
                if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
                    errorMessage = "Invalid email or password."
                } else if (error.code === "auth/network-request-failed") {
                    errorMessage = "Network error. Please check your connection."
                } else {
                    errorMessage = `Authentication error: ${error.code}`
                }
            } else if (error.message === "User record not found in database.") {
                errorMessage = "Account authenticated but profile not found. Please contact support."
            } else if (error.message.includes("establish session") || error.message.includes("500")) {
                errorMessage = "Server configuration error. Please check environment variables (Firebase Admin)."
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
                        <h1 className="text-2xl font-bold mb-2">Welcome Back!</h1>
                        <p className="text-muted-foreground mb-6">
                            Signing you into the Hospital Admin dashboard...
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
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                                <Building2 className="h-6 w-6" />
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight">Hospital Sign In</h1>
                            <p className="text-sm text-muted-foreground mt-2 text-balance">
                                Access your hospital dashboard to manage capacity and treatment data.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Work Email Address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="admin@hospital.com"
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
                                        Verifying Credentials...
                                    </>
                                ) : (
                                    "Sign In"
                                )}
                            </Button>

                            <p className="text-center text-sm text-muted-foreground mt-6">
                                Not enrolled with MedDecision?{" "}
                                <button
                                    type="button"
                                    onClick={() => router.push("/signup/hospital")}
                                    className="font-semibold text-primary hover:underline hover:underline-offset-4"
                                >
                                    Enroll Hospital
                                </button>
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
