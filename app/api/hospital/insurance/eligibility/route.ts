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
        const rules = await db.collection("insurance_treatment_rules")
            .find({ hospitalUid: session.uid })
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json(rules);
    } catch (error: any) {
        console.error("GET Eligibility Rules error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const data = await request.json();

        if (!data.treatmentName || !data.insuranceCompanyName) {
            return NextResponse.json({ error: "Treatment and Insurance names are required" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        const newRule = {
            hospitalUid: session.uid,
            treatmentName: data.treatmentName,
            insuranceCompanyName: data.insuranceCompanyName,
            coverageLikelihoodPercentage: Number(data.coverageLikelihoodPercentage) || 0,
            documentationRequired: Array.isArray(data.documentationRequired) ? data.documentationRequired : [],
            commonRejectionReasons: Array.isArray(data.commonRejectionReasons) ? data.commonRejectionReasons : [],
            preExistingClauseRisk: data.preExistingClauseRisk || "Low",
            createdAt: new Date(),
        };

        const result = await db.collection("insurance_treatment_rules").insertOne(newRule);

        return NextResponse.json({ ...newRule, _id: result.insertedId }, { status: 201 });
    } catch (error: any) {
        console.error("POST Eligibility Rule error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
