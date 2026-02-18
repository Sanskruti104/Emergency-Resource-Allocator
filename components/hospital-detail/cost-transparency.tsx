import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Wallet, ShieldCheck } from "lucide-react";
import { Hospital } from "./types";

interface CostTransparencyProps {
    hospital: Hospital;
}

export function CostTransparency({ hospital }: CostTransparencyProps) {
    // Mock data for demonstration - in real app would come from selected treatment
    const treatmentName = "Knee Replacement";
    const costs = hospital.packageRates?.[treatmentName] || {
        range: [150000, 220000],
        insuranceRate: 165000,
        cashRate: 180000
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <Card className="rounded-2xl border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center justify-between">
                    Cost Transparency
                    <Badge variant="outline" className="text-xs font-normal bg-green-50 text-green-700 border-green-200">
                        verified rates
                    </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">Estimated for {treatmentName}</p>
            </CardHeader>
            <CardContent className="space-y-4">

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-1 text-sm text-muted-foreground">
                        <Wallet className="w-4 h-4" />
                        Estimated Range
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                        {formatCurrency(costs.range[0])} - {formatCurrency(costs.range[1])}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 border rounded-xl">
                        <div className="text-xs text-muted-foreground mb-1">Insurance Rate</div>
                        <div className="font-semibold text-blue-700">{formatCurrency(costs.insuranceRate)}</div>
                    </div>
                    <div className="p-3 border rounded-xl">
                        <div className="text-xs text-muted-foreground mb-1">Self-Pay Rate</div>
                        <div className="font-semibold text-gray-700">{formatCurrency(costs.cashRate)}</div>
                    </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl text-amber-900 text-sm">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                        <span className="font-semibold block mb-0.5">Moderate Out-of-Pocket Risk</span>
                        Non-medical expenses may vary by 10-15%.
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
