"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, TrendingUp, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface ClaimMetric {
    _id: string
    insuranceCompanyName: string
    averageApprovalTimeDays: number
    rejectionRatePercentage: number
    deductionTrendLevel: string
    reliabilityScore: number
}

export function ClaimMetricsTab() {
    const [metrics, setMetrics] = useState<ClaimMetric[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [formData, setFormData] = useState({
        insuranceCompanyName: "",
        averageApprovalTimeDays: 0,
        rejectionRatePercentage: 0,
        deductionTrendLevel: "medium",
    })

    useEffect(() => {
        fetchMetrics()
    }, [])

    async function fetchMetrics() {
        try {
            const response = await fetch("/api/hospital/insurance/claim-metrics")
            if (!response.ok) throw new Error("Failed to fetch")
            const data = await response.json()
            setMetrics(data)
        } catch (error) {
            toast.error("Failed to load claim metrics")
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            const response = await fetch("/api/hospital/insurance/claim-metrics", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            if (!response.ok) throw new Error("Failed to save")

            const result = await response.json()
            toast.success(`Metrics saved. Reliability Score: ${result.reliabilityScore}`)
            setIsDialogOpen(false)
            resetForm()
            fetchMetrics()
        } catch (error) {
            toast.error("Failed to save metrics")
        }
    }

    function resetForm() {
        setFormData({
            insuranceCompanyName: "",
            averageApprovalTimeDays: 0,
            rejectionRatePercentage: 0,
            deductionTrendLevel: "medium",
        })
    }

    function getReliabilityColor(score: number) {
        if (score >= 70) return "text-green-600 bg-green-50"
        if (score >= 40) return "text-amber-600 bg-amber-50"
        return "text-red-600 bg-red-50"
    }

    return (
        <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Claim Performance Metrics</CardTitle>
                        <CardDescription>Track approval times, rejection rates, and reliability scores</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl gap-2">
                                <Plus className="h-4 w-4" />
                                Update Metrics
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Update Claim Performance</DialogTitle>
                                <DialogDescription>Enter performance data to calculate reliability score</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Insurance Company Name *</Label>
                                    <Input
                                        required
                                        value={formData.insuranceCompanyName}
                                        onChange={(e) => setFormData({ ...formData, insuranceCompanyName: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Average Approval Time (Days) *</Label>
                                        <Input
                                            type="number"
                                            required
                                            min="0"
                                            value={formData.averageApprovalTimeDays}
                                            onChange={(e) => setFormData({ ...formData, averageApprovalTimeDays: Number(e.target.value) })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Rejection Rate (%) *</Label>
                                        <Input
                                            type="number"
                                            required
                                            min="0"
                                            max="100"
                                            value={formData.rejectionRatePercentage}
                                            onChange={(e) => setFormData({ ...formData, rejectionRatePercentage: Number(e.target.value) })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Deduction Trend Level</Label>
                                    <select
                                        value={formData.deductionTrendLevel}
                                        onChange={(e) => setFormData({ ...formData, deductionTrendLevel: e.target.value })}
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>

                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                                    <div className="flex gap-2 text-sm text-blue-800">
                                        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <div>
                                            <strong>Reliability Score Calculation:</strong>
                                            <ul className="mt-1 space-y-1 text-xs">
                                                <li>• Lower rejection rate = Higher score (0-50 pts)</li>
                                                <li>• Faster approval time = Higher score (0-50 pts)</li>
                                                <li>• Low deduction trend = +5 pts, High = -5 pts</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="rounded-xl">
                                        Save & Calculate
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : metrics.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No claim metrics recorded yet</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {metrics.map((metric) => (
                            <Card key={metric._id} className="rounded-xl">
                                <CardContent className="p-4">
                                    <div className="space-y-3">
                                        <div>
                                            <h3 className="font-semibold">{metric.insuranceCompanyName}</h3>
                                        </div>

                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Avg Approval Time</span>
                                                <span className="font-medium">{metric.averageApprovalTimeDays} days</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Rejection Rate</span>
                                                <span className="font-medium">{metric.rejectionRatePercentage}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Deduction Trend</span>
                                                <Badge
                                                    variant={metric.deductionTrendLevel === "high" ? "destructive" : "secondary"}
                                                    className="rounded-lg capitalize"
                                                >
                                                    {metric.deductionTrendLevel}
                                                </Badge>
                                            </div>
                                        </div>

                                        <div className="pt-3 border-t">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-medium">Reliability Score</span>
                                                <span className={`text-lg font-bold px-2 py-1 rounded-lg ${getReliabilityColor(metric.reliabilityScore)}`}>
                                                    {metric.reliabilityScore}/100
                                                </span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all ${metric.reliabilityScore >= 70 ? "bg-green-600" :
                                                            metric.reliabilityScore >= 40 ? "bg-amber-600" :
                                                                "bg-red-600"
                                                        }`}
                                                    style={{ width: `${metric.reliabilityScore}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
