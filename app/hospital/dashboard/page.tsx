"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Phase 8B: Old Hospital Dashboard Route
 * Redirects to the Canonical Hospital Dashboard at /dashboards/hospital
 */
export default function OldHospitalDashboardRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace("/dashboards/hospital");
    }, [router]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm font-semibold">Redirecting to Canonical Hospital Dashboard...</p>
        </div>
    );
}
