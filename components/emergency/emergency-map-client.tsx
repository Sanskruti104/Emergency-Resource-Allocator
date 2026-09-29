"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertTriangle, Building2, Navigation, Radio } from "lucide-react";

// Robust DivIcons with inline SVG styling - no external asset dependencies
const incidentIcon = L.divIcon({
    className: "emergency-marker-incident",
    html: `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 36px; height: 36px; background-color: #ef4444; border-radius: 50%; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 30px; height: 30px; background-color: #dc2626; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(220, 38, 38, 0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 16px;">
                ⚠️
            </div>
        </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
});

const ambulanceIcon = L.divIcon({
    className: "emergency-marker-ambulance",
    html: `
        <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 34px; height: 34px; background-color: #f59e0b; border-radius: 50%; opacity: 0.4; animation: ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="width: 30px; height: 30px; background-color: #d97706; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 10px rgba(217, 119, 6, 0.5); display: flex; align-items: center; justify-content: center; font-size: 15px;">
                🚑
            </div>
        </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
});

const selectedHospitalIcon = L.divIcon({
    className: "emergency-marker-selected-hospital",
    html: `
        <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 40px; height: 40px; background-color: #10b981; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
            <div style="width: 34px; height: 34px; background-color: #059669; border-radius: 50%; border: 3px solid #ffffff; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.6); display: flex; align-items: center; justify-content: center; font-size: 17px; color: white;">
                🏥
            </div>
        </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -22],
});

const standardHospitalIcon = L.divIcon({
    className: "emergency-marker-standard-hospital",
    html: `
        <div style="width: 28px; height: 28px; background-color: #2563eb; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 3px 8px rgba(37, 99, 235, 0.4); display: flex; align-items: center; justify-content: center; font-size: 13px; color: white; font-weight: bold;">
            H
        </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
});

const unsuitableHospitalIcon = L.divIcon({
    className: "emergency-marker-unsuitable-hospital",
    html: `
        <div style="width: 26px; height: 26px; background-color: #94a3b8; border-radius: 50%; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(148, 163, 184, 0.4); display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; font-weight: bold;">
            H
        </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -15],
});

export interface MapHospital {
    hospitalId: string;
    hospitalName: string;
    latitude: number;
    longitude: number;
    availableIcuBeds?: number;
    totalIcuBeds?: number;
    availableGeneralBeds?: number;
    score?: number;
    suitability?: "SUITABLE" | "UNSUITABLE";
    reasons?: string[];
    travelTimeMinutes?: number;
    distanceKm?: number;
}

export interface EmergencyMapProps {
    incidentLocation?: { latitude: number; longitude: number; address?: string };
    ambulance?: {
        ambulanceId: string;
        currentLocation?: { latitude: number; longitude: number };
        status: string;
        etaMinutes?: number;
        speedKmH?: number;
        telemetrySource?: string;
    };
    hospitals: MapHospital[];
    selectedHospitalId?: string;
    onSelectHospital?: (hospitalId: string) => void;
}

function MapBoundsAdjuster({
    points
}: {
    points: [number, number][];
}) {
    const map = useMap();

    useEffect(() => {
        if (!points || points.length === 0) return;
        if (points.length === 1) {
            map.setView(points[0], 12);
            return;
        }

        try {
            const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        } catch {
            // Ignore boundary calculation issues
        }
    }, [points, map]);

    return null;
}

export default function EmergencyMapClient({
    incidentLocation,
    ambulance,
    hospitals,
    selectedHospitalId,
    onSelectHospital,
}: EmergencyMapProps) {
    // Gather all valid points to compute boundary
    const allPoints = useMemo(() => {
        const pts: [number, number][] = [];
        if (incidentLocation?.latitude && incidentLocation?.longitude) {
            pts.push([incidentLocation.latitude, incidentLocation.longitude]);
        }
        if (ambulance?.currentLocation?.latitude && ambulance?.currentLocation?.longitude) {
            pts.push([ambulance.currentLocation.latitude, ambulance.currentLocation.longitude]);
        }
        hospitals.forEach(h => {
            if (h.latitude && h.longitude) {
                pts.push([h.latitude, h.longitude]);
            }
        });
        return pts;
    }, [incidentLocation, ambulance, hospitals]);

    // Fallback default center (e.g. Philadelphia/PA or incident)
    const defaultCenter: [number, number] = useMemo(() => {
        if (incidentLocation?.latitude && incidentLocation?.longitude) {
            return [incidentLocation.latitude, incidentLocation.longitude];
        }
        if (hospitals.length > 0 && hospitals[0].latitude) {
            return [hospitals[0].latitude, hospitals[0].longitude];
        }
        return [40.0, -75.15];
    }, [incidentLocation, hospitals]);

    // Selected destination hospital
    const selectedHospital = hospitals.find(h => h.hospitalId === selectedHospitalId);

    // Route polyline coordinates: ambulance -> incident -> destination hospital
    const routeCoordinates = useMemo(() => {
        const coords: [number, number][] = [];
        if (ambulance?.currentLocation?.latitude && ambulance?.currentLocation?.longitude) {
            coords.push([ambulance.currentLocation.latitude, ambulance.currentLocation.longitude]);
        }
        if (incidentLocation?.latitude && incidentLocation?.longitude) {
            // If ambulance is already en route or arrived at hospital, connect ambulance directly to hospital
            if (ambulance?.status === "EN_ROUTE" && selectedHospital) {
                // In transit directly towards hospital
                coords.push([selectedHospital.latitude, selectedHospital.longitude]);
                return coords;
            }
            coords.push([incidentLocation.latitude, incidentLocation.longitude]);
        }
        if (selectedHospital?.latitude && selectedHospital?.longitude) {
            coords.push([selectedHospital.latitude, selectedHospital.longitude]);
        }
        return coords;
    }, [ambulance, incidentLocation, selectedHospital]);

    return (
        <div className="relative w-full h-[480px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-slate-900">
            {/* Map Legend Overlay */}
            <div className="absolute top-3 right-3 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl p-3 shadow-lg border border-slate-200 dark:border-slate-800 text-xs flex flex-col gap-1.5 max-w-[210px]">
                <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span>Tactical Grid</span>
                    <span className="text-[10px] bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 font-mono px-1 rounded">LIVE</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="text-sm">⚠️</span>
                    <span>Incident Location</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="text-sm">🚑</span>
                    <span>Ambulance Unit</span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 border-amber-500 text-amber-600">SIM</Badge>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="text-sm">🏥</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Target Destination</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <span className="w-3.5 h-3.5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold">H</span>
                    <span>Candidate Hospitals</span>
                </div>
            </div>

            <MapContainer
                center={defaultCenter}
                zoom={11}
                scrollWheelZoom={true}
                className="w-full h-full"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapBoundsAdjuster points={allPoints} />

                {/* Route Polyline */}
                {routeCoordinates.length >= 2 && (
                    <Polyline
                        positions={routeCoordinates}
                        pathOptions={{
                            color: "#2563eb",
                            weight: 4,
                            dashArray: "8, 10",
                            opacity: 0.85
                        }}
                    />
                )}

                {/* Incident Marker */}
                {incidentLocation?.latitude && incidentLocation?.longitude && (
                    <Marker
                        position={[incidentLocation.latitude, incidentLocation.longitude]}
                        icon={incidentIcon}
                    >
                        <Popup>
                            <div className="p-1 space-y-1 text-xs">
                                <div className="font-bold text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Emergency Incident Site
                                </div>
                                <p className="text-slate-700">{incidentLocation.address || "Live GPS Coordinates"}</p>
                                <p className="font-mono text-[11px] text-slate-500">
                                    {incidentLocation.latitude.toFixed(4)}, {incidentLocation.longitude.toFixed(4)}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Ambulance Marker */}
                {ambulance?.currentLocation?.latitude && ambulance?.currentLocation?.longitude && (
                    <Marker
                        position={[ambulance.currentLocation.latitude, ambulance.currentLocation.longitude]}
                        icon={ambulanceIcon}
                    >
                        <Popup>
                            <div className="p-1 space-y-1.5 text-xs min-w-[180px]">
                                <div className="flex items-center justify-between font-bold text-amber-600">
                                    <span>Ambulance {ambulance.ambulanceId}</span>
                                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300">
                                        SIMULATION
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-50 p-1.5 rounded">
                                    <div>Status: <span className="font-semibold text-slate-900">{ambulance.status}</span></div>
                                    <div>Speed: <span className="font-semibold text-slate-900">{ambulance.speedKmH ?? 0} km/h</span></div>
                                    <div className="col-span-2">ETA: <span className="font-semibold text-emerald-600">{ambulance.etaMinutes ?? 0} mins</span></div>
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Hospital Markers */}
                {hospitals.map((h) => {
                    if (!h.latitude || !h.longitude) return null;
                    const isSelected = h.hospitalId === selectedHospitalId;
                    const isSuitable = h.suitability !== "UNSUITABLE";
                    const icon = isSelected
                        ? selectedHospitalIcon
                        : isSuitable
                            ? standardHospitalIcon
                            : unsuitableHospitalIcon;

                    return (
                        <Marker
                            key={h.hospitalId}
                            position={[h.latitude, h.longitude]}
                            icon={icon}
                            eventHandlers={{
                                click: () => onSelectHospital?.(h.hospitalId),
                            }}
                        >
                            <Popup>
                                <div className="p-1.5 space-y-2 text-xs min-w-[210px]">
                                    <div className="flex items-start justify-between gap-1">
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-sm leading-tight">{h.hospitalName}</h4>
                                            <p className="text-[11px] text-slate-500 font-mono">{h.distanceKm?.toFixed(1) ?? "?"} km • {h.travelTimeMinutes ?? "?"} min ETA</p>
                                        </div>
                                        <Badge
                                            variant={isSuitable ? "default" : "secondary"}
                                            className={`text-[10px] shrink-0 ${isSuitable ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
                                        >
                                            {isSuitable ? `${h.score?.toFixed(0) ?? 0}/100` : "UNSUITABLE"}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-1 text-[11px] bg-slate-50 p-1.5 rounded">
                                        <div>ICU Beds: <span className="font-bold text-slate-900">{h.availableIcuBeds ?? "?"}</span></div>
                                        <div>General: <span className="font-bold text-slate-900">{h.availableGeneralBeds ?? "?"}</span></div>
                                    </div>

                                    {isSelected ? (
                                        <div className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded font-semibold text-center">
                                            ✓ Selected Target Destination
                                        </div>
                                    ) : (
                                        <Button
                                            size="sm"
                                            className="w-full text-xs h-7 bg-blue-600 hover:bg-blue-700 text-white"
                                            onClick={() => onSelectHospital?.(h.hospitalId)}
                                        >
                                            Select Destination
                                        </Button>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}
            </MapContainer>
        </div>
    );
}
