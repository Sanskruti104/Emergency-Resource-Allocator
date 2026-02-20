"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    MapPin,
    Phone,
    Clock,
    ShieldCheck,
    Stethoscope,
    Award,
    Bed,
    Activity,
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Image as ImageIcon,
    ExternalLink,
    ChevronRight
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

const MiniMap = dynamic(() => import("@/components/map/mini-map"), {
    ssr: false,
    loading: () => <Skeleton className="h-full w-full rounded-2xl" />
});

interface HospitalDetail {
    hospitalId: string;
    hospitalName: string;
    description: string;
    specialties: string[];
    achievements: string[];
    city: string;
    state: string;
    helplineNumber: string;
    opdTiming: {
        mondayToFriday: string;
        saturday: string;
        sunday: string;
    };
    capacity: {
        totalBeds: number;
        availableBeds: number;
        icuBeds: number;
        emergencyAvailable: boolean;
    };
    insuranceNetworks: string[];
    governmentSchemes: string[];
    media: {
        exteriorImages: string[];
        galleryImages: string[];
        virtualTourLink: string;
    };
    latitude: number;
    longitude: number;
}

export default function HospitalDetailPage() {
    const { hospitalId } = useParams();
    const router = useRouter();
    const [hospital, setHospital] = useState<HospitalDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchHospital() {
            try {
                const res = await fetch(`/api/hospital/public/${hospitalId}`, { cache: 'no-store' });
                if (!res.ok) {
                    if (res.status === 404) throw new Error("Hospital not found");
                    throw new Error("Failed to load hospital details");
                }
                const data = await res.json();
                setHospital(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchHospital();
    }, [hospitalId]);

    if (loading) return <HospitalSkeleton />;
    if (error || !hospital) return <ErrorState message={error || "Hospital not found"} />;

    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />

            <main className="flex-1 container max-w-6xl py-10 px-4 md:px-6 space-y-10 animate-in fade-in duration-500">

                {/* Breadcrumb / Back */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Network Map
                </Link>

                {/* Header Section */}
                <Card className="rounded-[2rem] border-none shadow-sm bg-white overflow-hidden border border-slate-100/50">
                    <CardContent className="p-8 md:p-12">
                        <div className="flex flex-col lg:flex-row gap-8 justify-between">
                            <div className="space-y-6 flex-1">
                                <div className="space-y-3">
                                    <div className="flex flex-wrap gap-2">
                                        {hospital.specialties.map((spec, i) => (
                                            <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-600 border-none font-medium px-3">
                                                {spec}
                                            </Badge>
                                        ))}
                                    </div>
                                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
                                        {hospital.hospitalName}
                                    </h1>
                                    <p className="flex items-center gap-2 text-xl text-slate-500 font-medium">
                                        <MapPin className="h-5 w-5 text-primary/70" />
                                        {hospital.city}, {hospital.state}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {hospital.achievements.map((ach, i) => (
                                        <Badge key={i} variant="outline" className="flex items-center gap-1.5 border-amber-200 bg-amber-50/50 text-amber-700 font-semibold px-4 py-1.5 rounded-full">
                                            <Award className="h-4 w-4 text-amber-500" />
                                            {ach}
                                        </Badge>
                                    ))}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                                    <Button asChild size="lg" className="rounded-2xl h-14 px-8 text-lg font-bold">
                                        <a href={`tel:${hospital.helplineNumber}`} className="flex items-center gap-2">
                                            <Phone className="h-5 w-5" />
                                            Call Helpline: {hospital.helplineNumber}
                                        </a>
                                    </Button>
                                </div>
                            </div>

                            {/* Map Thumbnail Side */}
                            <div className="w-full lg:w-80 h-64 rounded-[2rem] overflow-hidden border border-slate-100 shadow-sm relative group cursor-pointer" onClick={() => (window.open(`https://www.google.com/maps/search/?api=1&query=${hospital.latitude},${hospital.longitude}`))}>
                                <MiniMap lat={hospital.latitude} lng={hospital.longitude} hospitalName={hospital.hospitalName} />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                                    <div className="bg-white/90 backdrop-blur-sm p-3 rounded-2xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-sm font-bold text-slate-900">
                                        Open in Maps <ExternalLink className="h-4 w-4" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Info Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                    <div className="lg:col-span-8 space-y-10">
                        {/* About Section */}
                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-slate-900 border-l-4 border-primary pl-4">About the Hospital</h2>
                            <p className="text-lg text-slate-600 leading-relaxed max-w-3xl">
                                {hospital.description}
                            </p>
                        </section>

                        {/* Timings Section */}
                        <section className="space-y-4">
                            <h2 className="text-2xl font-bold text-slate-900 border-l-4 border-primary pl-4">OPD Timings</h2>
                            <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/30">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Day Range</th>
                                            <th className="px-6 py-4 text-sm font-bold text-slate-500 uppercase tracking-wider">Timing</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="px-6 py-4 font-semibold text-slate-900">Monday – Friday</td>
                                            <td className="px-6 py-4 text-slate-600">{hospital.opdTiming.mondayToFriday}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-6 py-4 font-semibold text-slate-900">Saturday</td>
                                            <td className="px-6 py-4 text-slate-600">{hospital.opdTiming.saturday}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-6 py-4 font-semibold text-slate-900">Sunday</td>
                                            <td className="px-6 py-4">
                                                {hospital.opdTiming.sunday.toLowerCase() === 'closed' ? (
                                                    <span className="text-rose-600 font-bold uppercase text-xs tracking-widest bg-rose-50 px-2 py-1 rounded-md">Closed</span>
                                                ) : (
                                                    <span className="text-slate-600">{hospital.opdTiming.sunday}</span>
                                                )}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        {/* Media Section */}
                        <section className="space-y-6">
                            <h2 className="text-2xl font-bold text-slate-900 border-l-4 border-primary pl-4">Hospital Imagery</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {hospital.media.exteriorImages.length > 0 ? hospital.media.exteriorImages.slice(0, 2).map((img, i) => (
                                    <div key={i} className="aspect-video rounded-3xl overflow-hidden bg-slate-100 border border-slate-100 relative group">
                                        <img src={img} alt="Exterior" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-900">Exterior View</div>
                                    </div>
                                )) : (
                                    <div className="aspect-video rounded-3xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-slate-400">
                                        <ImageIcon className="h-10 w-10 mb-2 opacity-20" />
                                        <span className="text-sm font-medium">No exterior images available</span>
                                    </div>
                                )}
                            </div>

                            {/* Virtual Tour */}
                            {hospital.media.virtualTourLink && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-primary font-bold">
                                        <Activity className="h-5 w-5" />
                                        Experience a Virtual Tour
                                    </div>
                                    <div className="w-full h-[450px] rounded-3xl overflow-hidden border border-slate-100 shadow-sm bg-slate-900">
                                        <iframe
                                            src={hospital.media.virtualTourLink}
                                            className="w-full h-full border-none"
                                            title="Hospital 360 Tour"
                                        />
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="lg:col-span-4 space-y-8">
                        {/* Capacity Section */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <Activity className="h-5 w-5 text-primary" />
                                Factual Capacity
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                                <CapacityCard icon={Bed} label="Total Beds" value={hospital.capacity.totalBeds} />
                                <CapacityCard icon={CheckCircle2} label="Available Beds" value={hospital.capacity.availableBeds} color="emerald" />
                                <CapacityCard icon={Stethoscope} label="ICU Beds" value={hospital.capacity.icuBeds} color="blue" />
                                <CapacityCard
                                    icon={AlertCircle}
                                    label="Emergency Care"
                                    value={hospital.capacity.emergencyAvailable ? "YES" : "NO"}
                                    color={hospital.capacity.emergencyAvailable ? "rose" : "slate"}
                                />
                            </div>
                        </div>

                        {/* Insurance Section */}
                        <div className="space-y-6 pt-4">
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                    Accepted Insurance
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {hospital.insuranceNetworks.length > 0 ? hospital.insuranceNetworks.map((net, i) => (
                                        <Badge key={i} className="bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium px-4 py-1 rounded-lg">
                                            {net}
                                        </Badge>
                                    )) : <p className="text-sm text-slate-400 italic">No insurance information registered.</p>}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Award className="h-5 w-5 text-blue-600" />
                                    Govt. Support Schemes
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {hospital.governmentSchemes.length > 0 ? hospital.governmentSchemes.map((sch, i) => (
                                        <Badge key={i} className="bg-blue-50 text-blue-700 border border-blue-100 font-bold px-4 py-1 rounded-lg">
                                            {sch}
                                        </Badge>
                                    )) : <p className="text-sm text-slate-400 italic">No government schemes listed.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>


            </main>

            <Footer />
        </div>
    );
}

function CapacityCard({ icon: Icon, label, value, color = "default" }: { icon: any, label: string, value: string | number, color?: string }) {
    const colors: Record<string, string> = {
        default: "bg-slate-50 text-slate-900 border-slate-100",
        emerald: "bg-emerald-50 text-emerald-900 border-emerald-100",
        rose: "bg-rose-50 text-rose-900 border-rose-100",
        blue: "bg-blue-50 text-blue-900 border-blue-100",
        slate: "bg-slate-100 text-slate-500 border-slate-200"
    };

    return (
        <div className={`p-6 rounded-3xl border ${colors[color]} flex items-center justify-between shadow-sm`}>
            <div className="space-y-0.5">
                <p className="text-xs font-bold uppercase tracking-widest opacity-60">{label}</p>
                <p className="text-3xl font-black">{value}</p>
            </div>
            <div className={`p-3 rounded-2xl ${color === 'default' ? 'bg-white' : 'bg-white/50 shadow-inner'}`}>
                <Icon className="h-6 w-6 opacity-80" />
            </div>
        </div>
    );
}

function HospitalSkeleton() {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="container max-w-6xl py-10 px-6 space-y-10">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-[400px] w-full rounded-[2rem]" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                    <div className="md:col-span-2 space-y-10">
                        <Skeleton className="h-64 rounded-3xl" />
                        <Skeleton className="h-48 rounded-3xl" />
                    </div>
                    <div className="space-y-8">
                        <Skeleton className="h-40 rounded-3xl" />
                        <Skeleton className="h-40 rounded-3xl" />
                    </div>
                </div>
            </main>
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="h-24 w-24 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-8 border border-rose-100">
                    <AlertCircle className="h-12 w-12" />
                </div>
                <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Hospital Not Accessible</h1>
                <p className="text-slate-500 mb-10 text-lg font-medium max-w-md leading-relaxed">{message}</p>
                <div className="flex gap-4">
                    <Button onClick={() => window.location.reload()} size="lg" className="rounded-2xl px-8 h-12">Search Again</Button>
                    <Button variant="outline" asChild size="lg" className="rounded-2xl px-8 h-12">
                        <Link href="/">Back to Map</Link>
                    </Button>
                </div>
            </main>
            <Footer />
        </div>
    );
}
