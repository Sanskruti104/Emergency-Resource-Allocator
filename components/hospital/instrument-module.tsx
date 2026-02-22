"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Stethoscope, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

const AVAILABLE_INSTRUMENTS = [
    { id: "xray_machine", name: "X-Ray Machine" },
    { id: "mri_scanner", name: "MRI Scanner" },
    { id: "ct_scanner", name: "CT Scanner" },
    { id: "ventilator", name: "Ventilator" },
    { id: "oxygen_supply", name: "Oxygen Supply" },
    { id: "dialysis_unit", name: "Dialysis Unit" },
    { id: "ecg_monitor", name: "ECG Machine" },
    { id: "defibrillator", name: "Defibrillator" },
    { id: "ultrasound_machine", name: "Ultrasound" },
    { id: "endoscopy_unit", name: "Endoscopy Unit" },
    { id: "icu_monitor", name: "ICU Monitor" },
    { id: "anesthesia_workstation", name: "Anesthesia Workstation" },
    { id: "cath_lab_system", name: "Cath Lab (Catheterization)" },
    { id: "orthopedic_tools", name: "Orthopedic Surgical Set" },
    { id: "pet_scan", name: "PET Scan" },
]

interface InstrumentModuleProps {
    selectedInstruments: string[]
    onChange: (instruments: string[]) => void
}

export function InstrumentModule({ selectedInstruments = [], onChange }: InstrumentModuleProps) {
    const [search, setSearch] = useState("")

    const filteredInstruments = AVAILABLE_INSTRUMENTS.filter(i =>
        i.name.toLowerCase().includes(search.toLowerCase())
    )

    const handleToggle = (id: string, checked: boolean) => {
        if (checked) {
            onChange([...selectedInstruments, id])
        } else {
            onChange(selectedInstruments.filter(i => i !== id))
        }
    }

    return (
        <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 border-b">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Stethoscope className="h-5 w-5 text-primary" />
                        <CardTitle>Medical Instruments</CardTitle>
                    </div>
                    <div className="relative w-48 sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search equipment..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-8 text-xs rounded-lg"
                        />
                    </div>
                </div>
                <CardDescription>
                    Select all medical equipment currently operational at your facility to improve treatment compatibility matching.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredInstruments.map((instrument) => (
                        <div
                            key={instrument.id}
                            className="flex items-center space-x-3 p-3 rounded-xl border border-border/40 hover:bg-muted/30 transition-colors"
                        >
                            <Checkbox
                                id={instrument.id}
                                checked={selectedInstruments.includes(instrument.id)}
                                onCheckedChange={(checked) => handleToggle(instrument.id, !!checked)}
                            />
                            <Label
                                htmlFor={instrument.id}
                                className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {instrument.name}
                            </Label>
                        </div>
                    ))}
                    {filteredInstruments.length === 0 && (
                        <div className="col-span-full py-8 text-center text-muted-foreground italic text-sm">
                            No instruments match your search.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
