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
        const networks = await db.collection("insurance_networks")
            .find({ hospitalUid: session.uid })
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json(networks);
    } catch (error: any) {
        console.error("GET Insurance Networks error:", error);
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

        // Validation
        if (!data.insuranceCompanyName) {
            return NextResponse.json({ error: "Insurance Company Name is required" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        const newNetwork = {
            hospitalUid: session.uid,
            insuranceCompanyName: data.insuranceCompanyName,
            tpaName: data.tpaName || "",
            cashlessAvailable: Boolean(data.cashlessAvailable),
            reimbursementAvailable: Boolean(data.reimbursementAvailable),
            preAuthRequired: Boolean(data.preAuthRequired),
            averageApprovalTimeDays: Number(data.averageApprovalTimeDays) || 0,
            createdAt: new Date(),
        };

        const result = await db.collection("insurance_networks").insertOne(newNetwork);

        return NextResponse.json({ ...newNetwork, _id: result.insertedId }, { status: 201 });
    } catch (error: any) {
        console.error("POST Insurance Network error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
