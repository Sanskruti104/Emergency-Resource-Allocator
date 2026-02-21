import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { calculateHospitalRating } from "@/hospital_rating_engine/hospital_rating_engine";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db();

        // Fetch all hospitals
        const hospitals = await db.collection("hospitals").find({}).toArray();

        // Transform to match required public contract
        const publicHospitals = hospitals.map(h => ({
            hospitalId: h.uid || h._id.toString(),
            hospitalName: h.hospitalName || "Hospital",
            city: h.city || "Unknown",
            state: h.state || "Unknown",
            latitude: h.latitude || 20.5937, // Default to India center if missing
            longitude: h.longitude || 78.9629,
            specialties: h.specialties || [],
            rating: calculateHospitalRating(h)
        }));

        return NextResponse.json(publicHospitals);
    } catch (error: any) {
        console.error("GET Public Hospitals error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
