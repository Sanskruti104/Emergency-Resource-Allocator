"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"

interface InsuranceNetwork {
    _id: string
    insuranceCompanyName: string
    tpaName: string
    cashlessAvailable: boolean
    reimbursementAvailable: boolean
    preAuthRequired: boolean
    averageApprovalTimeDays: number
}

export function InsuranceNetworkTab() {
    const [networks, setNetworks] = useState<InsuranceNetwork[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingNetwork, setEditingNetwork] = useState<InsuranceNetwork | null>(null)
    const [formData, setFormData] = useState({
        insuranceCompanyName: "",
        tpaName: "",
        cashlessAvailable: false,
        reimbursementAvailable: false,
        preAuthRequired: false,
        averageApprovalTimeDays: 0,
    })

    useEffect(() => {
        fetchNetworks()
    }, [])

    async function fetchNetworks() {
        try {
            const response = await fetch("/api/hospital/insurance/network")
            if (!response.ok) throw new Error("Failed to fetch networks")
            const data = await response.json()
            setNetworks(data)
        } catch (error) {
            toast.error("Failed to load insurance networks")
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            const url = editingNetwork
                ? `/api/hospital/insurance/network/${editingNetwork._id}`
                : "/api/hospital/insurance/network"
            const method = editingNetwork ? "PUT" : "POST"

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            if (!response.ok) throw new Error("Failed to save network")

            toast.success(editingNetwork ? "Network updated" : "Network added")
            setIsDialogOpen(false)
            resetForm()
            fetchNetworks()
        } catch (error) {
            toast.error("Failed to save network")
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this insurance network?")) return

        try {
            const response = await fetch(`/api/hospital/insurance/network/${id}`, {
                method: "DELETE",
            })
            if (!response.ok) throw new Error("Failed to delete")
            toast.success("Network deleted")
            fetchNetworks()
        } catch (error) {
            toast.error("Failed to delete network")
        }
    }

    function resetForm() {
        setFormData({
            insuranceCompanyName: "",
            tpaName: "",
            cashlessAvailable: false,
            reimbursementAvailable: false,
            preAuthRequired: false,
            averageApprovalTimeDays: 0,
        })
        setEditingNetwork(null)
    }

    function openEditDialog(network: InsuranceNetwork) {
        setEditingNetwork(network)
        setFormData({
            insuranceCompanyName: network.insuranceCompanyName,
            tpaName: network.tpaName,
            cashlessAvailable: network.cashlessAvailable,
            reimbursementAvailable: network.reimbursementAvailable,
            preAuthRequired: network.preAuthRequired,
            averageApprovalTimeDays: network.averageApprovalTimeDays,
        })
        setIsDialogOpen(true)
    }

    return (
        <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Insurance Network Partners</CardTitle>
                        <CardDescription>Manage your insurance company partnerships and TPA relationships</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open)
                        if (!open) resetForm()
                    }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl gap-2">
                                <Plus className="h-4 w-4" />
                                Add Partner
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingNetwork ? "Edit" : "Add"} Insurance Partner</DialogTitle>
                                <DialogDescription>Configure insurance company and TPA details</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Insurance Company Name *</Label>
                                        <Input
                                            required
                                            value={formData.insuranceCompanyName}
                                            onChange={(e) => setFormData({ ...formData, insuranceCompanyName: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>TPA Name</Label>
                                        <Input
                                            value={formData.tpaName}
                                            onChange={(e) => setFormData({ ...formData, tpaName: e.target.value })}
                                            className="rounded-xl"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Average Approval Time (Days)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={formData.averageApprovalTimeDays}
                                        onChange={(e) => setFormData({ ...formData, averageApprovalTimeDays: Number(e.target.value) })}
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label>Service Options</Label>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.cashlessAvailable}
                                                onChange={(e) => setFormData({ ...formData, cashlessAvailable: e.target.checked })}
                                                className="rounded"
                                            />
                                            <span className="text-sm">Cashless Available</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.reimbursementAvailable}
                                                onChange={(e) => setFormData({ ...formData, reimbursementAvailable: e.target.checked })}
                                                className="rounded"
                                            />
                                            <span className="text-sm">Reimbursement Available</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.preAuthRequired}
                                                onChange={(e) => setFormData({ ...formData, preAuthRequired: e.target.checked })}
                                                className="rounded"
                                            />
                                            <span className="text-sm">Pre-Authorization Required</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex gap-2 justify-end pt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="rounded-xl">
                                        {editingNetwork ? "Update" : "Add"} Partner
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
                ) : networks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No insurance partners added yet</div>
                ) : (
                    <div className="rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Insurance Company</TableHead>
                                    <TableHead>TPA</TableHead>
                                    <TableHead>Cashless</TableHead>
                                    <TableHead>Reimbursement</TableHead>
                                    <TableHead>Pre-Auth</TableHead>
                                    <TableHead>Avg Approval (Days)</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {networks.map((network) => (
                                    <TableRow key={network._id}>
                                        <TableCell className="font-medium">{network.insuranceCompanyName}</TableCell>
                                        <TableCell>{network.tpaName || "—"}</TableCell>
                                        <TableCell>
                                            {network.cashlessAvailable ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-gray-300" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {network.reimbursementAvailable ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-gray-300" />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {network.preAuthRequired ? (
                                                <CheckCircle2 className="h-4 w-4 text-amber-600" />
                                            ) : (
                                                <XCircle className="h-4 w-4 text-gray-300" />
                                            )}
                                        </TableCell>
                                        <TableCell>{network.averageApprovalTimeDays}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex gap-2 justify-end">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditDialog(network)}
                                                    className="h-8 w-8 rounded-lg"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleDelete(network._id)}
                                                    className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
