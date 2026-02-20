"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Navigation } from "lucide-react";
import Link from "next/link";

// Fix for default marker icons in Leaflet + Next.js
const DefaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const UserLocationIcon = L.divIcon({
    className: "user-location-marker",
    html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
});

const NearbyIcon = L.icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

interface Hospital {
    hospitalId: string;
    hospitalName: string;
    city: string;
    state: string;
    latitude: number;
    longitude: number;
    specialties: string[];
}

// Component to handle map view updates
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

export default function HospitalMapClient() {
    const [hospitals, setHospitals] = useState<Hospital[]>([]);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]);
    const [zoom, setZoom] = useState(5);

    useEffect(() => {
        async function fetchHospitals() {
            try {
                const res = await fetch("/api/hospital/public/all", { cache: 'no-store' });
                if (res.ok) {
                    const data = await res.json();
                    setHospitals(data);
                }
            } catch (error) {
                console.error("Failed to fetch hospitals:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchHospitals();
    }, []);

    const handleLocateUser = () => {
        if (typeof window !== "undefined" && "geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserLocation([latitude, longitude]);
                    setMapCenter([latitude, longitude]);
                    setZoom(10);
                },
                (error) => {
                    console.error("Geolocation error:", error);
                }
            );
        }
    };

    const isNearby = (lat: number, lng: number) => {
        if (!userLocation) return false;
        // Simple distance check (approx 50km)
        const distance = Math.sqrt(
            Math.pow(lat - userLocation[0], 2) + Math.pow(lng - userLocation[1], 2)
        );
        return distance < 0.5; // Roughly 50km
    };

    if (loading) {
        return (
            <Card className="w-full h-[500px] flex flex-col items-center justify-center p-8 bg-muted/5 border-none shadow-none rounded-2xl">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground font-medium">Loading hospital network...</p>
            </Card>
        );
    }

    return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Nearby Medical Facilities</h2>
                    <p className="text-muted-foreground mt-2">
                        Explore {hospitals.length} partner hospitals across the country.
                    </p>
                </div>
                <Button
                    onClick={handleLocateUser}
                    variant="outline"
                    className="rounded-xl border-primary/20 hover:bg-primary/5 transition-all gap-2"
                >
                    <Navigation className="h-4 w-4" />
                    Find Hospitals Near Me
                </Button>
            </div>

            <Card className="overflow-hidden border-border/50 shadow-xl rounded-3xl relative">
                <div className="h-[600px] w-full z-0">
                    <MapContainer
                        center={mapCenter}
                        zoom={zoom}
                        scrollWheelZoom={true}
                        className="h-full w-full"
                        zoomControl={false}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />

                        <MapUpdater center={mapCenter} zoom={zoom} />

                        {userLocation && (
                            <Marker position={userLocation} icon={UserLocationIcon}>
                                <Popup>
                                    <p className="font-semibold text-primary">Your Current Location</p>
                                </Popup>
                            </Marker>
                        )}

                        {hospitals.length > 10 ? (
                            <MarkerClusterGroup chunkedLoading>
                                {hospitals.map((hospital) => (
                                    <Marker
                                        key={hospital.hospitalId}
                                        position={[hospital.latitude, hospital.longitude]}
                                        icon={isNearby(hospital.latitude, hospital.longitude) ? NearbyIcon : DefaultIcon}
                                    >
                                        <Popup className="hospital-nav-popup">
                                            <div className="p-1 space-y-3 min-w-[200px]">
                                                <div>
                                                    <h4 className="font-bold text-lg leading-tight">{hospital.hospitalName}</h4>
                                                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                        <MapPin className="h-3 w-3" />
                                                        {hospital.city}, {hospital.state}
                                                    </p>
                                                </div>

                                                <div className="flex flex-wrap gap-1">
                                                    {hospital.specialties?.slice(0, 3).map((spec, i) => (
                                                        <Badge key={i} variant="secondary" className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-700 border-none">
                                                            {spec}
                                                        </Badge>
                                                    ))}
                                                    {hospital.specialties?.length > 3 && (
                                                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 opacity-60">
                                                            +{hospital.specialties.length - 3} more
                                                        </Badge>
                                                    )}
                                                </div>

                                                <Link href={`/hospitals/${hospital.hospitalId}`} className="block">
                                                    <Button size="sm" className="w-full rounded-lg text-xs font-semibold py-0 h-8">
                                                        View Details
                                                    </Button>
                                                </Link>
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </MarkerClusterGroup>
                        ) : (
                            hospitals.map((hospital) => (
                                <Marker
                                    key={hospital.hospitalId}
                                    position={[hospital.latitude, hospital.longitude]}
                                    icon={isNearby(hospital.latitude, hospital.longitude) ? NearbyIcon : DefaultIcon}
                                >
                                    <Popup className="hospital-nav-popup">
                                        <div className="p-1 space-y-3 min-w-[200px]">
                                            <div>
                                                <h4 className="font-bold text-lg leading-tight">{hospital.hospitalName}</h4>
                                                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {hospital.city}, {hospital.state}
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap gap-1">
                                                {hospital.specialties?.slice(0, 3).map((spec, i) => (
                                                    <Badge key={i} variant="secondary" className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-700 border-none">
                                                        {spec}
                                                    </Badge>
                                                ))}
                                                {hospital.specialties?.length > 3 && (
                                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 opacity-60">
                                                        +{hospital.specialties.length - 3} more
                                                    </Badge>
                                                )}
                                            </div>

                                            <Link href={`/hospitals/${hospital.hospitalId}`} className="block">
                                                <Button size="sm" className="w-full rounded-lg text-xs font-semibold py-0 h-8">
                                                    View Details
                                                </Button>
                                            </Link>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))
                        )}
                    </MapContainer>
                </div>
            </Card>

            <style jsx global>{`
        .leaflet-container {
          background-color: #f8fafc;
        }
        .hospital-nav-popup .leaflet-popup-content-wrapper {
          border-radius: 1rem;
          padding: 4px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
        .hospital-nav-popup .leaflet-popup-tip {
          box-shadow: none;
        }
        .user-location-marker {
          background: none !important;
          border: none !important;
        }
      `}</style>
        </div>
    );
}
