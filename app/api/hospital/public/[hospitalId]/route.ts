import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ hospitalId: string }> }
) {
    try {
        const { hospitalId } = await params;

        if (!hospitalId) {
            return NextResponse.json({ error: "Hospital ID is required" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        // Try to query by ObjectId if valid, otherwise by uid or string ID
        let query: any = { uid: hospitalId };

        if (ObjectId.isValid(hospitalId)) {
            query = {
                $or: [
                    { _id: new ObjectId(hospitalId) },
                    { uid: hospitalId }
                ]
            };
        }

        const hospital = await db.collection("hospitals").findOne(query, {
            projection: {
                // Explicitly include fields we want
                hospitalName: 1,
                description: 1,
                specialties: 1,
                achievements: 1,
                helplineNumber: 1,
                opdTiming: 1,
                capacity: 1,
                media: 1,
                insuranceNetworks: 1,
                insuranceEligibility: 1,
                packageRates: 1,
                claimMetrics: 1,
                governmentSchemes: 1,
                address: 1, // Useful for display
                isVerified: 1,
                uid: 1,

                // Explicitly exclude sensitive fields if any (though projection is inclusive)
                // We are using inclusive projection, so others are excluded by default except _id
            }
        });

        if (!hospital) {
            return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
        }

        return NextResponse.json(hospital);
    } catch (error: any) {
        console.error("GET Public Hospital error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
