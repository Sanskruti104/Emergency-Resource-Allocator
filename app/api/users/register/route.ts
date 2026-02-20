import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

// Helper function to resolve coordinates from address
async function getCoordinates(address: string, city: string, state: string) {
    try {
        const query = encodeURIComponent(`${address}, ${city}, ${state}, India`);
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
            {
                headers: {
                    'User-Agent': 'MedDecision-App (Hospital-Registration)'
                }
            }
        );
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        console.error("Geocoding failed:", error);
    }
    // Fallback coordinates (India Center) if geocoding fails
    return { lat: 20.5937, lon: 78.9629 };
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { uid, role, email, hospitalName, address, city, state } = body;

        // 1. Validate required fields
        if (!uid) {
            return NextResponse.json({ error: "UID is required" }, { status: 400 });
        }
        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }
        if (!role || !["patient", "hospital"].includes(role)) {
            return NextResponse.json(
                { error: 'Role must be either "patient" or "hospital"' },
                { status: 400 }
            );
        }

        // 2. Connect to MongoDB
        const client = await clientPromise;
        const db = client.db();
        const usersCollection = db.collection("users");

        // 3. Prevent duplicate UID entries
        const existingUser = await usersCollection.findOne({ uid });
        if (existingUser) {
            return NextResponse.json({ error: "User already exists" }, { status: 400 });
        }

        // 4. Create common user record
        const newUser = {
            uid,
            role,
            email,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const result = await usersCollection.insertOne(newUser);

        if (!result.acknowledged) {
            throw new Error("Failed to insert user into database");
        }

        // 5. If hospital, also create record in hospitals collection with Geocoding
        if (role === "hospital") {
            const coordinates = await getCoordinates(
                address || body.address,
                city || body.city,
                state || body.state
            );

            const hospitalsCollection = db.collection("hospitals");
            const newHospital = {
                uid,
                hospitalName: hospitalName || body.hospitalName || "Unnamed Hospital",
                address: address || body.address || "",
                city: city || body.city || "",
                state: state || body.state || "",
                latitude: coordinates.lat,
                longitude: coordinates.lon,
                contactNumber: body.contactNumber || "",
                officialEmail: body.email || "",
                licenseNumber: body.licenseNumber || "",
                accreditationType: body.accreditationType || "",
                yearEstablished: body.yearEstablished || "",
                isVerified: true,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            await hospitalsCollection.insertOne(newHospital);
        }

        return NextResponse.json(
            { message: "User registered successfully", userId: result.insertedId },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("Registration API error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
