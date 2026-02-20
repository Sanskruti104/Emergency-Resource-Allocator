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
        const schemes = await db.collection("government_scheme_empanelment")
            .find({ hospitalUid: session.uid })
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json(schemes);
    } catch (error: any) {
        console.error("GET Gov Schemes error:", error);
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

        if (!data.schemeName) {
            return NextResponse.json({ error: "Scheme Name is required" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        const newScheme = {
            hospitalUid: session.uid,
            schemeName: data.schemeName,
            empanelmentId: data.empanelmentId || "",
            activeStatus: Boolean(data.activeStatus),
            lastAuditDate: data.lastAuditDate ? new Date(data.lastAuditDate) : null,
            createdAt: new Date(),
        };

        const result = await db.collection("government_scheme_empanelment").insertOne(newScheme);

        return NextResponse.json({ ...newScheme, _id: result.insertedId }, { status: 201 });
    } catch (error: any) {
        console.error("POST Gov Scheme error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
