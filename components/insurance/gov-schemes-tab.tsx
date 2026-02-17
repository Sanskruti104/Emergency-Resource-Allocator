"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface GovScheme {
    _id: string
    schemeName: string
    empanelmentId: string
    activeStatus: boolean
    lastAuditDate: string | null
}

export function GovSchemesTab() {
    const [schemes, setSchemes] = useState<GovScheme[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingScheme, setEditingScheme] = useState<GovScheme | null>(null)
    const [formData, setFormData] = useState({
        schemeName: "",
        empanelmentId: "",
        activeStatus: true,
        lastAuditDate: "",
    })

    useEffect(() => {
        fetchSchemes()
    }, [])

    async function fetchSchemes() {
        try {
            const response = await fetch("/api/hospital/insurance/gov-schemes")
            if (!response.ok) throw new Error("Failed to fetch")
            const data = await response.json()
            setSchemes(data)
        } catch (error) {
            toast.error("Failed to load government schemes")
        } finally {
            setIsLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        try {
            const url = editingScheme
                ? `/api/hospital/insurance/gov-schemes/${editingScheme._id}`
                : "/api/hospital/insurance/gov-schemes"
            const method = editingScheme ? "PUT" : "POST"

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            if (!response.ok) throw new Error("Failed to save")

            toast.success(editingScheme ? "Scheme updated" : "Scheme added")
            setIsDialogOpen(false)
            resetForm()
            fetchSchemes()
        } catch (error) {
            toast.error("Failed to save scheme")
        }
    }

    async function handleDelete(id: string) {
        if (!confirm("Delete this government scheme?")) return

        try {
            const response = await fetch(`/api/hospital/insurance/gov-schemes/${id}`, {
                method: "DELETE",
            })
            if (!response.ok) throw new Error("Failed to delete")
            toast.success("Scheme deleted")
            fetchSchemes()
        } catch (error) {
            toast.error("Failed to delete scheme")
        }
    }

    function resetForm() {
        setFormData({
            schemeName: "",
            empanelmentId: "",
            activeStatus: true,
            lastAuditDate: "",
        })
        setEditingScheme(null)
    }

    function openEditDialog(scheme: GovScheme) {
        setEditingScheme(scheme)
        setFormData({
            schemeName: scheme.schemeName,
            empanelmentId: scheme.empanelmentId,
            activeStatus: scheme.activeStatus,
            lastAuditDate: scheme.lastAuditDate ? new Date(scheme.lastAuditDate).toISOString().split('T')[0] : "",
        })
        setIsDialogOpen(true)
    }

    return (
        <Card className="rounded-2xl border-border/60 shadow-sm">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Government Scheme Empanelment</CardTitle>
                        <CardDescription>Manage your empanelment status for government health schemes</CardDescription>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open)
                        if (!open) resetForm()
                    }}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl gap-2">
                                <Plus className="h-4 w-4" />
                                Add Scheme
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingScheme ? "Edit" : "Add"} Government Scheme</DialogTitle>
                                <DialogDescription>Configure empanelment details for government health schemes</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Scheme Name *</Label>
                                    <Input
                                        required
                                        value={formData.schemeName}
                                        onChange={(e) => setFormData({ ...formData, schemeName: e.target.value })}
                                        placeholder="e.g., Ayushman Bharat, CGHS"
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Empanelment ID</Label>
                                    <Input
                                        value={formData.empanelmentId}
                                        onChange={(e) => setFormData({ ...formData, empanelmentId: e.target.value })}
                                        placeholder="e.g., AB-12345"
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Last Audit Date</Label>
                                    <Input
                                        type="date"
                                        value={formData.lastAuditDate}
                                        onChange={(e) => setFormData({ ...formData, lastAuditDate: e.target.value })}
                                        className="rounded-xl"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="activeStatus"
                                        checked={formData.activeStatus}
                                        onChange={(e) => setFormData({ ...formData, activeStatus: e.target.checked })}
                                        className="rounded"
                                    />
                                    <Label htmlFor="activeStatus" className="cursor-pointer">Active Status</Label>
                                </div>

                                <div className="flex gap-2 justify-end pt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-xl">
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="rounded-xl">
                                        {editingScheme ? "Update" : "Add"} Scheme
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
                ) : schemes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No government schemes added yet</div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {schemes.map((scheme) => (
                            <Card key={scheme._id} className="rounded-xl">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-2 flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold">{scheme.schemeName}</h3>
                                                {scheme.activeStatus ? (
                                                    <Badge className="rounded-lg bg-green-100 text-green-700 hover:bg-green-100">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Active
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="rounded-lg">
                                                        <XCircle className="h-3 w-3 mr-1" />
                                                        Inactive
                                                    </Badge>
                                                )}
                                            </div>
                                            {scheme.empanelmentId && (
                                                <div className="text-sm">
                                                    <span className="text-muted-foreground">ID: </span>
                                                    <span className="font-mono">{scheme.empanelmentId}</span>
                                                </div>
                                            )}
                                            {scheme.lastAuditDate && (
                                                <div className="text-sm text-muted-foreground">
                                                    Last Audit: {new Date(scheme.lastAuditDate).toLocaleDateString()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEditDialog(scheme)}
                                                className="h-8 w-8 rounded-lg"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDelete(scheme._id)}
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
