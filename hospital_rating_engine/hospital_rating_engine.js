/**
 * Calculates the hospital rating based on various parameters including infrastructure,
 * utilization, governance, and clinical coverage.
 * 
 * @param {Object} hospital - The hospital object containing required data points.
 * @returns {Object} Final score, star rating, breakdown, radar data, explanations, and confidence.
 */
export function calculateHospitalRating(hospital) {
    // Defensive checks: ensure hospital object exists
    if (!hospital) {
        return {
            finalScore: 0,
            starRating: 0,
            breakdown: { infrastructure: 0, utilization: 0, governance: 0, clinicalCoverage: 0 },
            radarData: { infrastructure: 0, utilization: 0, governance: 0, clinicalCoverage: 0 },
            explanations: [],
            confidenceScore: 40,
            confidenceLabel: "Low"
        };
    }

    // 0. Extract fields with defaults for safety
    const capacity = hospital.capacity || {};
    const totalBeds = Number(capacity.totalBeds) || 0;
    const availableBeds = Number(capacity.availableBeds) || 0;
    const icuBeds = Number(capacity.icuBeds) || 0;
    const operationTheatres = Number(capacity.operationTheatres) || 0;
    const onDutySpecialist = Number(capacity.onDutySpecialist) || 0;
    const emergencyAvailable = !!capacity.emergencyAvailable;

    const specialties = Array.isArray(hospital.specialties) ? hospital.specialties : [];
    const governmentApproved = !!hospital.governmentApproved;
    const governmentSchemes = !!hospital.governmentSchemes;
    const insuranceAvailable = !!hospital.insuranceAvailable;
    const insuranceSanctionRate = Number(hospital.insuranceSanctionRate) || 0;

    // 1. Infrastructure Score (Max 40 points)
    // Bed Score: 15 points max (capped at 100 beds)
    const bedScore = Math.min(totalBeds / 100, 1) * 15;
    // ICU Score: 10 points max (capped at 10 beds)
    const icuScore = Math.min(icuBeds / 10, 1) * 10;
    // OT Score: 5 points max (capped at 5 OTs)
    const otScore = Math.min(operationTheatres / 5, 1) * 5;
    // Specialist Score: 5 points max (capped at 10 specialists)
    const specialistScore = Math.min(onDutySpecialist / 10, 1) * 5;
    // Emergency Score: 5 points if available
    const emergencyScore = emergencyAvailable ? 5 : 0;

    const infrastructureScore = bedScore + icuScore + otScore + specialistScore + emergencyScore;

    // 2. Utilization Score (Max 15 points)
    let utilizationScore = 0;
    if (totalBeds > 0) {
        const occupancyRate = (totalBeds - availableBeds) / totalBeds;

        // Ideal occupancy range is 60% to 85%
        if (occupancyRate >= 0.6 && occupancyRate <= 0.85) {
            utilizationScore = 15;
        } else if (occupancyRate < 0.6) {
            // Scale down proportionally from 0.6 to 0
            utilizationScore = (occupancyRate / 0.6) * 15;
        } else if (occupancyRate > 0.85) {
            // Scale down proportionally from 0.85 to 1.0 (overcapacity)
            // At 1.0 (100% full), the score drops to 0
            utilizationScore = Math.max(0, 15 - ((occupancyRate - 0.85) / (1 - 0.85)) * 15);
        }
    }

    // 3. Governance & Financial Score (Max 25 points)
    const governanceScore =
        (governmentApproved ? 10 : 0) +
        (governmentSchemes ? 5 : 0) +
        (insuranceAvailable ? 5 : 0) +
        (Math.min(insuranceSanctionRate, 1) * 5);

    // 4. Clinical Coverage Score (Max 20 points)
    // Max score achieved with 8 or more specialties
    const clinicalCoverageScore = Math.min(specialties.length / 8, 1) * 20;

    // 5. Final Calculation
    const finalScore = infrastructureScore + utilizationScore + governanceScore + clinicalCoverageScore;
    const starRating = (finalScore / 100) * 5;

    // 6. Explanation Generator (Max 3)
    const explanations = [];
    if (infrastructureScore > 30) explanations.push("Strong critical care and surgical infrastructure.");
    if (utilizationScore >= 13) explanations.push("Healthy operational capacity and bed utilization.");
    if (governanceScore >= 20) explanations.push("Government-recognized with strong insurance support.");
    if (clinicalCoverageScore >= 15) explanations.push("Broad specialty coverage across departments.");

    // Limit to max 3 bullets
    const finalExplanations = explanations.slice(0, 3);

    // 7. Radar Chart Data (Percentages)
    const radarData = {
        infrastructure: Math.round((infrastructureScore / 40) * 100),
        utilization: Math.round((utilizationScore / 15) * 100),
        governance: Math.round((governanceScore / 25) * 100),
        clinicalCoverage: Math.round((clinicalCoverageScore / 20) * 100)
    };

    // 8. Confidence Indicator
    let confidenceScore = 100;

    // Check if fields exist and are valid (not null/undefined)
    if (hospital.capacity?.totalBeds === undefined || hospital.capacity?.totalBeds === null) confidenceScore -= 20;
    if (hospital.capacity?.icuBeds === undefined || hospital.capacity?.icuBeds === null) confidenceScore -= 20;
    if (!hospital.specialties || !Array.isArray(hospital.specialties)) confidenceScore -= 20;
    if (hospital.insuranceSanctionRate === undefined || hospital.insuranceSanctionRate === null) confidenceScore -= 20;

    confidenceScore = Math.max(40, confidenceScore);

    let confidenceLabel = "Low"
    if (confidenceScore >= 80) confidenceLabel = "High";
    else if (confidenceScore >= 60) confidenceLabel = "Medium";

    return {
        finalScore: Number(finalScore.toFixed(2)),
        starRating: Number(starRating.toFixed(1)),
        breakdown: {
            infrastructure: Number(infrastructureScore.toFixed(2)),
            utilization: Number(utilizationScore.toFixed(2)),
            governance: Number(governanceScore.toFixed(2)),
            clinicalCoverage: Number(clinicalCoverageScore.toFixed(2))
        },
        radarData,
        explanations: finalExplanations,
        confidenceScore,
        confidenceLabel
    };
}
