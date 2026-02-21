const conditionDictionary = require('./condition_dictionary.json');

/**
 * Builds a structured output for a given condition, selecting the most intensive treatment path.
 * 
 * @param {string} conditionKey - The internal identifier for the condition (e.g., 'coronary_artery_disease').
 * @returns {object|null} - The structured output conforming to the contract or null if not found.
 */
function buildStructuredOutput(conditionKey) {
    const condition = conditionDictionary[conditionKey];
    if (!condition) {
        return null;
    }

    const intensityRanking = {
        "Low": 1,
        "Medium": 2,
        "High": 3,
        "Very High": 4
    };

    // Select the treatment path with the highest intensity
    let selectedPath = null;
    let maxRank = 0;

    if (condition.treatment_paths && Array.isArray(condition.treatment_paths)) {
        for (const path of condition.treatment_paths) {
            const currentRank = intensityRanking[path.intensity] || 0;
            if (currentRank > maxRank) {
                maxRank = currentRank;
                selectedPath = path;
            }
        }
    }

    if (!selectedPath) {
        return null;
    }

    // Return object using field names exactly as defined in contract_definition.json
    return {
        conditionCategory: condition.category,
        conditionName: condition.condition_name,
        selectedTreatment: selectedPath.name,
        requiresICU: selectedPath.requires_icu,
        resourceIntensity: selectedPath.intensity,
        // Internal-use metadata: Required instruments for clinical validation
        requiredInstruments: selectedPath.required_instruments || []
    };
}

module.exports = {
    buildStructuredOutput
};
