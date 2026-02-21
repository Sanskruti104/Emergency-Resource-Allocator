/**
 * Validates the compatibility of a hospital based on required and available instruments.
 */

const CRITICAL_INSTRUMENTS = [
    'ventilator',
    'icu_monitor',
    'cath_lab_system',
    'anesthesia_workstation',
    'oxygen_supply'
];

/**
 * Validates compatibility between required and available instruments.
 * 
 * @param {string[]} required - List of required instrument IDs.
 * @param {string[]} available - List of available instrument IDs.
 * @returns {object} - Validation result with status and score.
 */
function validateCompatibility(required, available = []) {
    if (!required || required.length === 0) {
        return {
            status: "FULL_MATCH",
            score: 100,
            matchRatio: 1.0,
            criticalMissing: false,
            missing: []
        };
    }

    const matched = required.filter(item => available.includes(item));
    const missing = required.filter(item => !available.includes(item));
    const matchRatio = matched.length / required.length;

    const criticalMissing = missing.some(item => CRITICAL_INSTRUMENTS.includes(item));

    let status = "NO_MATCH";
    let score = matchRatio * 100;

    if (criticalMissing) {
        status = "CRITICAL_MISSING";
        score = Math.max(0, score - 30); // Penalty for critical missing
    } else if (matchRatio === 1) {
        status = "FULL_MATCH";
    } else if (matchRatio >= 0.6) {
        status = "PARTIAL_MATCH";
    }

    return {
        status,
        score,
        matchRatio,
        criticalMissing,
        missing,
        matchedCount: matched.length,
        requiredCount: required.length
    };
}

module.exports = {
    validateCompatibility,
    CRITICAL_INSTRUMENTS
};
