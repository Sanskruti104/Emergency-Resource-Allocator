"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2, Save, Building2, MapPin, Phone, Award, ShieldCheck } from "lucide-react"

const profileSchema = z.object({
    hospitalName: z.string().min(3, "Hospital name must be at least 3 characters"),
    address: z.string().min(5, "Address must be at least 5 characters"),
    city: z.string().min(2, "City is required"),
    state: z.string().min(2, "State is required"),
    contactNumber: z.string().min(10, "Valid contact number is required"),
    accreditationType: z.string().min(2, "Accreditation type is required"),
    licenseNumber: z.string().min(5, "License number is required"),
    insuranceAccepted: z.string().optional(), // We'll process this as an array
    governmentSchemes: z.string().optional(), // We'll process this as an array
})

type ProfileFormValues = z.infer<typeof profileSchema>

export default function HospitalProfilePage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [isNewProfile, setIsNewProfile] = useState(false)

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<ProfileFormValues>({
        resolver: zodResolver(profileSchema),
    })

    useEffect(() => {
        async function fetchProfile() {
            try {
                const response = await fetch("/api/hospital/profile")
                if (!response.ok) {
                    const text = await response.text();
                    console.error(`Fetch profile failed (${response.status}):`, text.substring(0, 100));
                    throw new Error(`Failed to load profile data: ${response.status}`);
                }
                const data = await response.json()

                if (data.isNew) {
                    setIsNewProfile(true)
                } else {
                    // Convert arrays to comma-separated strings for the form
                    reset({
                        ...data,
                        insuranceAccepted: data.insuranceAccepted?.join(", ") || "",
                        governmentSchemes: data.governmentSchemes?.join(", ") || "",
                    })
                }
            } catch (error: any) {
                console.error("Profile fetch error:", error);
                toast.error(error.message || "Failed to load profile data")
            } finally {
                setIsLoading(false)
            }
        }
        fetchProfile()
    }, [reset])

    const onSubmit = async (data: ProfileFormValues) => {
        setIsSaving(true)
        try {
            const payload = {
                ...data,
                insuranceAccepted: data.insuranceAccepted ? data.insuranceAccepted.split(",").map(i => i.trim()).filter(Boolean) : [],
                governmentSchemes: data.governmentSchemes ? data.governmentSchemes.split(",").map(i => i.trim()).filter(Boolean) : [],
            }

            const method = isNewProfile ? "POST" : "PUT"
            const response = await fetch("/api/hospital/profile", {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to save profile: ${response.status}`)
            }

            toast.success(isNewProfile ? "Profile created successfully!" : "Profile updated successfully!")
            setIsNewProfile(false)
            router.refresh()
        } catch (error: any) {
            console.error("Save profile error:", error);
            toast.error(error.message || "An error occurred while saving profile")
        } finally {
            setIsSaving(false)
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Hospital Profile</h1>
                <p className="text-muted-foreground mt-1">Manage your institution's public information and certifications.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b">
                        <div className="flex items-center gap-2">
                            <Building2 className="h-5 w-5 text-primary" />
                            <CardTitle>Basic Information</CardTitle>
                        </div>
                        <CardDescription>Official name and contact details of the hospital.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 grid gap-6 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="hospitalName">Hospital Name</Label>
                            <Input id="hospitalName" {...register("hospitalName")} className="rounded-xl" placeholder="E.g. City General Hospital" />
                            {errors.hospitalName && <p className="text-xs text-destructive">{errors.hospitalName.message}</p>}
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="address">Full Address</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="address" {...register("address")} className="pl-9 rounded-xl" placeholder="123 Health St, Medical District" />
                            </div>
                            {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="city">City</Label>
                            <Input id="city" {...register("city")} className="rounded-xl" placeholder="Mumbai" />
                            {errors.city && <p className="text-xs text-destructive">{errors.city.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="state">State</Label>
                            <Input id="state" {...register("state")} className="rounded-xl" placeholder="Maharashtra" />
                            {errors.state && <p className="text-xs text-destructive">{errors.state.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactNumber">Contact Number</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input id="contactNumber" {...register("contactNumber")} className="pl-9 rounded-xl" placeholder="+91 98765 43210" />
                            </div>
                            {errors.contactNumber && <p className="text-xs text-destructive">{errors.contactNumber.message}</p>}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b">
                        <div className="flex items-center gap-2">
                            <Award className="h-5 w-5 text-primary" />
                            <CardTitle>Accreditation & License</CardTitle>
                        </div>
                        <CardDescription>Regulatory information and quality certifications.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="accreditationType">Accreditation Type</Label>
                            <Input id="accreditationType" {...register("accreditationType")} className="rounded-xl" placeholder="NABH, JCI, etc." />
                            {errors.accreditationType && <p className="text-xs text-destructive">{errors.accreditationType.message}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="licenseNumber">Govt. License Number</Label>
                            <Input id="licenseNumber" {...register("licenseNumber")} className="rounded-xl" placeholder="HOSP-2024-XYZ" />
                            {errors.licenseNumber && <p className="text-xs text-destructive">{errors.licenseNumber.message}</p>}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
                    <CardHeader className="bg-muted/30 border-b">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            <CardTitle>Insurance & Schemes</CardTitle>
                        </div>
                        <CardDescription>Coverage and financial schemes accepted at the facility.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="insuranceAccepted">Private Insurances Accepted (Comma separated)</Label>
                            <Input id="insuranceAccepted" {...register("insuranceAccepted")} className="rounded-xl" placeholder="Star Health, Niva Bupa, ICICI Lombard..." />
                            <p className="text-[10px] text-muted-foreground">Type insurance names separated by commas</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="governmentSchemes">Government Schemes (Comma separated)</Label>
                            <Input id="governmentSchemes" {...register("governmentSchemes")} className="rounded-xl" placeholder="PMJAY, MJPJAY..." />
                            <p className="text-[10px] text-muted-foreground">Type scheme names separated by commas</p>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex items-center justify-end gap-4">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => router.back()}>
                        Cancel
                    </Button>
                    <Button type="submit" className="rounded-xl px-8 gap-2" disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {isNewProfile ? "Create Profile" : "Save Changes"}
                    </Button>
                </div>
            </form>
        </div>
    )
}
