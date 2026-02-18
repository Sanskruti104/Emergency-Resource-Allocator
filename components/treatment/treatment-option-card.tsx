"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, Clock, Bed, AlertCircle } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Treatment } from "@/lib/medical-data"

interface TreatmentOptionCardProps {
    treatment: Treatment
}

export function TreatmentOptionCard({ treatment }: TreatmentOptionCardProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <Card className="rounded-2xl shadow-sm hover:shadow-md transition-shadow border-border/60 bg-white overflow-hidden">
            <CardHeader className="pb-3 bg-gray-50/50 border-b border-gray-100">
                <CardTitle className="text-lg font-bold text-gray-900 flex justify-between items-start gap-4">
                    {treatment.name}
                    {treatment.hospitalStay === "No" && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 whitespace-nowrap">
                            No Stay
                        </Badge>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                <p className="text-gray-700">
                    {treatment.simpleDescription}
                </p>

                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-medium">Recovery:</span> {treatment.recoveryTime}
                    </div>
                    <div className="flex items-center gap-1.5 bg-gray-50 px-2 py-1 rounded-md">
                        <Bed className="h-4 w-4 text-primary" />
                        <span className="font-medium">Hospital Stay:</span> {treatment.hospitalStay}
                    </div>
                </div>

                <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2 pt-2">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full justify-between h-auto py-2 px-3 bg-muted/30 hover:bg-muted/50 rounded-lg text-xs font-medium text-muted-foreground">
                            <span>View medical details</span>
                            {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="mt-2 text-sm text-gray-600 space-y-2">
                            <div className="p-3 bg-blue-50/30 rounded-lg border border-blue-100/50">
                                <span className="font-semibold block mb-1 text-gray-900">Procedure Overview:</span>
                                {treatment.medicalDescription}
                            </div>
                            <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
                                <AlertCircle className="h-3 w-3 mt-0.5" />
                                <span>ICU Possibility: <strong className="text-gray-700">{treatment.icuPossibility}</strong></span>
                            </div>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </CardContent>
        </Card>
    )
}
