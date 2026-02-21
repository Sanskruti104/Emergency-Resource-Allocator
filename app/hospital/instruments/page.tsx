"use client"

import { InstrumentManager } from "@/components/hospital/InstrumentManager"

export default function InstrumentsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Instruments & Equipment</h1>
                <p className="text-muted-foreground mt-1">
                    Manage your hospital's medical capabilities and instrument availability.
                </p>
            </div>

            <InstrumentManager />
        </div>
    )
}
