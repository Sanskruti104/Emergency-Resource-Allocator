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

        // Validate media structure
        const media = {
            exteriorImages: Array.isArray(data.exteriorImages) ? data.exteriorImages.slice(0, 5) : [],
            wardImages: Array.isArray(data.wardImages) ? data.wardImages.slice(0, 5) : [],
            icuImages: Array.isArray(data.icuImages) ? data.icuImages.slice(0, 5) : [],
            galleryImages: Array.isArray(data.galleryImages) ? data.galleryImages.slice(0, 5) : [],
            virtualTourLink: data.virtualTourLink || "",
        };

        // Validate virtual tour URL if provided
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
            return NextResponse.json({ error: "Hospital not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, media: result.media });
    } catch (error: any) {
        console.error("PUT Media error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
