import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";

export async function PUT(request: Request) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        const client = await clientPromise;
        const db = client.db();

        // Get existing hospital to merge media if needed, or just validate new structure
        const existingHospital = await db.collection("hospitals").findOne({ uid: session.uid });
        if (!existingHospital) {
            return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
        }

        // Validate media structure, falling back to existing data if fields are missing in the request
        const media = {
            exteriorImages: Array.isArray(data.exteriorImages) ? data.exteriorImages.slice(0, 5) : (existingHospital.media?.exteriorImages || []),
            wardImages: Array.isArray(data.wardImages) ? data.wardImages.slice(0, 5) : (existingHospital.media?.wardImages || []),
            icuImages: Array.isArray(data.icuImages) ? data.icuImages.slice(0, 5) : (existingHospital.media?.icuImages || []),
            galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages.slice(0, 5) : (existingHospital.media?.galleryImages || []),
            virtualTourLink: data.virtualTourLink !== undefined ? data.virtualTourLink : (existingHospital.media?.virtualTourLink || ""),
        };

        // Validate virtual tour URL if provided and not empty
        if (media.virtualTourLink) {
            try {
                new URL(media.virtualTourLink);
            } catch {
                return NextResponse.json({ error: "Invalid virtual tour URL" }, { status: 400 });
            }
        }

        const result = await db.collection("hospitals").findOneAndUpdate(
            { uid: session.uid },
            {
                $set: {
                    media,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            return NextResponse.json({ error: "Failed to update hospital" }, { status: 500 });
        }

        // result is the document itself in driver 6+
        return NextResponse.json({
            success: true,
            media: (result as any).media || media
        });
    } catch (error: any) {
        console.error("PUT Media error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
