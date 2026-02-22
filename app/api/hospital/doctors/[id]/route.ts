import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { ObjectId } from "mongodb";
import { logClinicalAudit, trackProfileChange } from "@/lib/clinical-security";

// GET single doctor affiliation
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        const doctor = await db.collection("visiting_doctors").findOne({
            _id: new ObjectId(id),
            hospitalUid: session.uid
        });

        if (!doctor) {
            return NextResponse.json({ error: "Doctor not found in your hospital records" }, { status: 404 });
        }

        return NextResponse.json(doctor);
    } catch (error: any) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// UPDATE doctor affiliation / schedule
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const data = await request.json();

        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        // Security: Snapshot before update
        const previous = await db.collection("visiting_doctors").findOne({
            _id: new ObjectId(id),
            hospitalUid: session.uid
        });

        if (!previous) {
            return NextResponse.json({ error: "Record not found or unauthorized" }, { status: 404 });
        }

        await trackProfileChange(id, previous, session.uid);

        const result = await db.collection("visiting_doctors").updateOne(
            { _id: new ObjectId(id), hospitalUid: session.uid },
            {
                $set: {
                    ...data,
                    updatedAt: new Date()
                }
            }
        );

        await logClinicalAudit({
            actorUid: session.uid,
            targetId: id,
            action: "PROFILE_UPDATE",
            timestamp: new Date(),
            details: { fieldsChanged: Object.keys(data) }
        });

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "Record not found or unauthorized" }, { status: 404 });
        }

        return NextResponse.json({ message: "Doctor record updated successfully" });
    } catch (error: any) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// DELETE doctor affiliation
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        const result = await db.collection("visiting_doctors").deleteOne({
            _id: new ObjectId(id),
            hospitalUid: session.uid
        });

        if (result.deletedCount === 0) {
            return NextResponse.json({ error: "Record not found or unauthorized" }, { status: 404 });
        }

        await logClinicalAudit({
            actorUid: session.uid,
            targetId: id,
            action: "AFFILIATION_REMOVED",
            timestamp: new Date(),
            details: { reason: "Manual removal by hospital administrator" }
        });

        return NextResponse.json({ message: "Doctor affiliation removed successfully" });
    } catch (error: any) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
