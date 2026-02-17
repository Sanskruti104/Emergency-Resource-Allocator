"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShieldCheck, Network, FileText, DollarSign, TrendingUp, Building2 } from "lucide-react"
import { InsuranceNetworkTab } from "@/components/insurance/insurance-network-tab"
import { TreatmentEligibilityTab } from "@/components/insurance/treatment-eligibility-tab"
import { PackageRatesTab } from "@/components/insurance/package-rates-tab"
import { ClaimMetricsTab } from "@/components/insurance/claim-metrics-tab"
import { GovSchemesTab } from "@/components/insurance/gov-schemes-tab"

export default function InsuranceIntelligencePage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Insurance Intelligence</h1>
                    <p className="text-muted-foreground">
                        Manage insurance networks, eligibility rules, and claim performance
                    </p>
                </div>
            </div>

            <Tabs defaultValue="network" className="space-y-6">
                <TabsList className="grid w-full grid-cols-5 rounded-2xl bg-muted/50 p-1">
                    <TabsTrigger value="network" className="rounded-xl gap-2">
                        <Network className="h-4 w-4" />
                        <span className="hidden sm:inline">Network</span>
                    </TabsTrigger>
                    <TabsTrigger value="eligibility" className="rounded-xl gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Eligibility</span>
                    </TabsTrigger>
                    <TabsTrigger value="rates" className="rounded-xl gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span className="hidden sm:inline">Rates</span>
                    </TabsTrigger>
                    <TabsTrigger value="metrics" className="rounded-xl gap-2">
                        <TrendingUp className="h-4 w-4" />
                        <span className="hidden sm:inline">Metrics</span>
                    </TabsTrigger>
                    <TabsTrigger value="schemes" className="rounded-xl gap-2">
                        <Building2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Gov Schemes</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="network" className="space-y-4">
                    <InsuranceNetworkTab />
                </TabsContent>

                <TabsContent value="eligibility" className="space-y-4">
                    <TreatmentEligibilityTab />
                </TabsContent>

                <TabsContent value="rates" className="space-y-4">
                    <PackageRatesTab />
                </TabsContent>

                <TabsContent value="metrics" className="space-y-4">
                    <ClaimMetricsTab />
                </TabsContent>

                <TabsContent value="schemes" className="space-y-4">
                    <GovSchemesTab />
                </TabsContent>
            </Tabs>
        </div>
    )
}
