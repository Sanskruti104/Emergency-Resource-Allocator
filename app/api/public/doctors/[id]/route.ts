import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid Doctor ID" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        // Fetch the specific doctor entry
        const doctorEntry = await db.collection("visiting_doctors").findOne({ _id: new ObjectId(id) });

        if (!doctorEntry) {
            return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
        }

        // Find all hospital associations for this specific doctor (using Registration Number)
        const allAssociations = await db.collection("visiting_doctors")
            .find({ registrationNumber: doctorEntry.registrationNumber })
            .toArray();

        // Get hospital names for these associations
        const hospitalUids = allAssociations.map(a => a.hospitalUid);
        const hospitals = await db.collection("hospitals")
            .find({ uid: { $in: hospitalUids } })
            .project({ hospitalName: 1, uid: 1, location: 1 })
            .toArray();

        // Merge hospital info with schedules
        const hospitalSchedules = allAssociations.map(assoc => {
            const hInfo = hospitals.find(h => h.uid === assoc.hospitalUid);
            return {
                hospitalId: assoc.hospitalUid,
                hospitalName: hInfo?.hospitalName || "Private Clinic/Hospital",
                location: hInfo?.location || null,
                schedule: assoc.schedule
            };
        });

        return NextResponse.json({
            profile: {
                name: doctorEntry.name,
                specialization: doctorEntry.specialization,
                qualification: doctorEntry.qualification,
                experience: doctorEntry.experience,
                registrationNumber: doctorEntry.registrationNumber,
                profilePhoto: doctorEntry.profilePhoto,
                createdAt: doctorEntry.createdAt
            },
            hospitals: hospitalSchedules
        });
    } catch (error: any) {
        console.error("GET Doctor Profile error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
