import conditionDictionary from "../treatment/condition_dictionary.json";

export interface InstrumentStatus {
    available: string[];
    last_verified: string;
    verified: boolean;
}

export interface CompatibilityResult {
    status: "FULL_MATCH" | "PARTIAL_MATCH" | "NO_MATCH" | "CRITICAL_MISSING";
    matchRatio: number;
    missing: string[];
    scoreImpact: number;
    explanation: string;
}

const CRITICAL_INSTRUMENTS = [
    'ventilator',
    'icu_monitor',
    'cath_lab_system',
    'anesthesia_workstation',
    'oxygen_supply'
];

/**
 * Validates hospital instrument compatibility for a given treatment.
 */
export function validateInstruments(
    treatmentKey: string,
    availableInstruments: string[] = []
): CompatibilityResult {
    let required: string[] = [];
    let found = false;

    // Search in condition dictionary for required instruments
    for (const conditionKey in conditionDictionary) {
        const cond = (conditionDictionary as any)[conditionKey];

        // Check if treatmentKey matches condition name or if it's one of its treatment names
        const matchedPath = cond.treatment_paths?.find((p: any) =>
            p.name === treatmentKey ||
            treatmentKey.toLowerCase().includes(p.name.toLowerCase())
        );

        if (matchedPath) {
            required = matchedPath.required_instruments || [];
            found = true;
            break;
        }
    }

    if (!found || required.length === 0) {
        return {
            status: "FULL_MATCH",
            matchRatio: 1,
            missing: [],
            scoreImpact: 0,
            explanation: "✔ Full support: No specialized instrument requirements for this treatment."
        };
    }

    const matched = required.filter(i => availableInstruments.includes(i));
    const missing = required.filter(i => !availableInstruments.includes(i));
    const matchRatio = matched.length / required.length;
    const hasCriticalMissing = missing.some(i => CRITICAL_INSTRUMENTS.includes(i));

    let status: "FULL_MATCH" | "PARTIAL_MATCH" | "NO_MATCH" | "CRITICAL_MISSING" = "NO_MATCH";
    let scoreImpact = -30;
    let explanation = `❌ Not supported: Missing ${missing[0].replace(/_/g, " ")}.`;

    if (hasCriticalMissing) {
        status = "CRITICAL_MISSING";
        scoreImpact = -30;
        explanation = `❌ Not supported: Critical equipment (${missing.find(i => CRITICAL_INSTRUMENTS.includes(i))?.replace(/_/g, " ")}) missing.`;
    } else if (matchRatio === 1) {
        status = "FULL_MATCH";
        scoreImpact = 15;
        explanation = `✔ Full support: All required instruments available for ${treatmentKey}.`;
    } else if (matchRatio >= 0.6) {
        status = "PARTIAL_MATCH";
        scoreImpact = 5;
        explanation = `⚠ Partial support: Most required instruments present. Missing: ${missing.join(", ").replace(/_/g, " ")}.`;
    }

    return {
        status,
        matchRatio,
        missing,
        scoreImpact,
        explanation
    };
}

/**
 * Extracts features for ML Suitability Engine
 */
export function extractInstrumentFeatures(treatmentKey: string, availableInstruments: string[]) {
    const result = validateInstruments(treatmentKey, availableInstruments);

    return {
        instrument_match_ratio: result.matchRatio,
        critical_equipment_flag: (result.status === "CRITICAL_MISSING") ? 1 : 0,
        equipment_coverage_score: availableInstruments.length / 10 // Based on 10 standard instruments
    };
}
