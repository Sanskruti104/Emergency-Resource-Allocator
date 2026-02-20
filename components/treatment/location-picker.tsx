"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Search,
    Loader2,
    Navigation,
    Building,
    Map as MapIcon,
    Plane,
    CheckCircle2,
    X,
    MapPin,
    AlertCircle
} from "lucide-react"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import dynamic from "next/dynamic"

// Dynamic import for the Map component to avoid SSR issues
const InteractiveMap = dynamic(
    () => import("./location-map-fallback"),
    { ssr: false, loading: () => <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center">Loading Map...</div> }
)

interface LocationPickerProps {
    onChange: (data: any) => void
}

export function LocationPicker({ onChange }: LocationPickerProps) {
    const [city, setCity] = useState("")
    const [state, setState] = useState("")
    const [flexibility, setFlexibility] = useState("Local only")
    const [lat, setLat] = useState<number | null>(null)
    const [lng, setLng] = useState<number | null>(null)
    const [isValidating, setIsValidating] = useState(false)
    const [isDetecting, setIsDetecting] = useState(false)
    const [showFallback, setShowFallback] = useState(false)

    useEffect(() => {
        onChange({ city, state, latitude: lat, longitude: lng, travelFlexibility: flexibility })
    }, [city, state, lat, lng, flexibility, onChange])

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation is not supported by your browser")
            return
        }

        setIsDetecting(true)
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords
                setLat(latitude)
                setLng(longitude)

                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
                        headers: { 'User-Agent': 'MedDecision-App' }
                    });
                    const data = await res.json();
                    if (data.address) {
                        setCity(data.address.city || data.address.town || data.address.village || "")
                        setState(data.address.state || "")
                    }
                } catch (e) {
                    console.error("Reverse geocoding failed", e);
                }

                setIsDetecting(false)
                toast.success("Location captured successfully")
            },
            (error) => {
                setIsDetecting(false)
                toast.error("Fixed location not found. Please type manually or use the map.")
            }
        )
    }

    const handleGeocode = async () => {
        if (!city || !state) return
        setIsValidating(true)
        try {
            const res = await fetch("/api/location/geocode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ city, state }),
            })
            const data = await res.json()
            if (res.ok) {
                setLat(data.latitude)
                setLng(data.longitude)
                toast.success("Location validated")
            } else {
                toast.error(data.error)
                setShowFallback(true)
            }
        } catch (error) {
            toast.error("Geocoding service unavailable")
            setShowFallback(true)
        } finally {
            setIsValidating(false)
        }
    }

    return (
        <div className="space-y-6 text-left animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <Building className="h-4 w-4 text-primary" />
                        City
                    </Label>
                    <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Pune"
                        className="h-14 rounded-2xl border-slate-200 focus:bg-white bg-slate-50/50"
                    />
                </div>
                <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <MapIcon className="h-4 w-4 text-primary" />
                        State
                    </Label>
                    <Input
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. Maharashtra"
                        className="h-14 rounded-2xl border-slate-200 focus:bg-white bg-slate-50/50"
                    />
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <Button
                    variant="outline"
                    onClick={handleGeocode}
                    disabled={isValidating || !city || !state}
                    className="flex-1 h-14 rounded-2xl border-primary/20 text-primary hover:bg-primary/5 font-bold"
                >
                    {isValidating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Validate Address
                </Button>

                <Button
                    variant="secondary"
                    onClick={handleUseCurrentLocation}
                    disabled={isDetecting}
                    className="flex-1 h-14 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 font-bold"
                >
                    {isDetecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}
                    Use Precise GPS
                </Button>
            </div>

            {/* Travel Flexibility */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
                <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Plane className="h-4 w-4 text-primary" />
                    Travel Flexibility
                </Label>
                <Select value={flexibility} onValueChange={setFlexibility}>
                    <SelectTrigger className="h-14 rounded-2xl border-slate-200 bg-slate-50/50">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                        <SelectItem value="Local only">Local (Within City)</SelectItem>
                        <SelectItem value="Within State">Regional (Within State)</SelectItem>
                        <SelectItem value="Anywhere in Country">National (Anywhere in India)</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Coordinate Display / Fallback */}
            {lat && lng ? (
                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100 animate-in zoom-in-95">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-emerald-800 uppercase tracking-tight">Location Verified</p>
                            <p className="text-[10px] text-emerald-600 font-mono">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowFallback(true)}
                        className="h-8 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 rounded-lg px-3"
                    >
                        Adjust on Map
                    </Button>
                </div>
            ) : (
                <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                    <div className="flex justify-center flex-col items-center gap-2">
                        <MapPin className="h-6 w-6 text-slate-300" />
                        <p className="text-xs text-slate-400 font-medium italic">No coordinates set. Validate address or use GPS.</p>
                    </div>
                    <Button variant="link" size="sm" onClick={() => setShowFallback(true)} className="text-[10px] text-primary font-bold decoration-primary/30 underline-offset-4">
                        Manually drop pin on map instead
                    </Button>
                </div>
            )}

            {showFallback && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                            <AlertCircle className="h-4 w-4 text-amber-500" />
                            Drag the map to pinpoint
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowFallback(false)} className="h-8 w-8 p-0 rounded-full">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="h-[300px] rounded-[2rem] overflow-hidden border-4 border-white shadow-2xl relative">
                        <InteractiveMap
                            initialLat={lat || 18.5204}
                            initialLng={lng || 73.8567}
                            onPositionChange={(newLat, newLng) => {
                                setLat(newLat);
                                setLng(newLng);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
