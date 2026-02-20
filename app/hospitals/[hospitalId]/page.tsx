"use client"

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Hospital } from "@/components/hospital-detail/types";
import { HospitalHeader } from "@/components/hospital-detail/hospital-header";
import { CompatibilityOverview } from "@/components/hospital-detail/compatibility-overview";
import { CostTransparency } from "@/components/hospital-detail/cost-transparency";
import { InsuranceIntelligence } from "@/components/hospital-detail/insurance-intelligence";
import { InfrastructureMedia } from "@/components/hospital-detail/infrastructure-media";
import { CapacityStatus } from "@/components/hospital-detail/capacity-status";
import { AboutHospital } from "@/components/hospital-detail/about-hospital";
import { ActionBar } from "@/components/hospital-detail/action-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function HospitalDetailPage() {
    const params = useParams();
    const hospitalId = params.hospitalId as string;

    const [hospital, setHospital] = useState<Hospital | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!hospitalId) return;

        const fetchHospital = async () => {
            try {
                const response = await fetch(`/api/hospital/public/${hospitalId}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch hospital data");
                }
                const data = await response.json();
                setHospital(data);
            } catch (err) {
                console.error(err);
                setError("Could not load hospital details. Please try again later.");
            } finally {
                setLoading(false);
            }
        };

        fetchHospital();
    }, [hospitalId]);

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-7xl animate-pulse space-y-6">
                <Skeleton className="h-64 w-full rounded-2xl" />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                        <Skeleton className="h-40 w-full rounded-2xl" />
                        <Skeleton className="h-60 w-full rounded-2xl" />
                        <Skeleton className="h-80 w-full rounded-2xl" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton className="h-60 w-full rounded-2xl" />
                        <Skeleton className="h-40 w-full rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !hospital) {
        return (
            <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error || "Hospital not found"}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            <div className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">

                {/* Header Section */}
                <HospitalHeader hospital={hospital} />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

                    {/* Main Content Column */}
                    <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8">

                        <section>
                            <CompatibilityOverview hospital={hospital} />
                        </section>

                        <section>
                            <CostTransparency hospital={hospital} />
                        </section>

                        <section>
                            <InfrastructureMedia hospital={hospital} />
                        </section>

                        <section>
                            <AboutHospital hospital={hospital} />
                        </section>

                    </div>

                    {/* Sidebar / Secondary Column */}
                    <div className="lg:col-span-4 flex flex-col gap-6 md:gap-8">
                        <div className="sticky top-24 space-y-6 md:space-y-8">
                            <InsuranceIntelligence hospital={hospital} />
                            <CapacityStatus hospital={hospital} />
                        </div>
                    </div>

                </div>

                {/* Bottom Action Section */}
                <ActionBar hospital={hospital} />

            </div>
        </div>
    );
}
