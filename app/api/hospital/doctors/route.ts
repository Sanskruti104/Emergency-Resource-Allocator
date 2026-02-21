import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { ObjectId } from "mongodb";
import { logClinicalAudit } from "@/lib/clinical-security";

export async function GET(request: Request) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get("query");
        const specialization = searchParams.get("specialization");

        const client = await clientPromise;
        const db = client.db();

        // Build filtering query
        const filter: any = { hospitalUid: session.uid };

        if (query) {
            filter.$or = [
                { name: { $regex: query, $options: "i" } },
                { registrationNumber: { $regex: query, $options: "i" } }
            ];
        }

        if (specialization && specialization !== "all") {
            filter.specialization = specialization;
        }

        const doctors = await db.collection("visiting_doctors")
            .find(filter)
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json(doctors);
    } catch (error: any) {
        console.error("GET Visiting Doctors error:", error);
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

        // Validation using a simple schema check (could use Zod here)
        if (!data.name || !data.specialization || !data.registrationNumber || !data.schedule) {
            return NextResponse.json({ error: "Missing required fields: name, specialization, registrationNumber, and schedule are required." }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        // Check if doctor is already attached to THIS hospital
        const existing = await db.collection("visiting_doctors").findOne({
            hospitalUid: session.uid,
            registrationNumber: data.registrationNumber
        });

        if (existing) {
            return NextResponse.json({ error: "Doctor already registered in this hospital profile" }, { status: 409 });
        }

        const newDoctor = {
            ...data,
            hospitalUid: session.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
            status: "active" // Default status
        };

        const result = await db.collection("visiting_doctors").insertOne(newDoctor);

        // Clinical Security: Log Recruitment Audit
        await logClinicalAudit({
            actorUid: session.uid,
            targetId: result.insertedId.toString(),
            action: "DOCTOR_RECRUITMENT",
            timestamp: new Date(),
            details: { name: data.name, registrationNumber: data.registrationNumber }
        });

        return NextResponse.json({
            success: true,
            id: result.insertedId,
            message: "Doctor successfully attached to hospital"
        }, { status: 201 });
    } catch (error: any) {
        console.error("POST Visiting Doctor error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
