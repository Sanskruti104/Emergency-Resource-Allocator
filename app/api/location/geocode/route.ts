import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const { city, state } = await request.json();

        if (!city || !state) {
            return NextResponse.json({ error: "City and State are required" }, { status: 400 });
        }

        const query = encodeURIComponent(`${city}, ${state}, India`);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
            {
                headers: {
                    'User-Agent': 'MedDecision-App (Patient-Location)'
                }
            }
        );

        if (!response.ok) {
            throw new Error("Failed to fetch from geocoding service");
        }

        const data = await response.json();

        if (data && data.length > 0) {
            return NextResponse.json({
                latitude: parseFloat(data[0].lat),
                longitude: parseFloat(data[0].lon),
                displayName: data[0].display_name
            });
        } else {
            return NextResponse.json({ error: "Location not found. Please try again or use the map pin." }, { status: 404 });
        }
    } catch (error: any) {
        console.error("Geocoding error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
