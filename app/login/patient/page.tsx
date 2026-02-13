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
    } = useForm<LoginFormValues>({
        resolver: zodResolver(loginSchema),
    })

    const onSubmit = async (data: LoginFormValues) => {
        setIsSubmitting(true)
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1500))

        // Set user role cookie
        document.cookie = "user-role=patient; path=/"

        setIsSubmitting(false)
        setIsSuccess(true)
        setTimeout(() => {
            router.push("/profile")
        }, 1500)
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
