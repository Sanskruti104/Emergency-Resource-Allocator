"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import {
    Loader2,
    Save,
    BedDouble,
    Stethoscope,
    Users,
    AlertCircle,
    CheckCircle2,
    Info
} from "lucide-react"
import { cn } from "@/lib/utils"

const capacitySchema = z.object({
    totalBeds: z.coerce.number().min(0),
    availableBeds: z.coerce.number().min(0),
    icuBeds: z.coerce.number().min(0),
    operationTheatres: z.coerce.number().min(0),
    onDutySpecialist: z.coerce.number().min(0),
    emergencyAvailable: z.boolean(),
})

type CapacityFormValues = z.infer<typeof capacitySchema>

export default function CapacityManagementPage() {
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [capacityLevel, setCapacityLevel] = useState<"High" | "Medium" | "Low">("Low")

    const {
        register,
        handleSubmit,
        reset,
        watch,
        setValue,
        formState: { errors },
    } = useForm<CapacityFormValues>({
        resolver: zodResolver(capacitySchema),
        defaultValues: {
            emergencyAvailable: true
        }
    })

    const totalBeds = watch("totalBeds")
    const availableBeds = watch("availableBeds")

    useEffect(() => {
        if (totalBeds > 0) {
            const ratio = availableBeds / totalBeds
            if (ratio < 0.1) setCapacityLevel("High")
            else if (ratio < 0.3) setCapacityLevel("Medium")
            else setCapacityLevel("Low")
        } else {
            setCapacityLevel("Low")
        }
    }, [totalBeds, availableBeds])

    useEffect(() => {
        async function fetchCapacity() {
            try {
                const response = await fetch("/api/hospital/profile")
                if (!response.ok) {
                    const text = await response.text();
                    console.error(`Fetch profile failed (${response.status}):`, text.substring(0, 100));
                    throw new Error(`Failed to load capacity data: ${response.status}`);
                }
                const data = await response.json()
                if (data.capacity) {
                    reset(data.capacity)
                }
            } catch (error: any) {
                console.error("Capacity fetch error:", error);
                toast.error(error.message || "Failed to load capacity data")
            } finally {
                setIsLoading(false)
            }
        }
        fetchCapacity()
    }, [reset])

    const onSubmit = async (data: CapacityFormValues) => {
        if (data.availableBeds > data.totalBeds) {
            toast.error("Available beds cannot exceed total beds")
            return
        }

        setIsSaving(true)
        try {
            const response = await fetch("/api/hospital/capacity", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to save capacity: ${response.status}`)
            }

            toast.success("Capacity status updated!")
        } catch (error: any) {
            console.error("Save capacity error:", error);
            toast.error(error.message || "An error occurred while saving capacity")
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Capacity Management</h1>
                    <p className="text-muted-foreground mt-1">Real-time update of hospital resources and bed availability.</p>
                </div>

                <div className={cn(
                    "flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-sm",
                    capacityLevel === "High" ? "bg-red-50 border-red-100 text-red-700" :
                        capacityLevel === "Medium" ? "bg-amber-50 border-amber-100 text-amber-700" :
                            "bg-emerald-50 border-emerald-100 text-emerald-700"
                )}>
                    {capacityLevel === "High" ? <AlertCircle className="h-5 w-5" /> :
                        capacityLevel === "Medium" ? <Info className="h-5 w-5" /> :
                            <CheckCircle2 className="h-5 w-5" />}
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">System Status</span>
                        <span className="font-bold leading-none">{capacityLevel} Capacity Load</span>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b">
                            <div className="flex items-center gap-2">
                                <BedDouble className="h-5 w-5 text-primary" />
                                <CardTitle>Bed Management</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="totalBeds">Total Bed Capacity</Label>
                                <Input id="totalBeds" type="number" {...register("totalBeds")} className="rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="availableBeds">Available Beds Currently</Label>
                                <Input id="availableBeds" type="number" {...register("availableBeds")} className="rounded-xl border-emerald-200 focus-visible:ring-emerald-500/20" />
                            </div>
                            <div className="space-y-2 pt-2">
                                <Label htmlFor="icuBeds">ICU Beds (Included in total)</Label>
                                <Input id="icuBeds" type="number" {...register("icuBeds")} className="rounded-xl border-red-100" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b">
                            <div className="flex items-center gap-2">
                                <Stethoscope className="h-5 w-5 text-primary" />
                                <CardTitle>Facilities & Staff</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="operationTheatres">Active Operation Theatres</Label>
                                <Input id="operationTheatres" type="number" {...register("operationTheatres")} className="rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="onDutySpecialist">On-Duty Specialists</Label>
                                <Input id="onDutySpecialist" type="number" {...register("onDutySpecialist")} className="rounded-xl" />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20 mt-4">
                                <div className="space-y-0.5">
                                    <Label className="text-base font-semibold">Emergency Services</Label>
                                    <p className="text-xs text-muted-foreground italic">Are you accepting emergency admissions?</p>
                                </div>
                                <Switch
                                    checked={watch("emergencyAvailable")}
                                    onCheckedChange={(checked) => setValue("emergencyAvailable", checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex items-center justify-end gap-4 p-4 bg-white rounded-2xl border border-border/60 shadow-sm">
                    <p className="text-xs text-muted-foreground flex items-center gap-2 mr-auto px-2">
                        <Info className="h-4 w-4" />
                        Updates are reflected instantly on the booking platform.
                    </p>
                    <Button type="button" variant="outline" className="rounded-xl">
                        Discard
                    </Button>
                    <Button type="submit" className="rounded-xl px-12 gap-2 shadow-lg shadow-primary/20" disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Update Capacity
                    </Button>
                </div>
            </form>
        </div>
    )
}
