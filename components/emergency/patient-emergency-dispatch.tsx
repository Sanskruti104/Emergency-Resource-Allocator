"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
    Activity,
    AlertCircle,
    Ambulance,
    CheckCircle2,
    Clock,
    HeartPulse,
    Hospital,
    Loader2,
    MapPin,
    Navigation,
    Phone,
    ShieldAlert,
    User,
    X,
    Radio,
    ChevronRight,
    Copy,
    Check
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmergencyType, TriagePriority } from "@/lib/emergency/emergency-types"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface EmergencyTypeOption {
    type: EmergencyType
    label: string
    description: string
    icon: React.ReactNode
    suggestedComplaints: string[]
}

const EMERGENCY_TYPES: EmergencyTypeOption[] = [
    {
        type: "CARDIAC",
        label: "Cardiac Emergency",
        description: "Chest pain, arm numbness, sweating, difficulty breathing",
        icon: <HeartPulse className="h-5 w-5 text-rose-500" />,
        suggestedComplaints: [
            "Severe crushing chest pain radiating to left arm",
            "Sudden chest tightness and shortness of breath",
            "Rapid irregular heartbeat with dizziness"
        ]
    },
    {
        type: "TRAUMA",
        label: "Trauma & Accident",
        description: "Severe injury, road traffic accident, heavy bleeding, fracture",
        icon: <ShieldAlert className="h-5 w-5 text-amber-500" />,
        suggestedComplaints: [
            "High impact road vehicle collision with extremity fractures",
            "Fall from height with head trauma and bleeding",
            "Severe laceration with uncontrolled bleeding"
        ]
    },
    {
        type: "STROKE",
        label: "Stroke / Neurological",
        description: "Facial drooping, arm weakness, speech difficulty, confusion",
        icon: <Activity className="h-5 w-5 text-purple-500" />,
        suggestedComplaints: [
            "Sudden facial droop and right arm weakness (FAST positive)",
            "Slurred speech and acute confusion within last 30 minutes",
            "Sudden severe headache with loss of balance"
        ]
    },
    {
        type: "RESPIRATORY",
        label: "Severe Respiratory",
        description: "Severe asthma, gasping for air, choking, acute distress",
        icon: <AlertCircle className="h-5 w-5 text-blue-500" />,
        suggestedComplaints: [
            "Acute respiratory distress, severe wheezing and unable to speak in full sentences",
            "Cyanosis and oxygen saturation drop in chronic pulmonary patient"
        ]
    },
    {
        type: "GENERAL",
        label: "General Medical Emergency",
        description: "Acute severe abdominal pain, high fever with altered state, allergic reaction",
        icon: <Ambulance className="h-5 w-5 text-teal-500" />,
        suggestedComplaints: [
            "Acute severe abdominal pain with persistent vomiting and hypotension",
            "Anaphylactic allergic reaction with throat swelling"
        ]
    }
]

// 6-step timeline as required by task:
// REQUESTED → ASSIGNING AMBULANCE → AMBULANCE ACCEPTED → EN ROUTE → ARRIVED → PATIENT PICKED UP
const TIMELINE_STEPS = [
    { key: "REQUESTED", label: "Requested", description: "Intake logged in system" },
    { key: "ASSIGNING_AMBULANCE", label: "Assigning Ambulance", description: "Broadcasting to regional fleet" },
    { key: "AMBULANCE_ACCEPTED", label: "Ambulance Accepted", description: "Paramedic unit claimed mission" },
    { key: "EN_ROUTE", label: "En Route", description: "Traveling to patient location" },
    { key: "ARRIVED", label: "Arrived", description: "Paramedics on scene" },
    { key: "PATIENT_PICKED_UP", label: "Patient Picked Up", description: "Secured in ambulance" }
]

export function PatientEmergencyDispatch() {
    // Modal state
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [copiedId, setCopiedId] = useState(false)

    // Form inputs
    const [selectedType, setSelectedType] = useState<EmergencyType>("CARDIAC")
    const [chiefComplaint, setChiefComplaint] = useState(
        "Severe crushing chest pain radiating to left arm, diaphoresis, 15-minute onset"
    )
    const [patientName, setPatientName] = useState("")
    const [contactPhone, setContactPhone] = useState("")

    // Location state
    const [latitude, setLatitude] = useState<number>(18.5204)
    const [longitude, setLongitude] = useState<number>(73.8567)
    const [address, setAddress] = useState<string>("Pune Railway Station Area, Pune")
    const [isSimulatedLocation, setIsSimulatedLocation] = useState<boolean>(true)
    const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false)
    const [locationError, setLocationError] = useState<string | null>(null)

    // Active Emergency State (MongoDB Source of Truth)
    const [activeEmergency, setActiveEmergency] = useState<any | null>(null)
    const [assignedAmbulance, setAssignedAmbulance] = useState<any | null>(null)
    const [timelineStep, setTimelineStep] = useState<string>("REQUESTED")

    // Check localStorage for any persisted active emergencyId on mount
    useEffect(() => {
        const storedId = localStorage.getItem("meddecision_active_emergency_id")
        if (storedId) {
            pollEmergencyStatus(storedId)
        }
    }, [])

    // Real-time polling function
    const pollEmergencyStatus = useCallback(async (emergencyId: string) => {
        try {
            const res = await fetch(`/api/emergency/request?emergencyId=${encodeURIComponent(emergencyId)}`, {
                cache: "no-store"
            })
            if (res.ok) {
                const data = await res.json()
                if (data.success && data.emergency) {
                    setActiveEmergency(data.emergency)
                    setAssignedAmbulance(data.ambulance)
                    setTimelineStep(data.timelineStep || "REQUESTED")
                }
            } else if (res.status === 404) {
                // If emergency was deleted or cleaned up, clear local reference
                localStorage.removeItem("meddecision_active_emergency_id")
                setActiveEmergency(null)
            }
        } catch (e) {
            console.error("Polling emergency status failed:", e)
        }
    }, [])

    // Polling interval when active emergency is present
    useEffect(() => {
        if (!activeEmergency?.emergencyId) return

        const interval = setInterval(() => {
            pollEmergencyStatus(activeEmergency.emergencyId)
        }, 2500)

        return () => clearInterval(interval)
    }, [activeEmergency?.emergencyId, pollEmergencyStatus])

    // Detect browser geolocation using location utilities
    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            setLocationError("Geolocation is not supported by your browser.")
            setIsSimulatedLocation(true)
            return
        }

        setIsDetectingLocation(true)
        setLocationError(null)

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const lat = pos.coords.latitude
                const lon = pos.coords.longitude
                setLatitude(lat)
                setLongitude(lon)
                setIsSimulatedLocation(false)

                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
                        headers: { "User-Agent": "MedDecision-App-Emergency" }
                    })
                    const data = await res.json()
                    if (data && data.display_name) {
                        setAddress(data.display_name)
                    }
                } catch {
                    setAddress(`GPS Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`)
                } finally {
                    setIsDetectingLocation(false)
                    toast.success("Real GPS location acquired")
                }
            },
            (err) => {
                setIsDetectingLocation(false)
                setLocationError("Location permission denied or unavailable. Fallback to verified simulation coordinates.")
                setIsSimulatedLocation(true)
                setLatitude(18.5204)
                setLongitude(73.8567)
                setAddress("Pune Metro Central Incident Location (Simulated)")
                toast.info("Using simulated location preset (Pune Metro Area)")
            },
            { timeout: 8000 }
        )
    }

    // Submit Emergency Request to MongoDB
    const handleSubmitEmergency = async () => {
        if (!chiefComplaint || chiefComplaint.trim().length < 2) {
            toast.error("Please describe the chief complaint.")
            return
        }

        setIsSubmitting(true)
        try {
            const payload = {
                emergencyType: selectedType,
                chiefComplaint: chiefComplaint.trim(),
                incidentLocation: {
                    latitude,
                    longitude,
                    address,
                    isSimulated: isSimulatedLocation
                },
                patient: {
                    name: patientName.trim() || undefined,
                    contactNumber: contactPhone.trim() || undefined
                }
            }

            const res = await fetch("/api/emergency/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })

            const result = await res.json()

            if (!res.ok || !result.success) {
                throw new Error(result.error || "Failed to submit emergency request")
            }

            const emg = result.emergency
            setActiveEmergency(emg)
            setTimelineStep("ASSIGNING_AMBULANCE")
            localStorage.setItem("meddecision_active_emergency_id", emg.emergencyId)
            toast.success("Emergency request broadcast to regional ambulance fleet!")
            setIsOpen(false)

        } catch (err: any) {
            console.error("Emergency submit error:", err)
            toast.error(err.message || "Network error. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const copyEmergencyId = () => {
        if (!activeEmergency?.emergencyId) return
        navigator.clipboard.writeText(activeEmergency.emergencyId)
        setCopiedId(true)
        setTimeout(() => setCopiedId(false), 2000)
        toast.info("Emergency Request ID copied to clipboard")
    }

    const handleClearEmergency = () => {
        localStorage.removeItem("meddecision_active_emergency_id")
        setActiveEmergency(null)
        setAssignedAmbulance(null)
        setTimelineStep("REQUESTED")
    }

    // Determine current timeline progress index
    const getActiveTimelineIndex = () => {
        switch (timelineStep) {
            case "REQUESTED": return 0
            case "ASSIGNING_AMBULANCE": return 1
            case "AMBULANCE_ACCEPTED": return 2
            case "EN_ROUTE": return 3
            case "ARRIVED": return 4
            case "PATIENT_PICKED_UP": return 5
            default: return 1
        }
    }

    const activeIndex = getActiveTimelineIndex()

    return (
        <div className="w-full">
            {/* ===================================================================== */}
            {/* CASE 1: ACTIVE EMERGENCY TRACKING BANNER & CARD                       */}
            {/* ===================================================================== */}
            {activeEmergency ? (
                <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/50 shadow-md p-5 sm:p-6 mb-8 animate-in fade-in-50 duration-300">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-rose-200/80">
                        <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm shrink-0 animate-pulse">
                                <Ambulance className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-bold text-rose-950">
                                        EMERGENCY REQUESTED
                                    </h2>
                                    <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs">
                                        {activeEmergency.priority || "HIGH PRIORITY"}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-rose-800 mt-0.5">
                                    <span>Request ID:</span>
                                    <span className="font-mono font-bold text-rose-900">{activeEmergency.emergencyId}</span>
                                    <button
                                        onClick={copyEmergencyId}
                                        className="text-rose-600 hover:text-rose-800 p-0.5 rounded"
                                        aria-label="Copy request ID"
                                    >
                                        {copiedId ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Top Badges */}
                        <div className="flex items-center gap-2 self-stretch md:self-auto justify-between md:justify-end">
                            <Badge variant="outline" className="border-rose-300 bg-white text-rose-900 text-xs font-semibold px-2.5 py-1">
                                {activeEmergency.emergencyType}
                            </Badge>
                            {activeEmergency.notes?.includes("SIMULATED") && (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300 text-[11px]">
                                    Simulated Location
                                </Badge>
                            )}
                        </div>
                    </div>

                    {/* Location & Chief Complaint Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4 text-xs">
                        <div className="p-3 bg-white rounded-xl border border-rose-200">
                            <span className="text-slate-500 font-semibold uppercase block mb-1">Pickup Location:</span>
                            <div className="flex items-start gap-1.5 text-slate-800">
                                <MapPin className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium leading-snug">{activeEmergency.incidentLocation?.address}</p>
                                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                        {activeEmergency.incidentLocation?.latitude?.toFixed(4)}, {activeEmergency.incidentLocation?.longitude?.toFixed(4)}
                                        {activeEmergency.notes?.includes("SIMULATED") && " • [Simulated GPS]"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 bg-white rounded-xl border border-rose-200">
                            <span className="text-slate-500 font-semibold uppercase block mb-1">Chief Complaint:</span>
                            <p className="font-medium text-slate-800 leading-snug">{activeEmergency.chiefComplaint}</p>
                            {assignedAmbulance && (
                                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                    <span className="text-teal-700 font-semibold flex items-center gap-1">
                                        <Ambulance className="h-3.5 w-3.5" /> Unit: {assignedAmbulance.ambulanceId} ({assignedAmbulance.callSign || "EMS"})
                                    </span>
                                    <span className="font-medium text-slate-700">
                                        ETA: {assignedAmbulance.ETA ? `${assignedAmbulance.ETA} mins` : "On Scene"}
                                        <span className="text-[10px] text-slate-400 ml-1">(Simulated ETA)</span>
                                    </span>
                                </div>
                            )}
                            {activeEmergency.receivingHospitalId ? (
                                <div className={cn(
                                    "mt-2 pt-2 border-t flex items-center justify-between text-[11px] -mx-3 -mb-3 p-2.5 rounded-b-xl border",
                                    activeEmergency.status === "ADMITTED"
                                        ? "bg-emerald-50/90 border-emerald-400 text-emerald-950 font-bold"
                                        : activeEmergency.handoffStatus === "IN_PROGRESS"
                                        ? "bg-indigo-50/90 border-indigo-300 text-indigo-950"
                                        : activeEmergency.transportStatus === "ARRIVED"
                                        ? "bg-teal-50/90 border-teal-300 text-teal-900"
                                        : activeEmergency.transportStatus === "EN_ROUTE"
                                        ? "bg-blue-50/90 border-blue-300 text-blue-900"
                                        : "bg-emerald-50/90 border-emerald-300 text-emerald-900"
                                )}>
                                    <span className="font-bold flex items-center gap-1">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Destination: {activeEmergency.receivingHospitalName || activeEmergency.receivingHospitalId}
                                    </span>
                                    <Badge className={cn(
                                        "text-white font-mono text-[10px] px-1.5 py-0",
                                        activeEmergency.status === "ADMITTED"
                                            ? "bg-emerald-600"
                                            : activeEmergency.handoffStatus === "IN_PROGRESS"
                                            ? "bg-indigo-600 animate-pulse"
                                            : activeEmergency.transportStatus === "ARRIVED"
                                            ? "bg-teal-600"
                                            : activeEmergency.transportStatus === "EN_ROUTE"
                                            ? "bg-blue-600 animate-pulse"
                                            : "bg-emerald-600"
                                    )}>
                                        {activeEmergency.status === "ADMITTED"
                                            ? "PATIENT ADMITTED"
                                            : activeEmergency.handoffStatus === "IN_PROGRESS"
                                            ? "HANDOFF IN PROGRESS"
                                            : activeEmergency.transportStatus === "ARRIVED"
                                            ? "AMBULANCE ARRIVED AT HOSPITAL"
                                            : activeEmergency.transportStatus === "EN_ROUTE"
                                            ? "AMBULANCE EN ROUTE TO HOSPITAL"
                                            : "RESERVATION CONFIRMED"}
                                    </Badge>
                                </div>
                            ) : activeEmergency.allocatedHospitalId ? (
                                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] bg-amber-50/90 -mx-3 -mb-3 p-2.5 rounded-b-xl border border-amber-300">
                                    <span className="text-amber-900 font-medium flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" /> Target: {activeEmergency.receivingHospitalName || activeEmergency.allocatedHospitalId}
                                    </span>
                                    <Badge className="bg-amber-600 text-white font-mono text-[10px] px-1.5 py-0">
                                        PENDING HOSPITAL CONFIRMATION
                                    </Badge>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    {/* Phase 3A & 3B: RECEIVING HOSPITAL TRANSPORT, ARRIVAL, HANDOFF & ADMISSION PROGRESSION */}
                    {activeEmergency.receivingHospitalId && (
                        <div className="mt-4 pt-3 border-t border-rose-200/80">
                            <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-bold uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                                    <Hospital className="h-3.5 w-3.5 text-blue-600" /> Hospital Transport, Handoff &amp; Admission Progress
                                </span>
                                <span className="text-xs text-slate-600 font-medium">
                                    Destination: <strong className="text-slate-900">{activeEmergency.receivingHospitalName || activeEmergency.receivingHospitalId}</strong>
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-xs">
                                {/* Stage 1: RESERVATION CONFIRMED */}
                                <div className={cn(
                                    "p-2.5 rounded-xl border text-center transition-all",
                                    activeEmergency.transportStatus === "EN_ROUTE" || activeEmergency.transportStatus === "ARRIVED" || activeEmergency.status === "ADMITTED"
                                        ? "bg-white border-emerald-300 text-emerald-950 shadow-xs"
                                        : "bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30"
                                )}>
                                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                                        <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", (!activeEmergency.transportStatus && activeEmergency.status !== "ADMITTED") ? "text-white" : "text-emerald-600")} />
                                        <span>Stage 1</span>
                                    </div>
                                    <p className={cn("text-xs font-bold mt-1", (!activeEmergency.transportStatus && activeEmergency.status !== "ADMITTED") ? "text-white" : "text-slate-900")}>
                                        RESERVATION CONFIRMED
                                    </p>
                                    <span className={cn("text-[10px] block mt-0.5", (!activeEmergency.transportStatus && activeEmergency.status !== "ADMITTED") ? "text-emerald-100" : "text-slate-500")}>
                                        Bed capacity secured
                                    </span>
                                </div>

                                {/* Stage 2: AMBULANCE EN ROUTE TO HOSPITAL */}
                                <div className={cn(
                                    "p-2.5 rounded-xl border text-center transition-all",
                                    activeEmergency.transportStatus === "ARRIVED" || activeEmergency.status === "ADMITTED"
                                        ? "bg-white border-emerald-300 text-emerald-950 shadow-xs"
                                        : activeEmergency.transportStatus === "EN_ROUTE"
                                        ? "bg-blue-600 border-blue-600 text-white shadow-sm ring-2 ring-blue-600/30 animate-pulse"
                                        : "bg-slate-100/70 border-slate-200 text-slate-400"
                                )}>
                                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                                        {activeEmergency.transportStatus === "ARRIVED" || activeEmergency.status === "ADMITTED" ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                        ) : activeEmergency.transportStatus === "EN_ROUTE" ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                        ) : (
                                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        )}
                                        <span>Stage 2</span>
                                    </div>
                                    <p className={cn("text-xs font-bold mt-1", activeEmergency.transportStatus === "EN_ROUTE" ? "text-white" : (activeEmergency.transportStatus === "ARRIVED" || activeEmergency.status === "ADMITTED") ? "text-slate-900" : "text-slate-400")}>
                                        AMBULANCE EN ROUTE TO HOSPITAL
                                    </p>
                                    <span className={cn("text-[10px] block mt-0.5", activeEmergency.transportStatus === "EN_ROUTE" ? "text-blue-100" : "text-slate-500")}>
                                        In transit with paramedics
                                    </span>
                                </div>

                                {/* Stage 3: AMBULANCE ARRIVED AT HOSPITAL */}
                                <div className={cn(
                                    "p-2.5 rounded-xl border text-center transition-all",
                                    activeEmergency.handoffStatus === "IN_PROGRESS" || activeEmergency.status === "ADMITTED"
                                        ? "bg-white border-emerald-300 text-emerald-950 shadow-xs"
                                        : activeEmergency.transportStatus === "ARRIVED" && activeEmergency.handoffStatus !== "IN_PROGRESS" && activeEmergency.status !== "ADMITTED"
                                        ? "bg-teal-600 border-teal-600 text-white shadow-sm ring-2 ring-teal-600/30"
                                        : "bg-slate-100/70 border-slate-200 text-slate-400"
                                )}>
                                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                                        {activeEmergency.handoffStatus === "IN_PROGRESS" || activeEmergency.status === "ADMITTED" ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                        ) : activeEmergency.transportStatus === "ARRIVED" ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
                                        ) : (
                                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        )}
                                        <span>Stage 3</span>
                                    </div>
                                    <p className={cn("text-xs font-bold mt-1", (activeEmergency.transportStatus === "ARRIVED" && activeEmergency.handoffStatus !== "IN_PROGRESS" && activeEmergency.status !== "ADMITTED") ? "text-white" : (activeEmergency.handoffStatus === "IN_PROGRESS" || activeEmergency.status === "ADMITTED") ? "text-slate-900" : "text-slate-400")}>
                                        AMBULANCE ARRIVED AT HOSPITAL
                                    </p>
                                    <span className={cn("text-[10px] block mt-0.5", (activeEmergency.transportStatus === "ARRIVED" && activeEmergency.handoffStatus !== "IN_PROGRESS" && activeEmergency.status !== "ADMITTED") ? "text-teal-100" : "text-slate-500")}>
                                        At hospital ED bay
                                    </span>
                                </div>

                                {/* Stage 4: HANDOFF IN PROGRESS */}
                                <div className={cn(
                                    "p-2.5 rounded-xl border text-center transition-all",
                                    activeEmergency.status === "ADMITTED"
                                        ? "bg-white border-emerald-300 text-emerald-950 shadow-xs"
                                        : activeEmergency.handoffStatus === "IN_PROGRESS"
                                        ? "bg-indigo-600 border-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30 animate-pulse"
                                        : "bg-slate-100/70 border-slate-200 text-slate-400"
                                )}>
                                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                                        {activeEmergency.status === "ADMITTED" ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                        ) : activeEmergency.handoffStatus === "IN_PROGRESS" ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                                        ) : (
                                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        )}
                                        <span>Stage 4</span>
                                    </div>
                                    <p className={cn("text-xs font-bold mt-1", activeEmergency.handoffStatus === "IN_PROGRESS" ? "text-white" : activeEmergency.status === "ADMITTED" ? "text-slate-900" : "text-slate-400")}>
                                        HANDOFF IN PROGRESS
                                    </p>
                                    <span className={cn("text-[10px] block mt-0.5", activeEmergency.handoffStatus === "IN_PROGRESS" ? "text-indigo-100" : "text-slate-500")}>
                                        Clinical transfer in ED
                                    </span>
                                </div>

                                {/* Stage 5: ADMITTED */}
                                <div className={cn(
                                    "p-2.5 rounded-xl border text-center transition-all",
                                    activeEmergency.status === "ADMITTED"
                                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30"
                                        : "bg-slate-100/70 border-slate-200 text-slate-400"
                                )}>
                                    <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                                        {activeEmergency.status === "ADMITTED" ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-white shrink-0" />
                                        ) : (
                                            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        )}
                                        <span>Stage 5</span>
                                    </div>
                                    <p className={cn("text-xs font-bold mt-1", activeEmergency.status === "ADMITTED" ? "text-white" : "text-slate-400")}>
                                        PATIENT ADMITTED
                                    </p>
                                    <span className={cn("text-[10px] block mt-0.5", activeEmergency.status === "ADMITTED" ? "text-emerald-100" : "text-slate-500")}>
                                        Bed assigned &amp; occupied
                                    </span>
                                </div>
                            </div>

                            {/* Prominent Admission Banner after successful completion */}
                            {activeEmergency.status === "ADMITTED" && (
                                <div className="mt-3 p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl text-xs space-y-1">
                                    <div className="flex items-center gap-1.5 text-emerald-900 font-black uppercase text-sm">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                        PATIENT ADMITTED
                                    </div>
                                    <div className="text-emerald-800">
                                        Receiving hospital: <strong className="font-bold">{activeEmergency.receivingHospitalName || activeEmergency.receivingHospitalId}</strong>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 6-STAGE TIMELINE (REQUESTED → ASSIGNING AMBULANCE → AMBULANCE ACCEPTED → EN ROUTE → ARRIVED → PATIENT PICKED UP) */}
                    <div className="mt-5 pt-3 border-t border-rose-200/80">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-rose-950 flex items-center gap-1.5">
                                <Radio className="h-3.5 w-3.5 text-rose-600 animate-pulse" /> Live Dispatch Timeline
                            </span>
                            <span className="text-xs text-slate-600 font-medium">
                                Current Status: <strong className="text-rose-900">{TIMELINE_STEPS[activeIndex]?.label}</strong>
                            </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            {TIMELINE_STEPS.map((step, idx) => {
                                const isPassed = idx < activeIndex
                                const isCurrent = idx === activeIndex
                                return (
                                    <div
                                        key={step.key}
                                        className={cn(
                                            "p-2.5 rounded-xl border text-center transition-all duration-200",
                                            isPassed && "bg-white border-emerald-300 text-emerald-950 shadow-xs",
                                            isCurrent && "bg-rose-600 border-rose-600 text-white shadow-sm ring-2 ring-rose-600/30 animate-pulse",
                                            idx > activeIndex && "bg-slate-100/70 border-slate-200 text-slate-400"
                                        )}
                                    >
                                        <div className="flex items-center justify-center gap-1 text-[11px] font-bold">
                                            {isPassed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                                            {isCurrent && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />}
                                            <span>Step {idx + 1}</span>
                                        </div>
                                        <p className={cn("text-xs font-bold mt-1 line-clamp-1", isCurrent ? "text-white" : isPassed ? "text-slate-900" : "text-slate-400")}>
                                            {step.label}
                                        </p>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Complete / Dismiss Notice */}
                    {activeIndex === 5 && (
                        <div className={cn(
                            "mt-4 p-3 border rounded-xl text-xs flex items-center justify-between",
                            activeEmergency.transportStatus === "ARRIVED"
                                ? "bg-teal-50 border-teal-200 text-teal-900"
                                : activeEmergency.transportStatus === "EN_ROUTE"
                                ? "bg-blue-50 border-blue-200 text-blue-900"
                                : "bg-emerald-50 border-emerald-200 text-emerald-900"
                        )}>
                            <span>
                                {activeEmergency.transportStatus === "ARRIVED" ? (
                                    <><strong>Ambulance arrived at receiving hospital.</strong> Paramedics and hospital clinical teams are preparing for emergency evaluation.</>
                                ) : activeEmergency.transportStatus === "EN_ROUTE" ? (
                                    <><strong>Ambulance en route to receiving hospital.</strong> Paramedics providing active monitoring in transit.</>
                                ) : (
                                    <><strong>Patient secured in ambulance.</strong> Hospital reservation confirmed. Paramedics preparing for transport.</>
                                )}
                            </span>
                            <Button size="sm" variant="outline" onClick={handleClearEmergency} className="text-xs h-8 ml-3 shrink-0">
                                Dismiss Banner
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                /* ===================================================================== */
                /* CASE 2: PROMINENT EMERGENCY ASSISTANCE TRIGGER BANNER                 */
                /* ===================================================================== */
                <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-white to-amber-50 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3.5">
                        <div className="h-10 w-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20 shrink-0">
                            <Ambulance className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                    Urgent Medical Emergency?
                                </h3>
                                <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200 text-[10px] font-bold">
                                    24/7 FLEET
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Request immediate emergency ambulance dispatch and telemetry-connected paramedic triage.
                            </p>
                        </div>
                    </div>

                    <Button
                        onClick={() => setIsOpen(true)}
                        className="w-full sm:w-auto h-10 px-5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs tracking-wide shadow-sm hover:shadow transition-all shrink-0"
                    >
                        <Ambulance className="mr-2 h-4 w-4" />
                        REQUEST AMBULANCE
                    </Button>
                </div>
            )}

            {/* ===================================================================== */}
            {/* EMERGENCY REQUEST MODAL / DIALOG                                      */}
            {/* ===================================================================== */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in-50">
                    <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b pb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
                                    <Ambulance className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold tracking-tight text-slate-900">
                                        Request Emergency Ambulance
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Direct telemetry dispatch to regional emergency response fleet.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                                aria-label="Close emergency modal"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* STEP 1: Select Emergency Type */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                1. Select Emergency Type
                            </Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {EMERGENCY_TYPES.map((emg) => {
                                    const isSelected = selectedType === emg.type
                                    return (
                                        <button
                                            key={emg.type}
                                            type="button"
                                            onClick={() => {
                                                setSelectedType(emg.type)
                                                if (emg.suggestedComplaints.length > 0) {
                                                    setChiefComplaint(emg.suggestedComplaints[0])
                                                }
                                            }}
                                            className={cn(
                                                "p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all",
                                                isSelected
                                                    ? "border-rose-600 bg-rose-50/60 ring-2 ring-rose-600/20"
                                                    : "border-slate-200 hover:border-slate-300 bg-white"
                                            )}
                                        >
                                            <div className="shrink-0 mt-0.5">{emg.icon}</div>
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900">{emg.label}</h4>
                                                <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{emg.description}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* STEP 2: Chief Complaint */}
                        <div className="space-y-1.5">
                            <Label htmlFor="complaint" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                2. Confirm Chief Complaint
                            </Label>
                            <textarea
                                id="complaint"
                                rows={2}
                                value={chiefComplaint}
                                onChange={(e) => setChiefComplaint(e.target.value)}
                                placeholder="Describe acute symptoms (e.g. chest pain, numbness, bleeding)..."
                                className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-rose-600 focus:ring-4 focus:ring-rose-500/10"
                            />
                        </div>

                        {/* STEP 3: Current Location & Simulation Labeling */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                    3. Incident Location
                                </Label>
                                {isSimulatedLocation ? (
                                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-semibold">
                                        Simulated Location Preset
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold">
                                        Live GPS Active
                                    </Badge>
                                )}
                            </div>

                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                                <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                    <div className="flex-1 text-xs">
                                        <p className="font-semibold text-slate-900">{address}</p>
                                        <p className="font-mono text-slate-500 text-[11px]">
                                            Coordinates: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={handleDetectLocation}
                                        disabled={isDetectingLocation}
                                        className="h-8 text-xs font-medium bg-white hover:bg-slate-50"
                                    >
                                        {isDetectingLocation ? (
                                            <>
                                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Detecting GPS...
                                            </>
                                        ) : (
                                            <>
                                                <Navigation className="mr-1.5 h-3.5 w-3.5 text-teal-600" /> Use Current Device GPS
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            setIsSimulatedLocation(true)
                                            setLatitude(18.5204)
                                            setLongitude(73.8567)
                                            setAddress("Pune Railway Station Area (Simulated Incident Scene)")
                                            toast.info("Switched to verified simulation location")
                                        }}
                                        className="h-8 text-xs text-slate-600 hover:text-slate-900"
                                    >
                                        Use Pune Simulation Preset
                                    </Button>
                                </div>

                                {locationError && (
                                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                                        {locationError}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* STEP 4: Patient Info (Optional) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <Label htmlFor="patientName" className="text-xs font-medium text-slate-700">Patient Name (Optional)</Label>
                                <Input
                                    id="patientName"
                                    value={patientName}
                                    onChange={(e) => setPatientName(e.target.value)}
                                    placeholder="e.g. Jane Doe"
                                    className="h-9 text-xs rounded-lg mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="contactPhone" className="text-xs font-medium text-slate-700">Contact Number (Optional)</Label>
                                <Input
                                    id="contactPhone"
                                    value={contactPhone}
                                    onChange={(e) => setContactPhone(e.target.value)}
                                    placeholder="+91 98765 43210"
                                    className="h-9 text-xs rounded-lg mt-1"
                                />
                            </div>
                        </div>

                        {/* Submit Actions */}
                        <div className="pt-2 flex items-center justify-end gap-3 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsOpen(false)}
                                disabled={isSubmitting}
                                className="h-10 px-4 rounded-xl text-xs"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmitEmergency}
                                disabled={isSubmitting}
                                className="h-10 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs tracking-wide shadow-sm"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Dispatching...
                                    </>
                                ) : (
                                    <>
                                        <Ambulance className="mr-2 h-4 w-4" /> CONFIRM & DISPATCH AMBULANCE
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
