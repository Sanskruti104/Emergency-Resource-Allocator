/**
 * Clinical Consultant Ranking System (CCRS)
 * Designed for MedDecision to prioritize expert medical professionals
 */

export interface RankingFactors {
    experienceYears: number;
    daysAvailable: number; // 1-7
    dailyHours: number; // hours per day
    hospitalCount: number;
    searchMatchBoost: number; // 0 to 1 based on keyword overlap
}

export function calculateDoctorScore(factors: RankingFactors): number {
    const weights = {
        experience: 0.30,
        availability: 0.30,
        hospitalTrust: 0.10,
        relevance: 0.30
    };

    // 1. Experience Score (Max 100)
    // We consider 25 years as the benchmark for peak seniority
    const experienceScore = Math.min((factors.experienceYears / 25) * 100, 100);

    // 2. Availability Score (Max 100)
    // Combination of breadth (days) and depth (hours)
    const dayDensity = (factors.daysAvailable / 7) * 70;
    const hourDensity = Math.min((factors.dailyHours / 8) * 30, 30); // 8 hours is standard full day
    const availabilityScore = dayDensity + hourDensity;

    // 3. Hospital Trust Score (Max 100)
    // Being associated with multiple institutions increases reliability/demand
    // Benchmark: 4+ hospitals is highly prestigious
    const trustScore = Math.min((factors.hospitalCount / 4) * 100, 100);

    // 4. Relevance Score (Max 100)
    const relevanceScore = factors.searchMatchBoost * 100;

    // Weighted Sum
    const finalScore = (
        (experienceScore * weights.experience) +
        (availabilityScore * weights.availability) +
        (trustScore * weights.hospitalTrust) +
        (relevanceScore * weights.relevance)
    );

    return Math.round(finalScore * 10) / 10;
}

export function sortDoctorsByRank(doctors: any[], searchBoostMap: Map<string, number>) {
    return doctors.map(doc => {
        // Calculate daily hours from startTime/endTime "09:00" format
        const [sh, sm] = doc.schedule.startTime.split(':').map(Number);
        const [eh, em] = doc.schedule.endTime.split(':').map(Number);
        const hours = (eh + em / 60) - (sh + sm / 60);

        const score = calculateDoctorScore({
            experienceYears: Number(doc.experience) || 0,
            daysAvailable: doc.schedule.days.length,
            dailyHours: Math.max(hours, 0),
            hospitalCount: doc.hospitalCount || 1, // Will be computed in aggregation
            searchMatchBoost: searchBoostMap.get(doc._id.toString()) || 0
        });

        return { ...doc, rankingScore: score };
    }).sort((a, b) => b.rankingScore - a.rankingScore);
}
