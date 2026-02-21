"use client"

import { DoctorManager } from "@/components/hospital/DoctorManager"

export default function VisitingDoctorsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Visiting Doctors</h1>
                <p className="text-muted-foreground mt-1">
                    Manage consultant profiles, qualifications, and consultation schedules.
                </p>
            </div>

            <DoctorManager />
        </div>
    )
}
