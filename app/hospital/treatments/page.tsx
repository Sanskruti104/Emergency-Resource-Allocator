"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    Plus,
    Search,
    MoreVertical,
    Edit,
    Trash2,
    Clock,
    IndianRupee,
    ShieldCheck,
    Loader2,
    Stethoscope
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Treatment {
    _id: string;
    treatmentName: string;
    costMin: number;
    costMax: number;
    recoveryDays: number;
    insuranceNotes: string;
    createdAt: string;
}

export default function TreatmentsPage() {
    const [treatments, setTreatments] = useState<Treatment[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null)

    useEffect(() => {
        fetchTreatments()
    }, [])

    async function fetchTreatments() {
        try {
            const response = await fetch("/api/hospital/treatments")
            if (!response.ok) {
                const text = await response.text();
                console.error(`Fetch treatments failed (${response.status}):`, text.substring(0, 100));
                throw new Error(`Failed to fetch treatments: ${response.status}`);
            }
            const data = await response.json()
            setTreatments(Array.isArray(data) ? data : [])
        } catch (error: any) {
            console.error("Treatments fetch error:", error);
            toast.error(error.message || "Failed to fetch treatments")
        } finally {
            setIsLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        const formData = new FormData(e.currentTarget)
        const data = {
            treatmentName: formData.get("treatmentName"),
            costMin: Number(formData.get("costMin")),
            costMax: Number(formData.get("costMax")),
            recoveryDays: Number(formData.get("recoveryDays")),
            insuranceNotes: formData.get("insuranceNotes"),
        }

        try {
            const url = editingTreatment
                ? `/api/hospital/treatments/${editingTreatment._id}`
                : "/api/hospital/treatments"
            const method = editingTreatment ? "PUT" : "POST"

            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to save: ${response.status}`)
            }

            toast.success(editingTreatment ? "Treatment updated!" : "Treatment added!")
            setIsOpen(false)
            setEditingTreatment(null)
            fetchTreatments()
        } catch (error: any) {
            console.error("Save treatment error:", error);
            toast.error(error.message || "Failed to save treatment")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this treatment?")) return

        try {
            const response = await fetch(`/api/hospital/treatments/${id}`, {
                method: "DELETE",
            })
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to delete: ${response.status}`)
            }
            toast.success("Treatment deleted")
            fetchTreatments()
        } catch (error: any) {
            console.error("Delete treatment error:", error);
            toast.error(error.message || "Failed to delete treatment")
        }
    }

    const filteredTreatments = treatments.filter(t =>
        t.treatmentName.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (isLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Treatments & Pricing</h1>
                    <p className="text-muted-foreground mt-1">Manage medical procedures, costs, and insurance details.</p>
                </div>

                <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) setEditingTreatment(null); }}>
                    <DialogTrigger asChild>
                        <Button className="rounded-xl gap-2 shadow-lg shadow-primary/20">
                            <Plus className="h-4 w-4" />
                            Add Treatment
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] rounded-2xl">
                        <DialogHeader>
                            <DialogTitle>{editingTreatment ? "Edit Treatment" : "Add New Treatment"}</DialogTitle>
                            <DialogDescription>
                                Set treatment pricing and recovery estimates for patients.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="treatmentName">Treatment Name</Label>
                                <Input id="treatmentName" name="treatmentName" defaultValue={editingTreatment?.treatmentName} placeholder="E.g. Laparoscopic Surgery" className="rounded-xl" required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="costMin">Min Cost (₹)</Label>
                                    <Input id="costMin" name="costMin" type="number" defaultValue={editingTreatment?.costMin} placeholder="0" className="rounded-xl" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="costMax">Max Cost (₹)</Label>
                                    <Input id="costMax" name="costMax" type="number" defaultValue={editingTreatment?.costMax} placeholder="0" className="rounded-xl" required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="recoveryDays">Estimated Recovery (Days)</Label>
                                <Input id="recoveryDays" name="recoveryDays" type="number" defaultValue={editingTreatment?.recoveryDays} placeholder="E.g. 5" className="rounded-xl" required />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="insuranceNotes">Insurance & Policy Notes</Label>
                                <Input id="insuranceNotes" name="insuranceNotes" defaultValue={editingTreatment?.insuranceNotes} placeholder="E.g. Covered by most pvt insurances" className="rounded-xl" />
                            </div>
                            <DialogFooter className="pt-4">
                                <Button type="submit" className="w-full rounded-xl gap-2" disabled={isSubmitting}>
                                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {editingTreatment ? "Update Treatment" : "Create Treatment"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search treatments by name..."
                            className="pl-9 rounded-xl border-border/60 max-w-md bg-white"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredTreatments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                            <Stethoscope className="h-12 w-12 opacity-20 mb-4" />
                            <p>No treatments found. Start by adding your first service.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/60">
                            {filteredTreatments.map((treatment) => (
                                <div key={treatment._id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:bg-muted/10 transition-colors">
                                    <div className="space-y-1 flex-1">
                                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                            {treatment.treatmentName}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                            <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-blue-100">
                                                <IndianRupee className="h-3 w-3" />
                                                ₹{treatment.costMin.toLocaleString()} - ₹{treatment.costMax.toLocaleString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-amber-100">
                                                <Clock className="h-3 w-3" />
                                                ~{treatment.recoveryDays} Days Recovery
                                            </div>
                                            {treatment.insuranceNotes && (
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                                                    {treatment.insuranceNotes}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="rounded-xl h-9 w-9"
                                            onClick={() => {
                                                setEditingTreatment(treatment)
                                                setIsOpen(true)
                                            }}
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="rounded-xl h-9 w-9 text-destructive hover:bg-destructive/10"
                                            onClick={() => handleDelete(treatment._id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
