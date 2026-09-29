"use client";

import dynamic from "next/dynamic";
import { EmergencyMapProps } from "./emergency-map-client";

// Dynamic import with ssr: false ensures Leaflet is only loaded on the client where 'window' is defined
const EmergencyMapClient = dynamic(
    () => import("./emergency-map-client"),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[480px] bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl flex items-center justify-center border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-red-600 border-t-transparent animate-spin" />
                    <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Initializing Real-Time Tactical Map...</p>
                </div>
            </div>
        )
    }
);

export function EmergencyMap(props: EmergencyMapProps) {
    return <EmergencyMapClient {...props} />;
}
