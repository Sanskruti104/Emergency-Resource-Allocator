"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react"
import { toast } from "sonner"

interface PackageRate {
    _id: string
    treatmentName: string
    insuranceCompanyName: string
    negotiatedRate: number
    selfPayRate: number
    differenceAmount: number
}

export function PackageRatesTab() {
    const [rates, setRates] = useState<PackageRate[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingRate, setEditingRate] = useState<PackageRate | null>(null)
    const [formData, setFormData] = useState({
        treatmentName: "",
        insuranceCompanyName: "",
        negotiatedRate: 0,
        selfPayRate: 0,
    })

    useEffect(() => {
        fetchRates()
    }, [])

    async function fetchRates() {
        try {
            const response = await fetch("/api/hospital/insurance/package-rates")
            if (!response.ok) throw new Error("Failed to fetch")
            const data = await response.json()
            setRates(data)
        } catch (error) {
            toast.error("Failed to load package rates")
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            const url = editingRate
                ? `/api/hospital/insurance/package-rates/${editingRate._id}`
                : "/api/hospital/insurance/package-rates"
            const method = editingRate ? "PUT" : "POST"

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            if (!response.ok) throw new Error("Failed to save")

            toast.success(editingRate ? "Rate updated" : "Rate added")
            setIsDialogOpen(false)
            resetForm()
            fetchRates()
        } catch (error) {
            toast.error("Failed to save rate")
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this package rate?")) return

        try {
            const response = await fetch(`/api/hospital/insurance/package-rates/${id}`, {
                method: "DELETE",
            })
            if (!response.ok) throw new Error("Failed to delete")
            toast.success("Rate deleted")
            fetchRates()
        } catch (error) {
            toast.error("Failed to delete rate")
        }
    }

    function resetForm() {
        setFormData({
            treatmentName: "",
            insuranceCompanyName: "",
            negotiatedRate: 0,
            selfPayRate: 0,
        })
        setEditingRate(null)
    }

    function openEditDialog(rate: PackageRate) {
        setEditingRate(rate)
        setFormData({
            treatmentName: rate.treatmentName,
            insuranceCompanyName: rate.insuranceCompanyName,
            negotiatedRate: rate.negotiatedRate,
            selfPayRate: rate.selfPayRate,
        })
        setIsDialogOpen(true)
    }

    return (
        <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Package Rate Transparency</CardTitle>
                        <CardDescription>Compare negotiated insurance rates vs. self-pay rates</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open)
                        if (!open) resetForm()
                    }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl gap-2">
                                <Plus className="h-4 w-4" />
                                Add Rate
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingRate ? "Edit" : "Add"} Package Rate</DialogTitle>
                                <DialogDescription>Configure treatment pricing for insurance vs. self-pay</DialogDescription>
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

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Negotiated Rate (₹) *</Label>
                                        <Input
                                            type="number"
                                            required
                                            min="0"
                                            value={formData.negotiatedRate}
                                            onChange={(e) => setFormData({ ...formData, negotiatedRate: Number(e.target.value) })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Self-Pay Rate (₹) *</Label>
                                        <Input
                                            type="number"
                                            required
                                            min="0"
                                            value={formData.selfPayRate}
                                            onChange={(e) => setFormData({ ...formData, selfPayRate: Number(e.target.value) })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-muted/50 rounded-xl">
                                    <div className="text-sm text-muted-foreground">Calculated Difference</div>
                                    <div className="text-2xl font-bold">
                                        ₹{(formData.negotiatedRate - formData.selfPayRate).toLocaleString()}
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="rounded-xl">
                                        {editingRate ? "Update" : "Add"} Rate
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
                ) : rates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No package rates defined yet</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {rates.map((rate) => (
                            <Card key={rate._id} className="rounded-xl">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-semibold">{rate.treatmentName}</h3>
                                            <p className="text-sm text-muted-foreground">{rate.insuranceCompanyName}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEditDialog(rate)}
                                                className="h-8 w-8 rounded-lg"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(rate._id)}
                                                className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Negotiated Rate</span>
                                            <span className="font-medium">₹{rate.negotiatedRate.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Self-Pay Rate</span>
                                            <span className="font-medium">₹{rate.selfPayRate.toLocaleString()}</span>
                                        </div>
                                        <div className="pt-2 border-t">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Difference</span>
                                                <div className={`flex items-center gap-1 font-semibold ${rate.differenceAmount > 0 ? "text-green-600" : rate.differenceAmount < 0 ? "text-red-600" : ""
                                                    }`}>
                                                    {rate.differenceAmount > 0 ? (
                                                        <TrendingUp className="h-4 w-4" />
                                                    ) : rate.differenceAmount < 0 ? (
                                                        <TrendingDown className="h-4 w-4" />
                                                    ) : null}
                                                    ₹{Math.abs(rate.differenceAmount).toLocaleString()}
                                                </div>
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
