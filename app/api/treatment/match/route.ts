import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import {
    calculateDistanceKm,
    getTravelCompatibilityScore,
    getUrgencyDistancePenalty
} from "@/utils/location_utils";

const HOSPITALS_COLLECTION = "hospitals";

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        const payload = await request.json();
        let profile = payload.profile || payload;

        if (!profile && session) {
            const client = await clientPromise;
            const db = client.db();
            profile = await db.collection("patient_profiles").findOne({ uid: session.uid });
        }

        if (!profile) {
            return NextResponse.json({ error: "Patient profile or constraints required" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        // Fetch all hospitals
        const hospitals = await db.collection(HOSPITALS_COLLECTION).find({}).toArray();

        const userLat = Number(profile.latitude);
        const userLng = Number(profile.longitude);

        // Map travel flexibility string to number
        let travelFlexCode = 0; // Default Local
        const flexStr = profile.travelFlexibility || "Local only";
        if (flexStr.includes("State")) travelFlexCode = 1;
        if (flexStr.includes("Country") || flexStr.includes("Anywhere")) travelFlexCode = 2;

        const isEmergency = profile.urgency === "Emergency" ? 1 : 0;

        // Matching Logic
        const scoredHospitals = hospitals.map(hospital => {
            let score = 0;
            const fitReasons = [];

            // 1. Specialty Match (35 pts)
            const hospitalSpecialties = hospital.specialties || [];
            const diagnosis = profile.diagnosisCategory || profile.diagnosis || "";
            const hasSpecialty = hospitalSpecialties.some((s: string) =>
                s.toLowerCase().includes(diagnosis.toLowerCase())
            );

            if (hasSpecialty) {
                score += 35;
                fitReasons.push({
                    label: "Specialty Match",
                    description: `Certified specialized care for ${diagnosis}.`,
                    match: true
                });
            } else {
                fitReasons.push({
                    label: "Specialty Mismatch",
                    description: `Facility does not explicitly specialize in ${diagnosis}.`,
                    match: false
                });
            }

            // 2. Location & Distance Match (25 pts)
            let distanceKm = null;
            let proximityScore = 0;

            if (userLat && userLng && hospital.latitude && hospital.longitude) {
                distanceKm = calculateDistanceKm(userLat, userLng, hospital.latitude, hospital.longitude);

                // Base proximity points (25 pts)
                let basePoints = 0;
                if (distanceKm < 10) basePoints = 25;
                else if (distanceKm < 30) basePoints = 20;
                else if (distanceKm < 100) basePoints = 10;
                else basePoints = 5;

                // Apply deterministic multipliers from utils
                const compatibilityFactor = getTravelCompatibilityScore(distanceKm, travelFlexCode);
                const urgencyFactor = getUrgencyDistancePenalty(distanceKm, isEmergency);

                proximityScore = basePoints * compatibilityFactor * urgencyFactor;
                const matchPercentage = Math.round(compatibilityFactor * urgencyFactor * 100);

                if (proximityScore > 0) {
                    score += proximityScore;
                    fitReasons.push({
                        label: "Optimal Location",
                        description: `${distanceKm.toFixed(1)} km away. This matches your ${flexStr} travel preference with ${matchPercentage}% geographic relevance.`,
                        match: matchPercentage > 70
                    });
                } else {
                    fitReasons.push({
                        label: "Location Constraint",
                        description: `At ${distanceKm.toFixed(1)} km, this facility is further than your preferred ${flexStr} range.`,
                        match: false
                    });
                }
            }

            // 3. Cost & Budget Compatibility (20 pts)
            const userBudgetMax = Number(profile.budgetMax) || 1000000;
            const estimatedCost = (hospital.governmentSchemes?.length > 0) ? 75000 : 250000; // Heuristic

            if (estimatedCost <= userBudgetMax) {
                score += 20;
                fitReasons.push({
                    label: "Budget Fit",
                    description: "Estimated treatment costs are within your specified budget.",
                    match: true
                });
            } else {
                fitReasons.push({
                    label: "Cost Alert",
                    description: "Treatment at this facility may exceed your budget preference.",
                    match: false
                });
            }

            // 4. Urgency & Emergency Readiness (10 pts)
            if (isEmergency) {
                if (hospital.capacity?.emergencyAvailable) {
                    score += 10;
                    fitReasons.push({
                        label: "Emergency Ready",
                        description: "Facility equipped with confirmed 24/7 emergency response.",
                        match: true
                    });
                }
            } else {
                score += 10; // Planned procedures are generally okay
            }

            // 5. Insurance Match (10 pts)
            const userInsurance = profile.insuranceType;
            const acceptsInsurance = hospital.insuranceNetworks?.some((i: string) =>
                i.toLowerCase().includes(userInsurance?.toLowerCase())
            ) || (userInsurance === "Govt - PMJAY" && hospital.governmentSchemes?.includes("Ayushman Bharat"));

            if (acceptsInsurance) {
                score += 10;
                fitReasons.push({
                    label: "Insurance Accepted",
                    description: `Supports your ${userInsurance} coverage.`,
                    match: true
                });
            }

            return {
                ...hospital,
                id: hospital._id.toString(),
                suitabilityScore: Math.max(0, score),
                distance: distanceKm,
                costRange: estimatedCost < 100000 ? "Low (Budget)" : "Mid (Private)",
                fitReasons
            };
        });

        // Filter out extreme mismatches and sort
        const results = scoredHospitals
            .filter(h => h.suitabilityScore > 0)
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
