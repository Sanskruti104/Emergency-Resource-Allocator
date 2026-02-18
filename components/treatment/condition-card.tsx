"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronUp, Activity } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Condition } from "@/lib/medical-data"

interface ConditionCardProps {
    condition: Condition
}

export function ConditionCard({ condition }: ConditionCardProps) {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <section className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-gray-900">Understanding Your Condition</h2>
            </div>

            <Card className="rounded-2xl border-l-4 border-l-primary shadow-sm bg-white overflow-hidden">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                        <div>
                            <Badge variant="secondary" className="mb-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border-0">
                                {condition.category}
                            </Badge>
                            <CardTitle className="text-2xl font-bold text-gray-900">
                                {condition.name}
                            </CardTitle>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-lg text-gray-700 leading-relaxed">
                        {condition.simpleExplanation}
                    </p>

                    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-auto font-medium text-primary hover:text-primary/80 hover:bg-transparent">
                                {isOpen ? (
                                    <>
                                        Hide medical explanation
                                        <ChevronUp className="ml-1 h-4 w-4" />
                                    </>
                                ) : (
                                    <>
                                        Show medical explanation
                                        <ChevronDown className="ml-1 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="mt-2 p-4 bg-muted/50 rounded-xl text-sm text-gray-600 border border-border/50">
                                <span className="font-semibold block mb-1 text-gray-900">Clinical Definition:</span>
                                {condition.medicalExplanation}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                </CardContent>
            </Card>
        </section>
    )
}
