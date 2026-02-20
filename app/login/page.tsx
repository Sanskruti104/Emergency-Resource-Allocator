"use client"

import { useRouter } from "next/navigation"
import { User, Building2, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Navbar } from "@/components/navbar"

export default function LoginSelectionPage() {
    const router = useRouter()

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex-1 flex items-center justify-center p-4 py-12 bg-muted/30">
                <Card className="w-full max-w-2xl rounded-2xl border-border/60 bg-white shadow-lg overflow-hidden">
                    <CardContent className="p-8 sm:p-12">
                        {/* Header */}
                        <div className="mb-10 text-center">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                Sign In
                            </h1>
                            <p className="mt-3 text-base text-muted-foreground">
                                Choose your account type to continue.
                            </p>
                        </div>

                        {/* Selection Cards */}
                        <div className="grid gap-6 sm:grid-cols-2">
                            {/* Patient Card */}
                            <button
                                onClick={() => router.push("/login/patient")}
                                className={cn(
                                    "group relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-md border-border/60 bg-card hover:border-primary/30"
                                )}
                            >
                                <div className={cn(
                                    "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-300 bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                )}>
                                    <User className="h-8 w-8" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold text-foreground">Patient Login</h3>
                                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                                        Access your treatment plans and recommendations.
                                    </p>
                                </div>
                                <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    Enter Patient Portal <ArrowRight className="ml-1 h-4 w-4" />
                                </div>
                            </button>

                            {/* Hospital Card */}
                            <button
                                onClick={() => router.push("/login/hospital")}
                                className={cn(
                                    "group relative flex flex-col items-center gap-4 rounded-2xl border-2 p-8 transition-all duration-300 hover:scale-[1.02] hover:shadow-md border-border/60 bg-card hover:border-primary/30"
                                )}
                            >
                                <div className={cn(
                                    "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-300 bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                                )}>
                                    <Building2 className="h-8 w-8" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold text-foreground">Hospital Login</h3>
                                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                                        Manage your hospital's profile and data.
                                    </p>
                                </div>
                                <div className="mt-4 flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    Enter Admin Dashboard <ArrowRight className="ml-1 h-4 w-4" />
                                </div>
                            </button>
                        </div>

                        {/* Action Button */}
                        <div className="mt-12 text-center">
                            <p className="text-sm text-muted-foreground">
                                Don't have an account?{" "}
                                <button
                                    onClick={() => router.push("/signup-selection")}
                                    className="font-medium text-primary hover:underline"
                                >
                                    Create one now
                                </button>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
