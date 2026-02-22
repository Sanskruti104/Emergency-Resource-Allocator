import { ExplainabilityDashboard, ExplainabilityData } from "@/components/medical/ExplainabilityUI";

export default function ExplainabilityPage() {
    const sampleData: ExplainabilityData = {
        hospital_name: "Apollo Cardiac Institute",
        reasons: {
            top_reasons: [
                "Expert clinical alignment (88% match)",
                "Confirmed immediate specialist availability",
                "Highly equipped facility for Cardiac Surgery",
                "Low financial shock probability"
            ],
            risk_warnings: [
                "High travel distance from local residence",
                "Slight markup in non-clinical pricing"
            ],
            summary: "This facility is highly recommended due to its superior clinical standards and equipment match for your specific condition."
        },
        tradeoffs: {
            tradeoffs: [
                {
                    type: "Quality vs. Distance",
                    description: "This facility offers premium cardiac care but is located 25km away from your primary residence.",
                    severity: "medium"
                },
                {
                    type: "Investment vs. Outcome",
                    description: "Higher out-of-pocket expense compared to local options, but justified by significantly lower recovery risk.",
                    severity: "low"
                }
            ],
            tradeoff_summary: "A balanced recommendation with a slight lean towards premium care quality over logistical convenience.",
            indicators: {
                high_quality: true,
                high_cost: false,
                remote: true,
                intensive_recovery: false
            }
        },
        value_tags: {
            tags: ["BEST_VALUE", "PREMIUM_CARE"],
            primary_tag: "BEST_VALUE"
        },
        summary: {
            executive_summary: "Apollo Cardiac Institute offers the best clinical outcome for your procedure. While it involves a 45-minute commute, the risk of clinical complications is 15% lower than the regional average.",
            highlights: [
                "Top-tier Robot-Assisted Surgical Suite",
                "98% Success Rate for Valve Replacements",
                "Full Insurance Coverage for Private Ward"
            ],
            cautions: [
                "Requires advance booking of 48 hours for ICU clearance",
                "Limited visitor hours in the high-dependency unit"
            ]
        },
        suitability_score: 92,
        feature_impact: {
            instrument_match_ratio: 100.0,
            icu_available: 45.2,
            specialty_match_score: 32.1,
            budget_range: 5.5,
            distance_km: -12.4,
            out_of_pocket: -8.2
        },
        comparison: {
            ranking: ["Apollo Cardiac Institute", "City Heart Center", "Fortis Memorial", "Community General"],
            best_overall: "Apollo Cardiac Institute",
            lowest_cost: "Community General",
            lowest_risk: "Apollo Cardiac Institute",
            best_equipment_match: "Apollo Cardiac Institute",
            shortest_distance: "City Heart Center",
            comparison_matrix: [
                {
                    hospital_name: "Apollo Cardiac Institute",
                    suitability: 92,
                    out_of_pocket: 185000,
                    distance: 25,
                    recovery_index: 22,
                    top_driver: "instrument_match_ratio"
                },
                {
                    hospital_name: "City Heart Center",
                    suitability: 84,
                    out_of_pocket: 120000,
                    distance: 8,
                    recovery_index: 35,
                    top_driver: "distance_km"
                },
                {
                    hospital_name: "Community General",
                    suitability: 65,
                    out_of_pocket: 45000,
                    distance: 12,
                    recovery_index: 18,
                    top_driver: "budget_range"
                }
            ]
        }
    };

    return <ExplainabilityDashboard data={sampleData} />;
}
