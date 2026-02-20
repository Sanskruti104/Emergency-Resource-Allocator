import { NextResponse } from "next/server";
import { processTreatmentInput } from "@/treatment/treatment_engine";

/**
 * POST /api/treatment/recommend
 * Accepts a conditionKey and returns a structured treatment recommendation.
 */
export async function POST(request: Request) {
    try {
        const { conditionKey, diagnosisCategory } = await request.json();

        if (!diagnosisCategory) {
            return NextResponse.json({ error: "diagnosisCategory is required" }, { status: 400 });
        }

        // Process the condition key through the treatment engine
        // conditionKey is now optional; if null, the engine provides a category fallback
        const treatmentInfo = processTreatmentInput(conditionKey, diagnosisCategory);

        if (!treatmentInfo) {
            return NextResponse.json({
                found: false,
                message: "No treatment information available for the provided criteria."
            }, { status: 404 });
        }

        return NextResponse.json({
            found: true,
            condition: treatmentInfo
        });

    } catch (error: any) {
        console.error("Treatment Recommendation API Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
