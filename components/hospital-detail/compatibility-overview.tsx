import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Info, AlertCircle } from "lucide-react";
import { Hospital } from "./types";

interface CompatibilityOverviewProps {
    hospital: Hospital;
}

export function CompatibilityOverview({ hospital }: CompatibilityOverviewProps) {
    // In a real app, these would be calculated based on user profile
    const specialtyMatch = 95;
    const capacityReadiness = hospital.capacity.level === 'High' ? 40 : hospital.capacity.level === 'Medium' ? 70 : 95;
    const insuranceMatch = hospital.insuranceEligibility.accepted ? 100 : 0;

    return (
        <Card className="rounded-2xl border-0 shadow-sm bg-blue-50/50">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                    Compatibility Overview
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <Info className="w-4 h-4 text-blue-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Based on your profile and condition</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Specialty Match */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">Specialty Match</span>
                        <span className="font-bold text-blue-700">High Match</span>
                    </div>
                    <Progress value={specialtyMatch} className="h-2 bg-blue-100" />
                    <p className="text-xs text-muted-foreground">This hospital specializes in your required treatment.</p>
                </div>

                {/* Capacity */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">Capacity Readiness</span>
                        <span className="font-bold text-emerald-700">Available Now</span>
                    </div>
                    <Progress value={capacityReadiness} className="h-2 bg-emerald-100" />
                    <p className="text-xs text-muted-foreground">High availability for immediate admission.</p>
                </div>

                {/* Insurance */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700">Insurance Compatibility</span>
                        <span className="font-bold text-purple-700">{hospital.insuranceEligibility.accepted ? "Fully Compatible" : "Not Covered"}</span>
                    </div>
                    <Progress value={insuranceMatch} className="h-2 bg-purple-100" />
                    <p className="text-xs text-muted-foreground">Direct cashless settlement available.</p>
                </div>

            </CardContent>
        </Card>
    );
}
