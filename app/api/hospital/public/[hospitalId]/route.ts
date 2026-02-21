import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { calculateHospitalRating } from "@/hospital_rating_engine/hospital_rating_engine";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
    request: Request,
    { params }: { params: Promise<{ hospitalId: string }> }
) {
    try {
        const { hospitalId } = await params;
        console.log(`Fetching public profile for ID: ${hospitalId}`);

        const client = await clientPromise;
        const db = client.db();

        // Find hospital by UID or ObjectId
        let query: any = { uid: hospitalId };

        // If hospitalId looks like a MongoDB ObjectId (24 hex characters)
        if (ObjectId.isValid(hospitalId) && hospitalId.length === 24) {
            query = {
                $or: [
                    { uid: hospitalId },
                    { _id: new ObjectId(hospitalId) }
                ]
            };
        }

        const hospital = await db.collection("hospitals").findOne(query);
        console.log(`Hospital found: ${hospital ? hospital.hospitalName : 'None'}`);

        if (!hospital) {
            return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
        }

        // Map and sanitize the response to adhere to the public profile contract
        const publicProfile = {
            hospitalId: hospital.uid || hospital._id.toString(),
            hospitalName: hospital.hospitalName || "Unnamed Hospital",
            description: hospital.description || "No description available.",
            specialties: hospital.specialties || [],
            achievements: hospital.achievements || [],
            city: hospital.city || "Unknown City",
            state: hospital.state || "Unknown State",
            helplineNumber: hospital.helplineNumber || hospital.contactNumber || "N/A",
            // Handle both string and object formats for opdTiming
            opdTiming: typeof hospital.opdTiming === 'object' ? hospital.opdTiming : {
                mondayToFriday: hospital.opdTiming || "Not specified",
                saturday: "Not specified",
                sunday: "Closed"
            },
            capacity: {
                totalBeds: hospital.capacity?.totalBeds || 0,
                availableBeds: hospital.capacity?.availableBeds || 0,
                icuBeds: hospital.capacity?.icuBeds || 0,
                emergencyAvailable: hospital.capacity?.emergencyAvailable || false
            },
            insuranceNetworks: hospital.insuranceNetworks || [],
            governmentSchemes: hospital.governmentSchemes || [],
            media: {
                exteriorImages: hospital.media?.exteriorImages || [],
                wardImages: hospital.media?.wardImages || [],
                icuImages: hospital.media?.icuImages || [],
                galleryImages: hospital.media?.galleryImages || [],
                virtualTourLink: hospital.media?.virtualTourLink || ""
            },
            latitude: hospital.latitude || 20.5937,
            longitude: hospital.longitude || 78.9629,
            rating: calculateHospitalRating(hospital)
        };

        return NextResponse.json(publicProfile);
    } catch (error: any) {
        console.error("GET Public Hospital Details error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
