"use client";

import React, { Suspense } from "react";
import HospitalEmergencyBoardPage from "@/app/hospital/emergency-board/page";
import { Loader2 } from "lucide-react";

export default function CanonicalHospitalDashboard() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            }
        >
            <HospitalEmergencyBoardPage />
        </Suspense>
    );
}
