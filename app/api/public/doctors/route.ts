import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { sortDoctorsByRank } from "@/lib/doctor-ranking";
import { generateDoctorExplanation } from "@/lib/doctor-explainability";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get("name");
        const hospitalId = searchParams.get("hospitalId");
        const specialty = searchParams.get("specialty");
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");

        const client = await clientPromise;
        const db = client.db();

        // Build query
        const query: any = {};
        if (name) query.name = { $regex: name, $options: "i" };
        if (hospitalId) query.hospitalUid = hospitalId;
        if (specialty) query.specialization = { $regex: specialty, $options: "i" };

        const skip = (page - 1) * limit;

        // Aggregation Pipeline for Advanced Ranking
        const pipeline: any[] = [
            { $match: query },
            // Group by Registration Number to find total hospital affiliations
            {
                $lookup: {
                    from: "visiting_doctors",
                    localField: "registrationNumber",
                    foreignField: "registrationNumber",
                    as: "all_affiliations"
                }
            },
            {
                $addFields: {
                    hospitalCount: { $size: "$all_affiliations" }
                }
            }
        ];

        const allDocs = await db.collection("visiting_doctors").aggregate(pipeline).toArray();

        // Apply Algorithm Engineering: Clinical Consultant Ranking System (CCRS)
        const searchBoostMap = new Map<string, number>();
        allDocs.forEach(doc => {
            let boost = 0;
            if (name && doc.name.toLowerCase().includes(name.toLowerCase())) boost += 0.6;
            if (specialty && doc.specialization.toLowerCase().includes(specialty.toLowerCase())) boost += 0.4;
            searchBoostMap.set(doc._id.toString(), Math.min(boost, 1));
        });

        const rankedDoctors = sortDoctorsByRank(allDocs, searchBoostMap);

        // Paginate the ranked results
        const paginatedDoctors = rankedDoctors.slice(skip, skip + limit);
        const total = rankedDoctors.length;


        // Get unique specialties and hospitals for filters
        const [specialties, hospitals] = await Promise.all([
            db.collection("visiting_doctors").distinct("specialization"),
            db.collection("hospitals").find({}, { projection: { hospitalName: 1, uid: 1 } }).toArray()
        ]);

        return NextResponse.json({
            doctors: paginatedDoctors.map(d => ({
                ...d,
                explanation: generateDoctorExplanation(d, d.rankingScore)
            })),
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            filters: {
                specialties,
                hospitals: hospitals.map(h => ({ name: h.hospitalName, id: h.uid }))
            }
        });
    } catch (error: any) {
        console.error("GET Public Doctors error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
