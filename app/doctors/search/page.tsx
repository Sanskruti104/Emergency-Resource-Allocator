"use client"

import * as React from "react"
import {
    Search,
    MapPin,
    Award,
    Clock,
    GraduationCap,
    ArrowLeft,
    Filter,
    SearchX,
    ShieldCheck,
    Stethoscope,
    ChevronLeft,
    ChevronRight,
    Building2,
    CalendarCheck,
    Phone,
    UserCircle,
    CheckCircle2
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { cn } from "@/lib/utils"

export default function EnhancedDoctorSearchPage() {
    // Search & Filter State
    const [searchTerm, setSearchTerm] = React.useState("")
    const [selectedHospital, setSelectedHospital] = React.useState("all")
    const [selectedSpecialty, setSelectedSpecialty] = React.useState("all")

    // Data State
    const [doctors, setDoctors] = React.useState<any[]>([])
    const [hospitals, setHospitals] = React.useState<any[]>([])
    const [specialties, setSpecialties] = React.useState<any[]>([])
    const [pagination, setPagination] = React.useState({ total: 0, page: 1, limit: 9, totalPages: 1 })

    // UI State
    const [isLoading, setIsLoading] = React.useState(true)

    const fetchDoctors = React.useCallback(async (page = 1) => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: "9",
                ...(searchTerm && { name: searchTerm }),
                ...(selectedHospital !== "all" && { hospitalId: selectedHospital }),
                ...(selectedSpecialty !== "all" && { specialty: selectedSpecialty }),
            });

            const res = await fetch(`/api/public/doctors?${params.toString()}`)
            if (res.ok) {
                const data = await res.json()
                setDoctors(data.doctors)
                setPagination(data.pagination)
                setHospitals(data.filters.hospitals)
                setSpecialties(data.filters.specialties)
            }
        } catch (error) {
            console.error("Failed to fetch doctors:", error)
        } finally {
            setIsLoading(false)
        }
    }, [searchTerm, selectedHospital, selectedSpecialty])

    React.useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchDoctors(1)
        }, 300)

        return () => clearTimeout(delayDebounceFn)
    }, [fetchDoctors])

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchDoctors(newPage)
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
            <Navbar />
            <main className="flex-1">
                {/* Hero Search Section */}
                <section className="bg-slate-900 py-16 md:py-24 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20">
                        <div className="absolute top-0 right-0 h-96 w-96 bg-primary blur-[120px]" />
                        <div className="absolute bottom-0 left-0 h-64 w-64 bg-blue-500 blur-[100px]" />
                    </div>

                    <div className="container mx-auto px-4 max-w-6xl relative z-10">
                        <div className="flex flex-col items-center text-center space-y-8">
                            <div className="space-y-4 max-w-3xl">
                                <Badge className="bg-primary/20 text-primary border-primary/30 px-4 py-1.5 rounded-full text-sm font-bold animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    Trusted Medical Experts
                                </Badge>
                                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white leading-tight">
                                    Find the Right <span className="text-primary italic">Doctor</span> for You
                                </h1>
                                <p className="text-slate-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                                    Search across our network of certified specialists and world-class hospitals.
                                </p>
                            </div>

                            <div className="w-full max-w-4xl bg-white p-2 rounded-3xl shadow-2xl flex flex-col md:flex-row gap-2">
                                <div className="flex-1 relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                    <Input
                                        placeholder="Search by Doctor Name..."
                                        className="h-14 pl-12 border-none bg-transparent text-lg focus-visible:ring-0"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="hidden md:block w-px h-10 bg-slate-200 my-auto" />
                                <div className="flex-1">
                                    <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                                        <SelectTrigger className="h-14 border-none bg-transparent text-lg focus:ring-0">
                                            <div className="flex items-center gap-2">
                                                <Stethoscope className="w-5 h-5 text-primary" />
                                                <SelectValue placeholder="All Specialities" />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl">
                                            <SelectItem value="all">All Specialities</SelectItem>
                                            {specialties.map(s => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button className="h-14 md:h-auto rounded-2xl px-10 font-bold text-lg shadow-lg shadow-primary/20">
                                    Filter Doctors
                                </Button>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="container mx-auto px-4 max-w-7xl py-12">
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Sidebar Filters */}
                        <aside className="w-full lg:w-72 space-y-8">
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-lg text-slate-900">Filters</h3>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-primary font-bold hover:bg-primary/5"
                                        onClick={() => {
                                            setSearchTerm("")
                                            setSelectedHospital("all")
                                            setSelectedSpecialty("all")
                                        }}
                                    >
                                        Reset
                                    </Button>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Hospital</label>
                                    <Select value={selectedHospital} onValueChange={setSelectedHospital}>
                                        <SelectTrigger className="rounded-xl border-slate-200 bg-slate-50">
                                            <SelectValue placeholder="Select Hospital" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">All Hospitals</SelectItem>
                                            {hospitals.map(h => (
                                                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-sm font-bold text-slate-500 uppercase tracking-wider">Specialization</label>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        <button
                                            onClick={() => setSelectedSpecialty("all")}
                                            className={cn(
                                                "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                                selectedSpecialty === "all" ? "bg-primary text-white shadow-md" : "hover:bg-slate-50 text-slate-600"
                                            )}
                                        >
                                            All Specialities
                                        </button>
                                        {specialties.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setSelectedSpecialty(s)}
                                                className={cn(
                                                    "w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all",
                                                    selectedSpecialty === s ? "bg-primary text-white shadow-md" : "hover:bg-slate-50 text-slate-600"
                                                )}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-primary to-blue-600 p-8 rounded-3xl text-white space-y-6 shadow-xl shadow-primary/10">
                                <h4 className="text-xl font-bold leading-tight">Need Emergency Assistance?</h4>
                                <p className="text-white/80 text-sm">Our 24/7 dedicated support team is available for urgent medical queries.</p>
                                <Button className="w-full bg-white text-primary hover:bg-slate-100 font-bold rounded-2xl h-12 gap-2">
                                    <Phone className="w-4 h-4" />
                                    Contact Support
                                </Button>
                            </div>
                        </aside>

                        {/* Main Content */}
                        <div className="flex-1 space-y-8">
                            <div className="flex items-center justify-between">
                                <p className="text-slate-600 font-medium">
                                    Showing <span className="text-slate-900 font-bold">{Math.min(doctors.length, pagination.total)}</span> of <span className="text-slate-900 font-bold">{pagination.total}</span> Doctors
                                </p>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-500">View:</span>
                                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg bg-white border-slate-200"><Filter className="w-4 h-4" /></Button>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <div key={i} className="h-[450px] rounded-3xl bg-white animate-pulse border border-slate-100 shadow-sm" />
                                    ))}
                                </div>
                            ) : doctors.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-3xl border border-dashed border-slate-300">
                                    <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-6">
                                        <SearchX className="h-10 w-10" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900">No doctors found</h3>
                                    <p className="text-slate-500 mt-2 max-w-xs mx-auto text-pretty">
                                        We couldn't find any doctors matching your current filters. Try broadening your search.
                                    </p>
                                    <Button
                                        variant="outline"
                                        className="mt-8 rounded-xl px-8 font-bold border-slate-200"
                                        onClick={() => {
                                            setSearchTerm("")
                                            setSelectedHospital("all")
                                            setSelectedSpecialty("all")
                                        }}
                                    >
                                        Clear all filters
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                    {doctors.map((doctor) => {
                                        const hospital = hospitals.find(h => h.id === doctor.hospitalUid);
                                        return (
                                            <Card key={doctor._id} className="group flex flex-col h-full rounded-3xl border-slate-200 shadow-sm hover:shadow-2xl transition-all duration-500 bg-white">
                                                <CardHeader className="p-0">
                                                    <div className="relative h-64 overflow-hidden rounded-t-3xl">
                                                        <Avatar className="h-full w-full rounded-none">
                                                            <AvatarImage src={doctor.profilePhoto} className="object-cover transform group-hover:scale-110 transition-transform duration-700" />
                                                            <AvatarFallback className="rounded-none bg-slate-100 text-slate-400 text-5xl font-bold">
                                                                {doctor.name.split(' ').map((n: string) => n[0]).join('')}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-80" />
                                                        <div className="absolute bottom-4 left-4 right-4 text-white">
                                                            <h3 className="text-xl font-bold drop-shadow-md">{doctor.name}</h3>
                                                            <div className="flex items-center gap-1.5 text-primary-foreground/90 font-bold text-xs uppercase tracking-wider">
                                                                <Stethoscope className="w-3.5 h-3.5" />
                                                                {doctor.specialization}
                                                            </div>
                                                        </div>
                                                        <div className="absolute top-4 left-4">
                                                            <Badge className="bg-white/10 backdrop-blur-md text-white border-white/20 px-3 py-1 text-xs font-bold gap-1.5 capitalize">
                                                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                                Verified Specialist
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-6 flex-1 flex flex-col space-y-5">
                                                    <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Experience</p>
                                                            <p className="text-sm font-bold text-slate-700">{doctor.experience} Years</p>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Qualification</p>
                                                            <p className="text-sm font-bold text-slate-700 truncate">{doctor.qualification}</p>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-3">
                                                        <div className="flex items-start gap-2.5">
                                                            <Building2 className="w-4 h-4 text-primary mt-1 shrink-0" />
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase text-slate-400">Visiting Hospital</p>
                                                                <p className="text-sm font-bold text-slate-900">{hospital?.name || "Main Campus"}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-2.5">
                                                            <Clock className="w-4 h-4 text-primary mt-1 shrink-0" />
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase text-slate-400">Consultation Hours</p>
                                                                <p className="text-sm font-bold text-slate-900">{doctor.schedule.startTime} - {doctor.schedule.endTime}</p>
                                                                <div className="flex gap-1 mt-1.5 flex-wrap">
                                                                    {doctor.schedule.days.map((d: string) => (
                                                                        <span key={d} className="text-[9px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                                                            {d}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="pt-4 mt-auto grid grid-cols-2 gap-3">
                                                        <Link href={`/doctors/${doctor._id}`} className="w-full">
                                                            <Button variant="outline" className="w-full rounded-xl border-slate-200 font-bold hover:bg-slate-50 gap-2">
                                                                <UserCircle className="w-4 h-4" />
                                                                Profile
                                                            </Button>
                                                        </Link>
                                                        <Link href={`/doctors/${doctor._id}`} className="w-full">
                                                            <Button className="w-full rounded-xl font-bold shadow-lg shadow-primary/10 gap-2">
                                                                <CalendarCheck className="w-4 h-4" />
                                                                Book Now
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        )
                                    })}
                                </div>
                            )}

                            {/* Pagination */}
                            {pagination.totalPages > 1 && (
                                <div className="flex items-center justify-center gap-2 pt-8">
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="rounded-xl border-slate-200 h-10 w-10"
                                        onClick={() => handlePageChange(pagination.page - 1)}
                                        disabled={pagination.page === 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    {[...Array(pagination.totalPages)].map((_, i) => (
                                        <Button
                                            key={i + 1}
                                            variant={pagination.page === i + 1 ? "default" : "outline"}
                                            className={cn(
                                                "h-10 w-10 rounded-xl font-bold transition-all",
                                                pagination.page === i + 1 ? "shadow-lg shadow-primary/20" : "border-slate-200"
                                            )}
                                            onClick={() => handlePageChange(i + 1)}
                                        >
                                            {i + 1}
                                        </Button>
                                    ))}

                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="rounded-xl border-slate-200 h-10 w-10"
                                        onClick={() => handlePageChange(pagination.page + 1)}
                                        disabled={pagination.page === pagination.totalPages}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Trust Footer */}
                <section className="bg-white border-t border-slate-100 py-16">
                    <div className="container mx-auto px-4 max-w-6xl">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
                            <div className="space-y-4">
                                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mx-auto md:mx-0">
                                    <ShieldCheck className="h-6 w-6" />
                                </div>
                                <h4 className="font-bold text-lg text-slate-900">Verified Profiles</h4>
                                <p className="text-slate-500 text-sm leading-relaxed">Every doctor profile is verifyed against institutional clinical records for accuracy.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="h-12 w-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mx-auto md:mx-0">
                                    <Clock className="h-6 w-6" />
                                </div>
                                <h4 className="font-bold text-lg text-slate-900">Real-time Schedules</h4>
                                <p className="text-slate-500 text-sm leading-relaxed">Get the most accurate consultation hours directly from hospital management systems.</p>
                            </div>
                            <div className="space-y-4">
                                <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto md:mx-0">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                                <h4 className="font-bold text-lg text-slate-900">Expert Care</h4>
                                <p className="text-slate-500 text-sm leading-relaxed">Access to the top specialists in the country for comprehensive medical guidance.</p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    )
}
