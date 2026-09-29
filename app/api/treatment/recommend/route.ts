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
        let detectionInfo = null;

        // NEW: Symptom Detection Layer via Python Backend
        if (query && !diagnosisCategory) {
            try {
                const detectRes = await fetch("http://localhost:8001/analyze-symptoms", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ symptom_text: query }),
                });

                if (detectRes.ok) {
                    const data = await detectRes.json();
                    if (data.detected_specialty) {
                        diagnosisCategory = data.detected_specialty;
                        detectionInfo = {
                            specialty: data.detected_specialty,
                            confidence: data.confidence
                        };
                    }
                }
            } catch (err) {
                console.warn("Symptom detection service unavailable, falling back to keywords:", err);
            }
        }

        // If only raw query text is provided (e.g. "hip pain"), map it to a conditionKey
        if (query && !conditionKey) {
            conditionKey = mapInputToCondition(query);
            if (conditionKey && !diagnosisCategory) {
                diagnosisCategory = conditionDictionary[conditionKey]?.category;
            }
        }

        if (!diagnosisCategory && !conditionKey && !query) {
            return NextResponse.json({ error: "Clinical indicators (query or category) required" }, { status: 400 });
        }

        // Process the condition key through the treatment engine
        const treatmentInfoList = processTreatmentInput(conditionKey || query, diagnosisCategory);
        const treatmentInfo = Array.isArray(treatmentInfoList) ? treatmentInfoList[0] : treatmentInfoList;

        if (!treatmentInfo && !diagnosisCategory) {
            return NextResponse.json({
                found: false,
                message: "No matching clinical condition found. Please specify symptoms more clearly."
            }, { status: 404 });
        }

        return NextResponse.json({
            found: true,
            detection: detectionInfo,
            condition: {
                ...(treatmentInfo || {}),
                selectedTreatment: (treatmentInfo as any)?.selectedTreatment || `General Consultation (${diagnosisCategory})`,
                conditionCategory: diagnosisCategory || (treatmentInfo as any)?.conditionCategory,
                symptoms: query
            }
        });

    } catch (error: any) {
        console.error("Treatment Recommendation API Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
