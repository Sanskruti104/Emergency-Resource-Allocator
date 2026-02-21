import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";

export async function GET() {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const client = await clientPromise;
        const db = client.db();

        // Find hospital by UID from session
        const hospital = await db.collection("hospitals").findOne({ uid: session.uid });

        if (!hospital) {
            return NextResponse.json({
                available: [],
                verified: false,
                last_updated: ""
            });
        }

        return NextResponse.json(hospital.instruments || {
            available: [],
            verified: false,
            last_updated: ""
        });
    } catch (error: any) {
        console.error("GET Hospital Instruments error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { available } = body;

        if (!Array.isArray(available)) {
            return NextResponse.json({ error: "Invalid instruments data" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        // Update the 'instruments' field in the hospital document
        const result = await db.collection("hospitals").updateOne(
            { uid: session.uid },
            {
                $set: {
                    instruments: {
                        available,
                        last_updated: new Date().toISOString(),
                        verified: true // Assuming clinical verification happens here
                    },
                    updatedAt: new Date()
                }
            },
            { upsert: false } // Profile must exist
        );

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "Hospital profile not found" }, { status: 404 });
        }

        // Deterministic Audit Logging for Quality & Safety
        await db.collection("audit_logs").insertOne({
            action: "UPDATE_INSTRUMENTS",
            uid: session.uid,
            timestamp: new Date(),
            details: {
                instrumentCount: available.length,
                instruments: available,
                verificationStatus: true
            }
        });

        return NextResponse.json({
            success: true,
            instruments: {
                available,
                last_updated: new Date().toISOString(),
                verified: true
            }
        });
    } catch (error: any) {
        console.error("POST Hospital Instruments error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
