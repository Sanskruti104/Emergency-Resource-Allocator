import { NextResponse } from "next/server";
import { medicalData, Condition } from "@/lib/medical-data";

export async function POST(request: Request) {
    try {
        const { query } = await request.json();

        if (!query || typeof query !== 'string') {
            return NextResponse.json({ error: "Query is required" }, { status: 400 });
        }

        const normalizedQuery = query.toLowerCase().trim();

        // 1. Exact or Partial Match Logic
        // We look for conditions where ANY keyword is contained in the user query
        // OR the user query is contained in the keyword (partial match)

        const matches: Condition[] = medicalData.filter(condition => {
            return condition.keywords.some(keyword => {
                const normalizedKeyword = keyword.toLowerCase();
                return normalizedQuery.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedQuery);
            });
        });

        // 2. Rank results (optional - for now just return the first best match)
        // If multiple matches, we could score them. For simplicity, we return the first one found.

        if (matches.length === 0) {
            return NextResponse.json({
                found: false,
                message: "We couldn't find a specific condition matching your search. Please try keywords like 'knee pain', 'heart blockage', or 'cataract'."
            });
        }

        // Return the best match
        const bestMatch = matches[0];

        return NextResponse.json({
            found: true,
            condition: bestMatch
        });

    } catch (error: any) {
        console.error("Treatment Recommendation API Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
