import { NextResponse } from "next/server";
import conditionDictionary from "@/treatment/condition_dictionary.json";

/**
 * GET /api/treatment/conditions
 * Returns a list of all clinical conditions in an array format.
 */
export async function GET() {
    try {
        const conditions = Object.entries(conditionDictionary).map(([key, value]: [string, any]) => ({
            key: key,
            category: value.category,
            name: value.condition_name
        }));

        return NextResponse.json(conditions);
    } catch (error) {
        console.error("GET Conditions API Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
