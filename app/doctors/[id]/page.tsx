"use client"

import * as React from "react"
import {
    MapPin,
    Award,
    Clock,
    GraduationCap,
    ArrowLeft,
    ShieldCheck,
    Stethoscope,
    Building2,
    CalendarCheck,
    Phone,
    UserCircle,
    CheckCircle2,
    Mail,
    Share2,
    Heart,
    Star,
    Loader2
} from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"

export default function DoctorProfilePage() {
    const params = useParams()
    const router = useRouter()
    const id = params.id as string

    const [data, setData] = React.useState<any>(null)
    const [isLoading, setIsLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [selectedHospital, setSelectedHospital] = React.useState<any>(null)

    const getAvailabilityStatus = (schedule: any) => {
        if (!schedule || !schedule.days || !schedule.startTime || !schedule.endTime) {
            return { status: "Schedule Not Available", color: "text-slate-400", bg: "bg-slate-50", isAvailable: false };
        }

        try {
            const now = new Date();
            const currentDayNum = now.getDay();
            const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
            const currentDayStr = days[currentDayNum];

            const isTodayAvailable = schedule.days.includes(currentDayStr);

            if (isTodayAvailable) {
                const [startHours, startMins] = schedule.startTime.split(':').map(Number);
                const [endHours, endMins] = schedule.endTime.split(':').map(Number);

                const start = new Date(now);
                start.setHours(startHours, startMins, 0);

                const end = new Date(now);
                end.setHours(endHours, endMins, 0);

                if (now >= start && now <= end) {
                    return { status: "Available Now", color: "text-emerald-600", bg: "bg-emerald-50", isAvailable: true };
                } else if (now < start) {
                    return { status: `Opens at ${schedule.startTime}`, color: "text-amber-600", bg: "bg-amber-50", isAvailable: false };
                } else {
                    return { status: "Closed for Today", color: "text-red-600", bg: "bg-red-50", isAvailable: false };
                }
            }

            return { status: "Not Available Today", color: "text-slate-500", bg: "bg-slate-50", isAvailable: false };
        } catch (err) {
            return { status: "Availability Unknown", color: "text-slate-400", bg: "bg-slate-50", isAvailable: false };
        }
    }

    React.useEffect(() => {
        if (!id || typeof id !== 'string') return;

        let isMounted = true;
        async function fetchDoctorDetail() {
            try {
                setIsLoading(true);
                const res = await fetch(`/api/public/doctors/${id}`);
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "Doctor not found");
                }
                const result = await res.json();
                if (isMounted) setData(result);
            } catch (err: any) {
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }
        fetchDoctorDetail();
        return () => { isMounted = false; };
    }, [id])

    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center space-y-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-slate-500 font-medium">Loading clinical profile...</p>
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center space-y-6">
                <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                    <Stethoscope className="h-10 w-10" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900">{error || "Doctor Profile Not Found"}</h1>
                <Button onClick={() => router.back()} variant="outline" className="rounded-xl px-8 h-12">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
            </div>
        )
    }

    const { profile, hospitals } = data

    return (
        <div className="flex min-h-screen flex-col bg-white">
            <Navbar />
            <main className="flex-1">
                {/* Header Breadcrumb */}
                <div className="bg-slate-50 border-b border-slate-100">
                    <div className="container mx-auto px-4 max-w-6xl py-4 flex items-center gap-2 text-sm text-slate-500">
                        <Link href="/" className="hover:text-primary transition-colors">Home</Link>
                        <span>/</span>
                        <Link href="/doctors/search" className="hover:text-primary transition-colors">Find Doctors</Link>
                        <span>/</span>
                        <span className="text-slate-900 font-medium">{profile.name}</span>
                    </div>
                </div>

                <div className="container mx-auto px-4 max-w-6xl py-12 lg:py-16">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                        {/* LEFT COLUMN: Profile Info */}
                        <div className="lg:col-span-5 space-y-8">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-500 rounded-[2.5rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                                <div className="relative bg-white p-2 rounded-[2.5rem] shadow-sm">
                                    <Avatar className="h-full w-full aspect-square rounded-[2rem] border-4 border-white shadow-xl overflow-hidden">
                                        <AvatarImage src={profile.profilePhoto} className="object-cover" />
                                        <AvatarFallback className="bg-slate-100 text-slate-400 text-7xl font-bold">
                                            {profile.name.split(' ').map((n: string) => n[0]).join('')}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="absolute top-6 left-6">
                                        <Badge className="bg-white/90 backdrop-blur-sm text-emerald-600 border-none shadow-lg px-3 py-1.5 flex items-center gap-1.5 font-bold">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Verified Expert
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{profile.name}</h1>
                                    <p className="text-lg font-bold text-primary mt-1 uppercase tracking-wide">{profile.specialization}</p>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-slate-200">
                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                                            <GraduationCap className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Qualification</p>
                                            <p className="text-slate-900 font-bold">{profile.qualification}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                                            <Award className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Experience</p>
                                            <p className="text-slate-900 font-bold">{profile.experience} Years in Practice</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                                            <MapPin className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Primary Clinic Address</p>
                                            <p className="text-slate-700 font-medium italic">Available on consultation at major hospitals across the city.</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-white flex items-center justify-center shrink-0 border border-slate-100 shadow-sm">
                                            <ShieldCheck className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Registration No.</p>
                                            <p className="text-slate-900 font-bold">{profile.registrationNumber}</p>
                                        </div>
                                    </div>
                                </div>


                            </div>
                        </div>

                        {/* RIGHT COLUMN: Hospital Affiliations & Schedule */}
                        <div className="lg:col-span-7 space-y-10">
                            <div>
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                        <h2 className="text-2xl font-bold text-slate-900">Hospital Affiliations</h2>
                                    </div>
                                    <Badge variant="secondary" className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-bold border-none">
                                        {hospitals.length} Medical Center(s)
                                    </Badge>
                                </div>

                                <div className="grid gap-6">
                                    {hospitals.map((hospital: any, index: number) => {
                                        const availability = getAvailabilityStatus(hospital.schedule);
                                        return (
                                            <Card
                                                key={index}
                                                onClick={() => setSelectedHospital(hospital)}
                                                className="overflow-hidden rounded-3xl border-slate-200 shadow-sm group hover:shadow-xl hover:border-primary/20 transition-all duration-300 cursor-pointer"
                                            >
                                                <CardContent className="p-0 flex flex-col md:flex-row h-full">
                                                    <div className="md:w-1/3 bg-slate-50 p-8 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100">
                                                        <div className="bg-white h-12 w-12 rounded-xl flex items-center justify-center shadow-sm mb-4">
                                                            <Building2 className="w-6 h-6 text-primary" />
                                                        </div>
                                                        <h3 className="text-lg font-bold text-slate-900 leading-tight mb-2">
                                                            {hospital.hospitalName}
                                                        </h3>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold mb-3">
                                                            <MapPin className="w-3.5 h-3.5" />
                                                            <span>Pune Metropolitan</span>
                                                        </div>
                                                        <Badge className={cn("w-fit px-3 py-1 rounded-full text-[10px] font-bold border-none", availability.bg, availability.color)}>
                                                            {availability.status}
                                                        </Badge>
                                                    </div>

                                                    <div className="flex-1 p-8 space-y-6 bg-white">
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                            <div className="space-y-4 flex-1">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                                                        <Clock className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Consultation Timings</p>
                                                                        <p className="text-sm font-bold text-slate-900">
                                                                            {hospital.schedule.startTime} - {hospital.schedule.endTime}
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-start gap-3">
                                                                    <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                                                        <CalendarCheck className="w-4 h-4" />
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Availability Days</p>
                                                                        <div className="flex flex-wrap gap-1.5">
                                                                            {hospital.schedule.days.map((day: string) => (
                                                                                <Badge key={day} variant="outline" className="px-2 py-0.5 rounded-lg text-[10px] font-black border-slate-200 text-slate-600 bg-slate-50 uppercase">
                                                                                    {day}
                                                                                </Badge>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col gap-2">
                                                                <Button className="rounded-xl h-12 px-6 font-bold shadow-lg shadow-primary/10 gap-2 shrink-0">
                                                                    <CalendarCheck className="w-4 h-4" />
                                                                    Book Appointment
                                                                </Button>
                                                                <Button variant="ghost" className="rounded-xl h-12 px-6 text-slate-500 hover:text-primary transition-colors text-sm font-bold underline underline-offset-4">
                                                                    Contact Facility
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            </div>


                        </div>
                    </div>
                </div>
            </main>
            <Footer />

            {/* Consultation Details Modal */}
            <Dialog open={!!selectedHospital} onOpenChange={(open) => !open && setSelectedHospital(null)}>
                <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl bg-white">
                    {selectedHospital && (
                        <div className="flex flex-col">
                            <div className="bg-slate-900 p-12 text-white relative">
                                <div className="absolute top-0 right-0 h-32 w-32 bg-primary/20 blur-[60px]" />
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-primary">
                                            <Building2 className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-3xl font-bold text-white">{selectedHospital.hospitalName}</DialogTitle>
                                            <DialogDescription className="text-slate-400 font-medium">Pune Metropolitan Region</DialogDescription>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Badge className={cn("px-4 py-1.5 rounded-full text-xs font-bold border-none", getAvailabilityStatus(selectedHospital.schedule).bg, getAvailabilityStatus(selectedHospital.schedule).color)}>
                                            {getAvailabilityStatus(selectedHospital.schedule).status}
                                        </Badge>
                                        <Badge variant="outline" className="px-4 py-1.5 rounded-full text-xs font-bold border-white/20 text-white/80">
                                            Established Facility
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="p-12 space-y-10 bg-white">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                                <Clock className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consultation Timings</p>
                                                <p className="text-lg font-bold text-slate-900">{selectedHospital.schedule.startTime} - {selectedHospital.schedule.endTime}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                                <CalendarCheck className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Available Days</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedHospital.schedule.days.map((day: string) => (
                                                        <Badge key={day} className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:scale-105">
                                                            {day}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                                <Phone className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Appointment Helpdesk</p>
                                                <p className="text-lg font-bold text-slate-900">+91 20 4567 8900</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                                <ShieldCheck className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Verified OPD</p>
                                                <p className="text-sm font-medium text-slate-600 leading-relaxed">This schedule is directly verified by {selectedHospital.hospitalName} administration.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-8 border-t border-slate-100 flex flex-col md:flex-row gap-6 items-center justify-between">
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">To Book Appointment</p>
                                        <p className="text-slate-600 font-medium">Please contact the hospital helpdesk directly at <span className="text-primary font-bold">+91 20 4567 8900</span></p>
                                    </div>
                                    <Button asChild variant="outline" className="h-14 px-10 rounded-2xl border-slate-200 font-bold hover:bg-slate-50 transition-all shrink-0">
                                        <Link href={`/hospitals/${selectedHospital.hospitalId}`}>
                                            View Hospital Profile
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
