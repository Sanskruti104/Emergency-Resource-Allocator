"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"

interface TreatmentRule {
    _id: string
    treatmentName: string
    insuranceCompanyName: string
    coverageLikelihoodPercentage: number
    documentationRequired: string[]
    commonRejectionReasons: string[]
    preExistingClauseRisk: string
}

export function TreatmentEligibilityTab() {
    const [rules, setRules] = useState<TreatmentRule[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRule, setEditingRule] = useState<TreatmentRule | null>(null)
    const [formData, setFormData] = useState({
        treatmentName: "",
        insuranceCompanyName: "",
        coverageLikelihoodPercentage: 50,
        documentationRequired: "",
        commonRejectionReasons: "",
        preExistingClauseRisk: "Low",
    })

    useEffect(() => {
        fetchRules()
    }, [])

    async function fetchRules() {
        try {
            const response = await fetch("/api/hospital/insurance/eligibility")
            if (!response.ok) throw new Error("Failed to fetch")
            const data = await response.json()
            setRules(data)
        } catch (error) {
            toast.error("Failed to load eligibility rules")
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            const payload = {
                ...formData,
                documentationRequired: formData.documentationRequired.split(",").map(s => s.trim()).filter(Boolean),
                commonRejectionReasons: formData.commonRejectionReasons.split(",").map(s => s.trim()).filter(Boolean),
            }

            const url = editingRule
                ? `/api/hospital/insurance/eligibility/${editingRule._id}`
                : "/api/hospital/insurance/eligibility"
            const method = editingRule ? "PUT" : "POST"

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            if (!response.ok) throw new Error("Failed to save")

            toast.success(editingRule ? "Rule updated" : "Rule added")
            setIsDialogOpen(false)
            resetForm()
            fetchRules()
        } catch (error) {
            toast.error("Failed to save rule")
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this eligibility rule?")) return

        try {
            const response = await fetch(`/api/hospital/insurance/eligibility/${id}`, {
                method: "DELETE",
            })
            if (!response.ok) throw new Error("Failed to delete")
            toast.success("Rule deleted")
            fetchRules()
        } catch (error) {
            toast.error("Failed to delete rule")
        }
    }

    function resetForm() {
        setFormData({
            treatmentName: "",
            insuranceCompanyName: "",
            coverageLikelihoodPercentage: 50,
            documentationRequired: "",
            commonRejectionReasons: "",
            preExistingClauseRisk: "Low",
        })
        setEditingRule(null)
    }

    function openEditDialog(rule: TreatmentRule) {
        setEditingRule(rule)
        setFormData({
            treatmentName: rule.treatmentName,
            insuranceCompanyName: rule.insuranceCompanyName,
            coverageLikelihoodPercentage: rule.coverageLikelihoodPercentage,
            documentationRequired: rule.documentationRequired.join(", "),
            commonRejectionReasons: rule.commonRejectionReasons.join(", "),
            preExistingClauseRisk: rule.preExistingClauseRisk,
        })
        setIsDialogOpen(true)
    }

    return (
        <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Treatment-Wise Insurance Eligibility</CardTitle>
                        <CardDescription>Define coverage likelihood and documentation requirements</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open)
                        if (!open) resetForm()
                    }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl gap-2">
                                <Plus className="h-4 w-4" />
                                Add Rule
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingRule ? "Edit" : "Add"} Eligibility Rule</DialogTitle>
                                <DialogDescription>Configure treatment-specific insurance coverage rules</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Treatment Name *</Label>
                                        <Input
                                            required
                                            value={formData.treatmentName}
                                            onChange={(e) => setFormData({ ...formData, treatmentName: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Insurance Company *</Label>
                                        <Input
                                            required
                                            value={formData.insuranceCompanyName}
                                            onChange={(e) => setFormData({ ...formData, insuranceCompanyName: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Coverage Likelihood: {formData.coverageLikelihoodPercentage}%</Label>
                                    <Slider
                                        value={[formData.coverageLikelihoodPercentage]}
                                        onValueChange={([value]) => setFormData({ ...formData, coverageLikelihoodPercentage: value })}
                                        max={100}
                                        step={5}
                                        className="py-4"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Pre-Existing Clause Risk</Label>
                                    <select
                                        value={formData.preExistingClauseRisk}
                                        onChange={(e) => setFormData({ ...formData, preExistingClauseRisk: e.target.value })}
                                        className="w-full rounded-xl border border-input bg-background px-3 py-2"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Documentation Required (comma-separated)</Label>
                                    <Input
                                        value={formData.documentationRequired}
                                        onChange={(e) => setFormData({ ...formData, documentationRequired: e.target.value })}
                                        placeholder="e.g., Medical reports, Lab results, Prescription"
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Common Rejection Reasons (comma-separated)</Label>
                                    <Input
                                        value={formData.commonRejectionReasons}
                                        onChange={(e) => setFormData({ ...formData, commonRejectionReasons: e.target.value })}
                                        placeholder="e.g., Incomplete docs, Pre-existing condition"
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="flex gap-2 justify-end pt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="rounded-xl">
                                        {editingRule ? "Update" : "Add"} Rule
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
                ) : rules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No eligibility rules defined yet</div>
                ) : (
                    <div className="grid gap-4">
                        {rules.map((rule) => (
                            <Card key={rule._id} className="rounded-xl">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-semibold">{rule.treatmentName}</h3>
                                                <Badge variant="outline" className="rounded-lg">{rule.insuranceCompanyName}</Badge>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">Coverage Likelihood:</span>
                                                <div className="flex-1 max-w-xs h-2 bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary"
                                                        style={{ width: `${rule.coverageLikelihoodPercentage}%` }}
                                                    />
                                                </div>
                                                <span className="text-sm font-medium">{rule.coverageLikelihoodPercentage}%</span>
                                            </div>
                                            <div className="flex gap-2 text-xs">
                                                <Badge variant={rule.preExistingClauseRisk === "High" ? "destructive" : "secondary"} className="rounded-lg">
                                                    Risk: {rule.preExistingClauseRisk}
                                                </Badge>
                                            </div>
                                            {rule.documentationRequired.length > 0 && (
                                                <div className="text-sm">
                                                    <span className="text-muted-foreground">Docs: </span>
                                                    {rule.documentationRequired.join(", ")}
                                                </div>
                                            )}
                                            {rule.commonRejectionReasons.length > 0 && (
                                                <div className="text-sm">
                                                    <span className="text-muted-foreground">Rejection Reasons: </span>
                                                    {rule.commonRejectionReasons.join(", ")}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEditDialog(rule)}
                                                className="h-8 w-8 rounded-lg"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(rule._id)}
                                                className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
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
