import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import {
    calculateDistanceKm,
    getTravelCompatibilityScore,
    getUrgencyDistancePenalty
} from "@/utils/location_utils";
import { calculateHospitalRating } from "@/hospital_rating_engine/hospital_rating_engine";
import { validateInstruments, extractInstrumentFeatures } from "@/lib/instrument-intelligence";
import { sortDoctorsByRank } from "@/lib/doctor-ranking";
import { generateDoctorExplanation } from "@/lib/doctor-explainability";

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

            // 6. Instrument Availability Intelligence (Score Impact: +15, +5, or -30)
            const requestedTreatment = profile.treatment || profile.diagnosis || "N/A";
            const hospitalInstruments = hospital.instruments?.available || [];
            const instrumentValidation = validateInstruments(requestedTreatment, hospitalInstruments);

            score += instrumentValidation.scoreImpact;

            fitReasons.push({
                label: instrumentValidation.status === "NO_MATCH" ? "Equipment Gap" : "Equipment Ready",
                description: instrumentValidation.explanation,
                match: instrumentValidation.status !== "NO_MATCH"
            });

            // ML Feature Injection (Simulated training/inference use)
            const mlFeatures = extractInstrumentFeatures(requestedTreatment, hospitalInstruments);

            return {
                ...hospital,
                id: hospital._id.toString(),
                uid: hospital.uid, // Explicitly pass through for mapping
                suitabilityScore: Math.max(0, score),
                distance: distanceKm,
                costRange: estimatedCost < 100000 ? "Low (Budget)" : "Mid (Private)",
                fitReasons,
                rating: calculateHospitalRating(hospital),
                instrumentIntelligence: {
                    ...instrumentValidation,
                    mlFeatures
                }
            };
        });

        // Filter out extreme mismatches and sort
        const results = scoredHospitals
            .filter(h => h.suitabilityScore > 0 && h.instrumentIntelligence.status !== "CRITICAL_MISSING")
            .sort((a, b) => b.suitabilityScore - a.suitabilityScore);

        // --- NEW: Clinical Doctor Recommendation Pipeline ---
        // Fetch all doctors across matched hospitals that match the specialty
        const diagnosis = profile.diagnosisCategory || profile.diagnosis || "";
        const hospitalIds = results.map(h => h.uid);

        const matchingDoctors = await db.collection("visiting_doctors").find({
            hospitalUid: { $in: hospitalIds },
            specialization: { $regex: diagnosis, $options: "i" }
        }).toArray();

        // Calculate hospital count for each doctor to support CSRS ranking
        const regNumbers = matchingDoctors.map(d => d.registrationNumber);
        const hospitalCounts = await db.collection("visiting_doctors").aggregate([
            { $match: { registrationNumber: { $in: regNumbers } } },
            { $group: { _id: "$registrationNumber", count: { $sum: 1 } } }
        ]).toArray();

        const countMap = new Map(hospitalCounts.map(c => [c._id, c.count]));

        // Attach Top 3 Recommended Doctors to each hospital result
        const finalResults = results.map(h => {
            const doctorsAtHospital = matchingDoctors
                .filter(d => d.hospitalUid === h.uid)
                .map(d => ({ ...d, hospitalCount: countMap.get(d.registrationNumber) || 1 }));

            // Apply CSRS Ranking for this hospital scope
            const searchBoost = new Map();
            doctorsAtHospital.forEach(d => searchBoost.set(d._id.toString(), 1)); // Max relevance boost since we filtered by specialization

            const topDoctors = sortDoctorsByRank(doctorsAtHospital, searchBoost).slice(0, 3);

            return {
                ...h,
                recommendedDoctors: topDoctors.map(d => ({
                    id: d._id.toString(),
                    name: d.name,
                    specialization: d.specialization,
                    qualification: d.qualification,
                    experience: d.experience,
                    profilePhoto: d.profilePhoto,
                    schedule: d.schedule,
                    rankingScore: d.rankingScore,
                    explanation: generateDoctorExplanation(d, d.rankingScore)
                }))
            };
        });

        return NextResponse.json({
            success: true,
            matches: finalResults
        });

    } catch (error: any) {
        console.error("POST Treatment Match error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
