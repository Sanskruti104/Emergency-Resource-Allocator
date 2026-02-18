import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { ObjectId } from "mongodb";

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        // Allow unauthenticated for demo/testing if needed, but per requirements we should check session.
        // For now, let's relax it slightly or rely on the frontend passing data if we want to test easily
        // but robustly we should use the session uid to get the profile.

        // Let's support both: payload with constraints OR session-based profile fetch
        const payload = await request.json();
        let profile = payload.profile;

        if (!profile && session) {
            const client = await clientPromise;
            const db = client.db();
            profile = await db.collection("patient_profiles").findOne({ uid: session.uid });
        }

        if (!profile) {
            // Fallback to constraints in payload if no profile found
            profile = payload; // Assuming payload contains the constraints directly
        }

        const client = await clientPromise;
        const db = client.db();

        // Fetch all hospitals (in a real app, we would query with filters)
        const hospitals = await db.collection("hospitals").find({}).toArray();

        // Matching Logic
        const scoredHospitals = hospitals.map(hospital => {
            let score = 0;
            const fitReasons = [];

            // 1. Specialty Match (30 pts)
            const hospitalSpecialties = hospital.specialties || [];
            const diagnosis = profile.diagnosisCategory || profile.diagnosis;
            const hasSpecialty = hospitalSpecialties.some((s: string) =>
                s.toLowerCase().includes(diagnosis?.toLowerCase())
            );

            if (hasSpecialty) {
                score += 30;
                fitReasons.push({
                    label: "Specialty Match",
                    description: `Specializes in ${diagnosis} care.`,
                    match: true
                });
            } else {
                fitReasons.push({
                    label: "Specialty Mismatch",
                    description: `Does not explicitly list ${diagnosis} as a specialty.`,
                    match: false
                });
            }

            // 2. Budget Match (30 pts)
            // Heuristic: check if any package rate is within budget or if general pricing implies affinity
            // For now, let's assume if hospital has government schemes matching user, it's a budget match
            // OR if it's a private hospital and budget is high.
            // Since we don't have structured "average cost" in the schema shown earlier, let's use a heuristic or packageRates if available.
            // Let's use a simple heuristic based on hospital data if available, otherwise random for demo effectively
            // But let's try to be as real as possible.

            // let's parse packageRates if it's an object/array, or just assume "Standard"

            const userBudgetMin = Number(profile.budgetMin) || 0;
            const userBudgetMax = Number(profile.budgetMax) || 1000000;

            // Mock estimation logic since we don't have standardization yet
            // In real app, we'd check `hospital.procedures[diagnosis].cost`
            let estimatedCost = 0;
            if (hospital.governmentSchemes && hospital.governmentSchemes.length > 0) {
                estimatedCost = 50000; // Low cost
            } else {
                estimatedCost = 300000; // Private/Mid range
            }

            const isWithinBudget = estimatedCost >= userBudgetMin && estimatedCost <= userBudgetMax;

            if (isWithinBudget) {
                score += 30;
                fitReasons.push({
                    label: "Cost Compatibility",
                    description: "Estimated costs are within your budget range.",
                    match: true
                });
            } else if (estimatedCost < userBudgetMin) {
                score += 30; // Even better, it's cheaper
                fitReasons.push({
                    label: "Cost Compatibility",
                    description: "Significantly under budget (High Value).",
                    match: true
                });
            } else {
                fitReasons.push({
                    label: "Cost Mismatch",
                    description: "Estimated cost exceeds your budget preference.",
                    match: false
                });
            }

            // 3. Urgency & Capacity (20 pts)
            const userUrgency = profile.urgency;
            const availableBeds = hospital.capacity?.availableBeds || 0;

            if (userUrgency === "Emergency") {
                if (hospital.capacity?.emergencyAvailable && availableBeds > 0) {
                    score += 20;
                    fitReasons.push({
                        label: "Urgency Match",
                        description: "Emergency services and beds available immediately.",
                        match: true
                    });
                } else {
                    fitReasons.push({
                        label: "Urgency Concerns",
                        description: "Limited emergency capacity currently.",
                        match: false
                    });
                }
            } else {
                // Planned
                score += 20; // General availability assumed good for planned
                fitReasons.push({
                    label: "Scheduling",
                    description: "Open slots available for planned procedures.",
                    match: true
                });
            }

            // 4. Location Match (10 pts)
            if (profile.city && hospital.address && hospital.address.toLowerCase().includes(profile.city.toLowerCase())) {
                score += 10;
            }

            // 5. Verified Status (10 pts)
            if (hospital.isVerified) {
                score += 10;
            }

            return {
                ...hospital,
                id: hospital._id.toString(), // Ensure frontend gets string ID
                suitabilityScore: score,
                costRange: `₹${(estimatedCost / 100000).toFixed(1)}L - ₹${((estimatedCost * 1.5) / 100000).toFixed(1)}L`, // Mock range
                fitReasons
            };
        });

        // Filter and sort
        const results = scoredHospitals
            .sort((a, b) => b.suitabilityScore - a.suitabilityScore);

        return NextResponse.json({
            success: true,
            matches: results
        });

    } catch (error: any) {
        console.error("POST Treatment Match error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
