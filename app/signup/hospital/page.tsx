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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2, CheckCircle2, Building2, ShieldCheck, UserCog, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { auth } from "@/lib/firebase"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { toast } from "sonner"

const hospitalSchema = z.object({
    // Section 1: Basic Info
    hospitalName: z.string().min(3, "Hospital name is required"),
    address: z.string().min(5, "Address is required"),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    contactNumber: z.string().min(10, "Valid contact number required"),
    officialEmail: z.string().email("Invalid email address"),

    // Section 2: Accreditation
    licenseNumber: z.string().min(5, "License number is required"),
    accreditationType: z.string().min(1, "Select accreditation type"),
    yearEstablished: z.string().regex(/^\d{4}$/, "Must be a 4-digit year"),

    // Section 3: Administrator
    adminName: z.string().min(2, "Admin name is required"),
    adminEmail: z.string().email("Invalid admin email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),

    confirmAccuracy: z.literal(true, {
        errorMap: () => ({ message: "You must confirm accuracy to submit" }),
    }),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

type HospitalFormValues = z.infer<typeof hospitalSchema>

export default function HospitalSignUpPage() {
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
    } = useForm<HospitalFormValues>({
        resolver: zodResolver(hospitalSchema),
        mode: "onChange",
        defaultValues: {
            confirmAccuracy: false as unknown as true,
        }
    })

    const confirmValue = watch("confirmAccuracy")

    const onSubmit = async (data: HospitalFormValues) => {
        setIsSubmitting(true)
        try {
            if (!auth) {
                throw new Error("Authentication is not configured. Please check your environment variables.")
            }

            // 1. Create user in Firebase
            const userCredential = await createUserWithEmailAndPassword(auth, data.adminEmail, data.password)
            const user = userCredential.user

            // 2. Register in MongoDB via internal API
            const response = await fetch("/api/users/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    uid: user.uid,
                    role: "hospital",
                    hospitalName: data.hospitalName,
                    email: data.adminEmail,
                    contactNumber: data.contactNumber,
                    adminName: data.adminName,
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to register in database")
            }

            setIsSuccess(true)
            setTimeout(() => {
                router.push("/hospital/dashboard")
            }, 3000)
        } catch (error: any) {
            console.error("Hospital signup error:", error)
            let errorMessage = "An error occurred during enrollment. Please try again."

            if (error.code === "auth/email-already-in-use") {
                errorMessage = "This admin email is already registered."
                setError("adminEmail", { type: "manual", message: errorMessage })
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
                    <Card className="w-full max-w-lg rounded-2xl border-border/60 shadow-lg text-center p-12">
                        <div className="flex justify-center mb-6">
                            <div className="rounded-full bg-primary/10 p-3">
                                <CheckCircle2 className="h-16 w-16 text-primary" />
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold mb-3">Enrollment Submitted</h1>
                        <p className="text-muted-foreground mb-8 text-balance">
                            Thank you for enrolling. Our team will review your hospital information and contact you within 24-48 hours.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-primary font-medium">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Returning to homepage...</span>
                        </div>
                    </Card>
                </main>
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <Navbar />
            <main className="flex-1 flex items-center justify-center p-4 py-16">
                <Card className="w-full max-w-2xl rounded-2xl border-border/60 shadow-xl bg-white">
                    <CardContent className="p-8 sm:p-10">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 -ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={() => router.push("/signup-selection")}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                        </Button>

                        <div className="mb-10">
                            <h1 className="text-3xl font-bold tracking-tight">Hospital Enrollment</h1>
                            <p className="text-sm text-muted-foreground mt-2">
                                Join our network to provide transparent care options to patients.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-12">
                            {/* Section 1: Basic Information */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <Building2 className="h-4 w-4" />
                                    </div>
                                    <h2 className="text-lg font-semibold">Basic Information</h2>
                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="hospitalName">Hospital Name</Label>
                                        <Input
                                            id="hospitalName"
                                            placeholder="City Medical Center"
                                            className={cn("rounded-xl", errors.hospitalName && "border-destructive focus-visible:ring-destructive")}
                                            {...register("hospitalName")}
                                        />
                                        {errors.hospitalName && (
                                            <p className="text-xs font-medium text-destructive">{errors.hospitalName.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="address">Address</Label>
                                        <Input
                                            id="address"
                                            placeholder="123 Healthcare Way"
                                            className={cn("rounded-xl", errors.address && "border-destructive focus-visible:ring-destructive")}
                                            {...register("address")}
                                        />
                                        {errors.address && (
                                            <p className="text-xs font-medium text-destructive">{errors.address.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="city">City</Label>
                                        <Input
                                            id="city"
                                            placeholder="Mumbai"
                                            className={cn("rounded-xl", errors.city && "border-destructive focus-visible:ring-destructive")}
                                            {...register("city")}
                                        />
                                        {errors.city && (
                                            <p className="text-xs font-medium text-destructive">{errors.city.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="state">State</Label>
                                        <Input
                                            id="state"
                                            placeholder="Maharashtra"
                                            className={cn("rounded-xl", errors.state && "border-destructive focus-visible:ring-destructive")}
                                            {...register("state")}
                                        />
                                        {errors.state && (
                                            <p className="text-xs font-medium text-destructive">{errors.state.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="contactNumber">Contact Number</Label>
                                        <Input
                                            id="contactNumber"
                                            placeholder="+91 22 1234 5678"
                                            className={cn("rounded-xl", errors.contactNumber && "border-destructive focus-visible:ring-destructive")}
                                            {...register("contactNumber")}
                                        />
                                        {errors.contactNumber && (
                                            <p className="text-xs font-medium text-destructive">{errors.contactNumber.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="officialEmail">Official Email</Label>
                                        <Input
                                            id="officialEmail"
                                            placeholder="admin@hospital.com"
                                            className={cn("rounded-xl", errors.officialEmail && "border-destructive focus-visible:ring-destructive")}
                                            {...register("officialEmail")}
                                        />
                                        {errors.officialEmail && (
                                            <p className="text-xs font-medium text-destructive">{errors.officialEmail.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Accreditation */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <ShieldCheck className="h-4 w-4" />
                                    </div>
                                    <h2 className="text-lg font-semibold">Accreditation</h2>
                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="licenseNumber">License Number</Label>
                                        <Input
                                            id="licenseNumber"
                                            placeholder="HOSP-12345-IDX"
                                            className={cn("rounded-xl", errors.licenseNumber && "border-destructive focus-visible:ring-destructive")}
                                            {...register("licenseNumber")}
                                        />
                                        {errors.licenseNumber && (
                                            <p className="text-xs font-medium text-destructive">{errors.licenseNumber.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="accreditationType">Accreditation Type</Label>
                                        <Select onValueChange={(v) => setValue("accreditationType", v, { shouldValidate: true })}>
                                            <SelectTrigger className={cn("rounded-xl", errors.accreditationType && "border-destructive focus-visible:ring-destructive")}>
                                                <SelectValue placeholder="Select type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="nabh">NABH</SelectItem>
                                                <SelectItem value="jci">JCI</SelectItem>
                                                <SelectItem value="iso">ISO Certified</SelectItem>
                                                <SelectItem value="government">Government Verified</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        {errors.accreditationType && (
                                            <p className="text-xs font-medium text-destructive">{errors.accreditationType.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="yearEstablished">Year Established</Label>
                                        <Input
                                            id="yearEstablished"
                                            placeholder="1995"
                                            maxLength={4}
                                            className={cn("rounded-xl", errors.yearEstablished && "border-destructive focus-visible:ring-destructive")}
                                            {...register("yearEstablished")}
                                        />
                                        {errors.yearEstablished && (
                                            <p className="text-xs font-medium text-destructive">{errors.yearEstablished.message}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Admin Account */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                        <UserCog className="h-4 w-4" />
                                    </div>
                                    <h2 className="text-lg font-semibold">Administrator Account</h2>
                                </div>

                                <div className="grid gap-5 sm:grid-cols-2">
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="adminName">Admin Name</Label>
                                        <Input
                                            id="adminName"
                                            placeholder="Sr. Admin Officer"
                                            className={cn("rounded-xl", errors.adminName && "border-destructive focus-visible:ring-destructive")}
                                            {...register("adminName")}
                                        />
                                        {errors.adminName && (
                                            <p className="text-xs font-medium text-destructive">{errors.adminName.message}</p>
                                        )}
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="adminEmail">Admin Email</Label>
                                        <Input
                                            id="adminEmail"
                                            placeholder="admin@hospital-portal.com"
                                            className={cn("rounded-xl", errors.adminEmail && "border-destructive focus-visible:ring-destructive")}
                                            {...register("adminEmail")}
                                        />
                                        {errors.adminEmail && (
                                            <p className="text-xs font-medium text-destructive">{errors.adminEmail.message}</p>
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
                                </div>
                            </div>

                            {/* Bottom Actions */}
                            <div className="space-y-6 pt-4">
                                <div className="flex items-start gap-3">
                                    <Checkbox
                                        id="confirmAccuracy"
                                        className="mt-1 rounded-sm border-border"
                                        checked={confirmValue}
                                        onCheckedChange={(checked) => setValue("confirmAccuracy", checked as true, { shouldValidate: true })}
                                    />
                                    <Label
                                        htmlFor="confirmAccuracy"
                                        className="text-sm leading-relaxed text-muted-foreground font-normal cursor-pointer select-none"
                                    >
                                        I confirm that the provided information is accurate and I am authorized to register this facility.
                                    </Label>
                                </div>
                                {errors.confirmAccuracy && (
                                    <p className="text-xs font-medium text-destructive">{errors.confirmAccuracy.message}</p>
                                )}

                                <div className="flex flex-col items-center gap-4">
                                    <Button
                                        type="submit"
                                        className="w-full rounded-xl bg-primary h-12 text-base font-semibold transition-all active:scale-[0.98]"
                                        disabled={!isValid || isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            "Submit for Verification"
                                        )}
                                    </Button>

                                    <p className="text-center text-sm text-muted-foreground mt-4">
                                        Already enrolled?{" "}
                                        <button
                                            type="button"
                                            onClick={() => router.push("/login/hospital")}
                                            className="font-semibold text-primary hover:underline hover:underline-offset-4"
                                        >
                                            Sign In
                                        </button>
                                    </p>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}
