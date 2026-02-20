"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DefaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const UserIcon = L.divIcon({
    className: "user-mini-marker",
    html: `<div class="w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
});

function MapRecenter({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, 14);
    }, [center, map]);
    return null;
}

interface MiniMapProps {
    lat: number;
    lng: number;
    hospitalName: string;
}

export default function MiniMap({ lat, lng, hospitalName }: MiniMapProps) {
    const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined" && "geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setUserLocation([pos.coords.latitude, pos.coords.longitude]);
            });
        }
    }, []);

    return (
        <div className="h-full w-full rounded-2xl overflow-hidden border border-border/50">
            <MapContainer
                center={[lat, lng]}
                zoom={14}
                scrollWheelZoom={false}
                className="h-full w-full"
                zoomControl={false}
                touchZoom={false}
                doubleClickZoom={false}
                dragging={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapRecenter center={[lat, lng]} />
                <Marker position={[lat, lng]} icon={DefaultIcon}>
                    <Popup>{hospitalName}</Popup>
                </Marker>
                {userLocation && (
                    <Marker position={userLocation} icon={UserIcon}>
                        <Popup>Your Location</Popup>
                    </Marker>
                )}
            </MapContainer>
            <style jsx global>{`
        .user-mini-marker {
          background: none !important;
          border: none !important;
        }
      `}</style>
        </div>
    );
}
