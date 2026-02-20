import { NextResponse } from "next/server";
import { processTreatmentInput } from "@/treatment/treatment_engine";
import { mapInputToCondition } from "@/treatment/keyword_mapper";
const conditionDictionary = require('../../../../treatment/condition_dictionary.json');

/**
 * POST /api/treatment/recommend
 * Accepts a query string or conditionKey and returns a structured treatment recommendation.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        let { query, conditionKey, diagnosisCategory } = body;

        // If only raw query text is provided (e.g. "hip pain"), map it to a conditionKey
        if (query && !conditionKey && !diagnosisCategory) {
            conditionKey = mapInputToCondition(query);
            if (conditionKey) {
                diagnosisCategory = conditionDictionary[conditionKey]?.category;
            } else {
                return NextResponse.json({
                    found: false,
                    message: "No matching clinical condition found. Please specify symptoms more clearly."
                }, { status: 404 });
            }
        }

        if (!diagnosisCategory && !conditionKey) {
            return NextResponse.json({ error: "Clinical indicators (query or category) required" }, { status: 400 });
        }

        // Process the condition key through the treatment engine
        const treatmentInfoList = processTreatmentInput(conditionKey, diagnosisCategory);
        const treatmentInfo = Array.isArray(treatmentInfoList) ? treatmentInfoList[0] : treatmentInfoList;

        if (!treatmentInfo) {
            return NextResponse.json({
                found: false,
                message: "No treatment information available for the provided criteria."
            }, { status: 404 });
        }

        return NextResponse.json({
            found: true,
            condition: {
                ...treatmentInfo,
                conditionCategory: diagnosisCategory || (treatmentInfo as any).conditionCategory
            }
        });

    } catch (error: any) {
        console.error("Treatment Recommendation API Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
