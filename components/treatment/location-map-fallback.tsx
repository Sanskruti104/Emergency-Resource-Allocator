"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DefaultIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

function MapEvents({ onPositionChange }: { onPositionChange: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onPositionChange(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

function MapRecenter({ lat, lng }: { lat: number, lng: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng]);
    }, [lat, lng, map]);
    return null;
}

interface InteractiveMapProps {
    onPositionChange: (lat: number, lng: number) => void;
    initialLat: number;
    initialLng: number;
}

export default function InteractiveMap({ onPositionChange, initialLat, initialLng }: InteractiveMapProps) {
    const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);

    useEffect(() => {
        setPosition([initialLat, initialLng]);
    }, [initialLat, initialLng]);

    const handleMarkerDrag = (e: any) => {
        const marker = e.target;
        if (marker != null) {
            const pos = marker.getLatLng();
            setPosition([pos.lat, pos.lng]);
            onPositionChange(pos.lat, pos.lng);
        }
    };

    return (
        <MapContainer
            center={position}
            zoom={5}
            scrollWheelZoom={true}
            className="h-full w-full"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapRecenter lat={initialLat} lng={initialLng} />
            <MapEvents onPositionChange={(lat, lng) => {
                setPosition([lat, lng]);
                onPositionChange(lat, lng);
            }} />
            <Marker
                position={position}
                icon={DefaultIcon}
                draggable={true}
                eventHandlers={{
                    dragend: handleMarkerDrag
                }}
            />
        </MapContainer>
    );
}
