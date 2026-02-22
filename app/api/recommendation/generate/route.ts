import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { getServerSession } from "@/lib/auth-utils";
import { calculateHospitalRating } from "@/hospital_rating_engine/hospital_rating_engine";
import { extractInstrumentFeatures } from "@/lib/instrument-intelligence";

/**
 * POST /api/recommendation/generate
 * Final Integration Layer Endpoint.
 * Coordinates DB, ML System, and Financial Engines.
 */
export async function POST(request: Request) {
    const startTime = Date.now();
    try {
        console.log("Starting Recommendation Generation...");
        const session = await getServerSession();
        const payload = await request.json();
        const { treatmentId, patientOverride } = payload;

        console.log("Context Resolution Started...");
        // 1. Resolve Patient Context
        const client = await clientPromise;
        const db = client.db();
        let profile = patientOverride;

        if (!profile && session) {
            profile = await db.collection("patient_profiles").findOne({ uid: session.uid });
        }

        if (!profile) {
            console.log("Error: Profile missing");
            return NextResponse.json({ error: "Patient profile context required" }, { status: 400 });
        }

        // 2. Resolve Treatment Context
        const treatmentContext = {
            name: "Premium Cardiac Surgery",
            base_cost: 450000,
            is_icu: true,
            intensity: 4,
            recovery_days: 10
        };

        // 3. Find Candidate Hospitals
        const specialtyQuery = treatmentId || "Cardiac";
        console.log(`Querying hospitals for: ${specialtyQuery}`);
        let hospitals = await db.collection("hospitals").find({
            specialties: { $regex: specialtyQuery, $options: "i" }
        }).limit(5).toArray();

        if (hospitals.length === 0) {
            hospitals = await db.collection("hospitals").find({}).limit(5).toArray();
        }

        console.log(`Found ${hospitals.length} candidate hospitals`);

        // 4. Enrichment Phase
        const pythonPayload = {
            patient: {
                budget: Number(profile.budgetMax) || 1000000,
                insurance_tier: profile.insuranceType || "Private - Tier 2",
                govt_eligible: profile.insuranceType === "Govt - PMJAY"
            },
            hospitals: hospitals.map(h => {
                const hospitalInstruments = h.instruments?.available || [];
                const instrumentFeatures = extractInstrumentFeatures(treatmentContext.name, hospitalInstruments);

                return {
                    id: h._id.toString(),
                    name: h.hospitalName,
                    pricing_index: h.pricingIndex || 0.1,
                    govt_support: (h.governmentSchemes || []).length > 0,
                    rating: calculateHospitalRating(h),
                    occupancy: h.capacity?.occupancy || 0.4,
                    icu_beds: h.capacity?.icuBeds || 8,
                    instrument_ratio: instrumentFeatures.instrument_match_ratio,
                    distance_km: h.distance || 12.5
                };
            }),
            treatment: treatmentContext
        };

        console.log("Requesting Batch AI Analysis from Python...");
        const pyStartTime = Date.now();
        const pythonRes = await fetch("http://localhost:8001/generate-batch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pythonPayload)
        });
        console.log(`Python API responded in ${Date.now() - pyStartTime}ms`);

        if (!pythonRes.ok) {
            const errorText = await pythonRes.text();
            throw new Error(`Python API Error: ${pythonRes.status} - ${errorText}`);
        }

        const batchResults = await pythonRes.json();

        // 5. Final Mapping
        const finalMatches = batchResults.map((recommendation: any, index: number) => {
            const h = hospitals[index];
            return {
                ...h,
                id: h._id.toString(),
                ...recommendation
            };
        }).sort((a: any, b: any) => b.suitability_score - a.suitability_score);

        console.log(`Request completed in ${Date.now() - startTime}ms`);
        return NextResponse.json({
            success: true,
            treatment: treatmentContext,
            matches: finalMatches
        });

    } catch (error: any) {
        console.error("CRITICAL: Unified Recommendation API Error:", error.message);
        return NextResponse.json({
            error: "Internal server error",
            message: error.message
        }, { status: 500 });
    }
}
