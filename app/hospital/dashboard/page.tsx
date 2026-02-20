"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Stethoscope,
    BedDouble,
    BedSingle,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardStats {
    totalTreatments: number;
    totalBeds: number;
    availableBeds: number;
    capacityLevel: "High" | "Medium" | "Low";
    hospitalName: string;
}

export default function DashboardOverview() {
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        async function fetchDashboardData() {
            try {
                // Fetch profile and treatments in parallel
                const [profileRes, treatmentsRes] = await Promise.all([
                    fetch("/api/hospital/profile"),
                    fetch("/api/hospital/treatments")
                ]);

                if (!profileRes.ok) {
                    const text = await profileRes.text();
                    console.error(`Profile fetch failed (${profileRes.status}):`, text.substring(0, 100));
                    throw new Error(`Profile fetch failed: ${profileRes.status}`);
                }

                if (!treatmentsRes.ok) {
                    const text = await treatmentsRes.text();
                    console.error(`Treatments fetch failed (${treatmentsRes.status}):`, text.substring(0, 100));
                    throw new Error(`Treatments fetch failed: ${treatmentsRes.status}`);
                }

                const [profile, treatments] = await Promise.all([
                    profileRes.json(),
                    treatmentsRes.json()
                ]);

                const totalBeds = profile.capacity?.totalBeds || 0
                const availableBeds = profile.capacity?.availableBeds || 0

                // Calculate capacity level
                let level: "High" | "Medium" | "Low" = "Low"
                if (totalBeds > 0) {
                    const ratio = availableBeds / totalBeds
                    if (ratio < 0.1) level = "High" // Capacity is high (few beds left)
                    else if (ratio < 0.3) level = "Medium"
                    else level = "Low"
                }

                setStats({
                    totalTreatments: Array.isArray(treatments) ? treatments.length : 0,
                    totalBeds,
                    availableBeds,
                    capacityLevel: level,
                    hospitalName: profile.hospitalName || "Hospital Admin"
                })
            } catch (error) {
                console.error("Failed to fetch dashboard stats:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchDashboardData()
    }, [])

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    const cards = [
        {
            title: "Total Treatments",
            value: stats?.totalTreatments || 0,
            icon: Stethoscope,
            description: "Active services offered",
            color: "text-blue-600",
            bg: "bg-blue-50"
        },
        {
            title: "Total Bed Capacity",
            value: stats?.totalBeds || 0,
            icon: BedDouble,
            description: "Registered beds",
            color: "text-indigo-600",
            bg: "bg-indigo-50"
        },
        {
            title: "Available Beds",
            value: stats?.availableBeds || 0,
            icon: BedSingle,
            description: "Ready for admissions",
            color: "text-emerald-600",
            bg: "bg-emerald-50"
        }
    ]

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome back, {stats?.hospitalName}</h1>
                <p className="text-muted-foreground mt-1">Here's what's happening at your hospital today.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((card) => (
                    <Card key={card.title} className="rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                            <CardTitle className="text-sm font-medium text-muted-foreground">
                                {card.title}
                            </CardTitle>
                            <div className={cn("p-2 rounded-xl", card.bg)}>
                                <card.icon className={cn("h-4 w-4", card.color)} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{card.value}</div>
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                                {card.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}

                <Card className="rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Capacity Level
                        </CardTitle>
                        <div className={cn(
                            "p-2 rounded-xl",
                            stats?.capacityLevel === "High" ? "bg-red-50" :
                                stats?.capacityLevel === "Medium" ? "bg-amber-50" : "bg-emerald-50"
                        )}>
                            <AlertCircle className={cn(
                                "h-4 w-4",
                                stats?.capacityLevel === "High" ? "text-red-600" :
                                    stats?.capacityLevel === "Medium" ? "text-amber-600" : "text-emerald-600"
                            )} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={cn(
                            "text-2xl font-bold",
                            stats?.capacityLevel === "High" ? "text-red-600" :
                                stats?.capacityLevel === "Medium" ? "text-amber-600" : "text-emerald-600"
                        )}>
                            {stats?.capacityLevel}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Current operational load
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 rounded-2xl border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/30 transition-colors">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <CheckCircle2 className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">Treatment Profile Updated</p>
                                        <p className="text-xs text-muted-foreground">Successfully updated "General Consultation" pricing.</p>
                                    </div>
                                    <div className="text-xs text-muted-foreground">2h ago</div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3 rounded-2xl border-border/60 shadow-sm">
                    <CardHeader>
                        <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <button className="w-full p-4 text-left rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors">
                            <p className="text-sm font-semibold text-primary">Update Bed Capacity</p>
                            <p className="text-xs text-muted-foreground">Last updated yesterday at 4:30 PM</p>
                        </button>
                        <button className="w-full p-4 text-left rounded-xl border border-dashed border-border hover:bg-muted transition-colors">
                            <p className="text-sm font-semibold">Add New Treatment</p>
                            <p className="text-xs text-muted-foreground">Register a new service or procedure</p>
                        </button>
                        <button className="w-full p-4 text-left rounded-xl border border-dashed border-border hover:bg-muted transition-colors">
                            <p className="text-sm font-semibold">Hospital Profile</p>
                            <p className="text-xs text-muted-foreground">View and edit institution details</p>
                        </button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
