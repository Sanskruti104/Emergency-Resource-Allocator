"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, Loader2, Save, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

export const INSTRUMENT_CATEGORIES = [
    {
        label: "ICU Equipment",
        items: [
            { id: "ventilator", name: "Ventilator" },
            { id: "icu_monitor", name: "ICU Monitor" },
            { id: "oxygen_supply", name: "Oxygen Supply" }
        ]
    },
    {
        label: "Imaging Devices",
        items: [
            { id: "mri_scanner", name: "MRI Scanner" },
            { id: "ct_scanner", name: "CT Scanner" },
            { id: "xray_machine", name: "X-Ray Machine" },
            { id: "ultrasound_machine", name: "Ultrasound Machine" }
        ]
    },
    {
        label: "Surgical Systems",
        items: [
            { id: "anesthesia_workstation", name: "Anesthesia Workstation" },
            { id: "cath_lab_system", name: "Cath Lab System" },
            { id: "endoscopy_unit", name: "Endoscopy Unit" },
            { id: "surgical_robot", name: "Surgical Robot" }
        ]
    },
    {
        label: "Emergency Tools",
        items: [
            { id: "defibrillator", name: "Defibrillator" },
            { id: "ecg_monitor", name: "ECG Monitor" }
        ]
    }
];

const allInstruments = INSTRUMENT_CATEGORIES.flatMap(cat => cat.items);

export function InstrumentManager() {
    const [open, setOpen] = React.useState(false)
    const [selected, setSelected] = React.useState<string[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isSaving, setIsSaving] = React.useState(false)
    const [lastVerified, setLastVerified] = React.useState<string | null>(null)

    React.useEffect(() => {
        async function fetchInstruments() {
            try {
                const res = await fetch("/api/hospital/instruments")
                if (res.ok) {
                    const data = await res.json()
                    setSelected(data.available || [])
                    setLastVerified(data.last_verified)
                }
            } catch (error) {
                console.error("Failed to fetch instruments:", error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchInstruments()
    }, [])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const res = await fetch("/api/hospital/instruments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ available: selected })
            })
            if (res.ok) {
                toast.success("Instrument list updated successfully")
                setLastVerified(new Date().toISOString())
            } else {
                toast.error("Failed to update instruments")
            }
        } catch (error) {
            toast.error("An error occurred while saving")
        } finally {
            setIsSaving(false)
        }
    }

    const toggleInstrument = (id: string) => {
        setSelected(prev =>
            prev.includes(id)
                ? prev.filter(item => item !== id)
                : [...prev, id]
        )
    }

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <Card className="w-full max-w-4xl mx-auto rounded-3xl border-border/60 shadow-xl overflow-hidden bg-card/50 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-primary/10 via-transparent to-transparent pb-8">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl font-bold tracking-tight">Instrument Availability</CardTitle>
                        <CardDescription className="text-muted-foreground/80">
                            Declare the medical equipment and instruments available at your facility.
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 font-medium">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Clinical Verification Active
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-8 p-8">
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-6">
                        <div className="space-y-3">
                            <label className="text-sm font-semibold text-foreground/80 ml-1">Search & Add Equipment</label>
                            <Popover open={open} onOpenChange={setOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={open}
                                        className="w-full justify-between h-12 rounded-2xl border-border/80 hover:border-primary/50 transition-all shadow-sm bg-background/50"
                                    >
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Search className="w-4 h-4" />
                                            {selected.length === 0 ? "Select instruments..." : `${selected.length} instrument(s) selected`}
                                        </div>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl border-border/60 shadow-2xl" align="start">
                                    <Command className="rounded-2xl">
                                        <CommandInput placeholder="Search instruments..." className="h-12" />
                                        <CommandList className="max-h-[300px]">
                                            <CommandEmpty>No instrument found.</CommandEmpty>
                                            {INSTRUMENT_CATEGORIES.map((category) => (
                                                <CommandGroup key={category.label} heading={category.label} className="px-2">
                                                    {category.items.map((instrument) => (
                                                        <CommandItem
                                                            key={instrument.id}
                                                            value={instrument.name}
                                                            onSelect={() => toggleInstrument(instrument.id)}
                                                            className="rounded-xl flex items-center justify-between py-3 px-4 cursor-pointer"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn(
                                                                    "w-2 h-2 rounded-full",
                                                                    selected.includes(instrument.id) ? "bg-primary" : "bg-muted"
                                                                )} />
                                                                <span className="font-medium">{instrument.name}</span>
                                                            </div>
                                                            <Check
                                                                className={cn(
                                                                    "h-4 w-4 transition-all",
                                                                    selected.includes(instrument.id) ? "opacity-100 scale-100" : "opacity-0 scale-50"
                                                                )}
                                                            />
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            ))}
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm font-semibold text-foreground/80 ml-1">Selected Capabilities</label>
                            <div className="flex flex-wrap gap-2 min-h-[100px] p-6 rounded-3xl border border-dashed border-border/80 bg-muted/20">
                                {selected.length === 0 ? (
                                    <div className="w-full flex flex-col items-center justify-center text-muted-foreground py-4">
                                        <p className="text-sm">No instruments selected</p>
                                        <p className="text-xs">Your hospital will not be matched for complex treatments</p>
                                    </div>
                                ) : (
                                    selected.map(id => {
                                        const inst = allInstruments.find(i => i.id === id);
                                        return (
                                            <Badge
                                                key={id}
                                                variant="secondary"
                                                className="px-4 py-2 rounded-xl text-sm font-medium bg-primary/5 hover:bg-primary/10 border-primary/20 transition-all group flex items-center gap-2"
                                            >
                                                {inst?.name}
                                                <button
                                                    onClick={() => toggleInstrument(id)}
                                                    className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all ml-1"
                                                >
                                                    &times;
                                                </button>
                                            </Badge>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="md:w-64 space-y-6">
                        <div className="p-6 rounded-3xl bg-primary/[0.03] border border-primary/10 space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-wider text-primary/70">Summary</h4>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Total Available</span>
                                    <span className="font-bold">{selected.length}</span>
                                </div>
                                <div className="flex justify-between text-sm border-t border-border/50 pt-3">
                                    <span className="text-muted-foreground">Status</span>
                                    <span className="font-semibold text-emerald-600">Active</span>
                                </div>
                            </div>
                            <Button
                                className="w-full h-12 rounded-2xl shadow-lg shadow-primary/20 gap-2 font-bold"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Changes
                            </Button>
                        </div>

                        {lastVerified && (
                            <p className="text-[10px] text-center text-muted-foreground">
                                Last updated: {new Date(lastVerified).toLocaleString()}
                            </p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
