import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { buildStructuredOutput } from "@/treatment/treatment_selector";

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();
        console.log("POST /api/patient/profile - Session:", session);
        console.log("POST /api/patient/profile - Data:", data);

        // Validation - conditionKey is now optional
        if (!data.diagnosisCategory || !data.urgency || !data.timeline || data.budgetMin === undefined || data.budgetMax === undefined) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Get structured treatment output from the engine
        // This handles both specific conditions and category-level fallbacks
        const { processTreatmentInput } = require("@/treatment/treatment_engine");
        const treatmentInfo = processTreatmentInput(data.conditionKey, data.diagnosisCategory);

        const client = await clientPromise;
        const db = client.db();

        const profileData = {
            uid: session.uid,
            ageGroup: data.ageGroup,
            city: data.city,
            travelCapability: data.travelCapability,
            diagnosisCategory: data.diagnosisCategory,
            conditionKey: data.conditionKey,
            urgency: data.urgency,
            timeline: data.timeline,
            budgetMin: Number(data.budgetMin),
            budgetMax: Number(data.budgetMax),
            insuranceType: data.insuranceType,
            governmentScheme: data.governmentScheme,
            roomPreference: data.roomPreference,
            icuRequirement: data.icuRequirement,
            languagePreference: data.languagePreference,
            // Attach treatment metadata
            treatmentPlan: treatmentInfo,
            updatedAt: new Date(),
        };

        // Upsert profile
        const result = await db.collection("patient_profiles").updateOne(
            { uid: session.uid },
            {
                $set: profileData,
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
        );

        return NextResponse.json({
            success: true,
            message: "Profile saved successfully",
            id: result.upsertedId || result.matchedCount > 0 ? "updated" : null
        });

    } catch (error: any) {
        console.error("POST Patient Profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function GET(request: Request) {
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
