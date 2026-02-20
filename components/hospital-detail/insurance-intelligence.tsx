import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Shield, Clock, FileCheck } from "lucide-react";
import { Hospital } from "./types";

interface InsuranceIntelligenceProps {
    hospital: Hospital;
}

export function InsuranceIntelligence({ hospital }: InsuranceIntelligenceProps) {
    const { claimMetrics } = hospital;

    return (
        <Card className="rounded-2xl border border-gray-100 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    Insurance & Claim Reliability
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Reliability Score */}
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <span className="text-sm font-medium text-gray-600">Claim Reliability Score</span>
                        <div className="text-right">
                            <span className="text-2xl font-bold text-purple-700">{claimMetrics.claimReliabilityScore}</span>
                            <span className="text-muted-foreground text-sm">/10</span>
                        </div>
                    </div>
                    <Progress value={claimMetrics.claimReliabilityScore * 10} className="h-2.5 bg-purple-100" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            Avg. Approval
                        </div>
                        <p className="font-semibold text-gray-900">{claimMetrics.averageApprovalTime}</p>
                    </div>
                    <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <FileCheck className="w-3.5 h-3.5" />
                            Coverage Odds
                        </div>
                        <p className="font-semibold text-gray-900">{claimMetrics.coverageLikelihood}% Likely</p>
                    </div>
                </div>

                {/* Networks */}
                <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Accepted Networks</h4>
                    <div className="flex flex-wrap gap-2">
                        {hospital.insuranceNetworks.slice(0, 4).map((network, i) => (
                            <Badge key={i} variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-200">
                                {network}
                            </Badge>
                        ))}
                        {hospital.insuranceNetworks.length > 4 && (
                            <Badge variant="outline" className="text-muted-foreground">
                                +{hospital.insuranceNetworks.length - 4} more
                            </Badge>
                        )}
                    </div>
                </div>

                {hospital.insuranceEligibility.accepted && (
                    <div className="flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                        <Shield className="w-4 h-4" />
                        Cashless Settlement Enabled
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
