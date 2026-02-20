import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Beaker, Bed } from "lucide-react";
import { Hospital } from "./types";

interface CapacityStatusProps {
    hospital: Hospital;
}

export function CapacityStatus({ hospital }: CapacityStatusProps) {
    const { capacity } = hospital;

    const getCapacityColor = (level: string) => {
        switch (level) {
            case 'High': return 'bg-red-50 text-red-700 border-red-200';
            case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            default: return 'bg-gray-50 text-gray-700';
        }
    };

    return (
        <Card className="rounded-2xl border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    Live Capacity Status
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Bed className="w-3.5 h-3.5" /> Total Beds
                        </div>
                        <div className="text-xl font-bold text-slate-900">{capacity.totalBeds}</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                        <div className="text-xs text-emerald-700 mb-1 flex items-center gap-1">
                            <Badge className="w-1.5 h-1.5 rounded-full bg-emerald-500 p-0 mr-1" /> Available
                        </div>
                        <div className="text-xl font-bold text-emerald-700">{capacity.availableBeds}</div>
                    </div>
                </div>

                <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">ICU Availability</span>
                        <span className="font-medium text-slate-900">{capacity.icuBeds} Beds</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Emergency</span>
                        <Badge variant="outline" className={capacity.emergencyAvailable ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}>
                            {capacity.emergencyAvailable ? "Open 24/7" : "Limited"}
                        </Badge>
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
