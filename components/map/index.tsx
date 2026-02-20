"use client";

import dynamic from 'next/dynamic';

// Use dynamic import with ssr: false because Leaflet relies on the 'window' object
const HospitalMapClient = dynamic(
    () => import('./hospital-map-client'),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-[600px] bg-muted/10 animate-pulse rounded-3xl flex items-center justify-center border border-border/50">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                    <p className="text-muted-foreground font-medium">Initializing Interactive Map...</p>
                </div>
            </div>
        )
    }
);

export function InteractiveHospitalMap() {
    return (
        <section className="container py-16 scroll-mt-20" id="hospital-map">
            <HospitalMapClient />
        </section>
    );
}
