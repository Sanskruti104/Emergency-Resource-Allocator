import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        const client = await clientPromise;
        const db = client.db();

        // Handle legacy field mapping
        if (data.travelCapability && !data.travelFlexibility) {
            data.travelFlexibility = data.travelCapability;
        }

        // Build update object dynamically to support partial updates
        const patientProfile: any = {
            uid: session.uid,
            updatedAt: new Date()
        };

        const supportedFields = [
            'conditionCategory', 'selectedTreatment', 'city', 'state',
            'latitude', 'longitude', 'travelFlexibility', 'urgency',
            'budgetMin', 'budgetMax', 'insuranceType', 'ageGroup',
            'diagnosisCategory', 'conditionKey', 'timeline', 'governmentScheme',
            'roomPreference', 'icuRequirement', 'languagePreference'
        ];

        supportedFields.forEach(field => {
            if (data[field] !== undefined) {
                patientProfile[field] = data[field];
            }
        });

        const result = await db.collection("patient_profiles").updateOne(
            { uid: session.uid },
            { $set: patientProfile },
            { upsert: true }
        );

        return NextResponse.json({ success: true, profile: patientProfile });
    } catch (error: any) {
        console.error("POST Patient Profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const client = await clientPromise;
        const db = client.db();
        const profile = await db.collection("patient_profiles").findOne({ uid: session.uid });

        if (!profile) {
            return NextResponse.json({ found: false });
        }

        return NextResponse.json({ found: true, profile });
    } catch (error: any) {
        console.error("GET Patient Profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
