/**
 * Doctor Recommendation Explainability Engine (DREE)
 * Generates human-readable clinical narratives for why a doctor is prioritized.
 */

export interface ExplanationResult {
    summary: string;
    highlights: string[];
    availabilityText: string;
    expertiseMeta: string;
}

export function generateDoctorExplanation(doctor: any, rankingScore: number): ExplanationResult {
    const highlights: string[] = [];

    // 1. Expertise Narrative
    const expYears = Number(doctor.experience) || 0;
    let expertiseMeta = "";
    if (expYears > 20) {
        expertiseMeta = "Senior Consultant with over two decades of clinical mastery.";
        highlights.push("Veteran clinical expert in " + doctor.specialization);
    } else if (expYears > 10) {
        expertiseMeta = "Highly experienced specialist with a proven clinical track record.";
        highlights.push("Significant practice experience");
    } else {
        expertiseMeta = "Board-certified specialist with modern clinical training.";
    }

    // 2. Trust Narrative
    if (doctor.hospitalCount > 3) {
        highlights.push(`Trusted by ${doctor.hospitalCount} major medical institutions`);
    }

    // 3. Availability Narrative
    const dayCount = doctor.schedule.days.length;
    let availabilityText = "";
    if (dayCount >= 5) {
        availabilityText = "Exceptional availability across the work week.";
        highlights.push("High appointment availability");
    } else if (dayCount >= 3) {
        availabilityText = "Regular weekly OPD presence.";
    } else {
        availabilityText = "Specific weekly consultation slots.";
    }

    // 4. Recommendation Summary
    let summary = "";
    if (rankingScore >= 85) {
        summary = `Top-tier recommendation based on exceptional experience and widespread institutional trust in ${doctor.specialization}.`;
    } else if (rankingScore >= 70) {
        summary = `Highly recommended specialist with balanced expertise and reliable hospital presence.`;
    } else {
        summary = `Qualified specialist suitable for ${doctor.specialization} consultations at this facility.`;
    }

    return {
        summary,
        highlights,
        availabilityText,
        expertiseMeta
    };
}
