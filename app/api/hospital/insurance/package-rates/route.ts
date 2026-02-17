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
        const rates = await db.collection("insurance_package_rates")
            .find({ hospitalUid: session.uid })
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json(rates);
    } catch (error: any) {
        console.error("GET Package Rates error:", error);
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

        const negotiatedRate = Number(data.negotiatedRate) || 0;
        const selfPayRate = Number(data.selfPayRate) || 0;
        const differenceAmount = negotiatedRate - selfPayRate;

        const client = await clientPromise;
        const db = client.db();

        const newRate = {
            hospitalUid: session.uid,
            treatmentName: data.treatmentName,
            insuranceCompanyName: data.insuranceCompanyName,
            negotiatedRate,
            selfPayRate,
            differenceAmount,
            createdAt: new Date(),
        };

        const result = await db.collection("insurance_package_rates").insertOne(newRate);

        return NextResponse.json({ ...newRate, _id: result.insertedId }, { status: 201 });
    } catch (error: any) {
        console.error("POST Package Rate error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
