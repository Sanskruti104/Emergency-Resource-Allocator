const conditionDictionary = require('./condition_dictionary.json');
const { buildStructuredOutput } = require('./treatment_selector');

/**
 * Main entry point for the Treatment Understanding Engine.
 * Processes clinical context into one or more structured treatment outputs.
 * 
 * @param {string} conditionKey - The identifier for the condition (optional).
 * @param {string} selectedCategory - The clinical category selected by the user (required).
 * @returns {Array<object>} - An array of structured treatment outputs.
 */
function processTreatmentInput(conditionKey, selectedCategory) {
    // Flow 1: Single-condition mapping
    // If a specific condition identifier is provided and exists in the dictionary,
    // we return an array containing only that specialized structured output.
    if (conditionKey) {
        const specializedOutput = buildStructuredOutput(conditionKey);
        if (specializedOutput) {
            return [specializedOutput];
        }
    }

    // Flow 2: Multi-condition expansion flow
    // If userInput is missing or mapping fails, we expand all known conditions 
    // within the selected category into an array of structured outputs.
    const expandedResults = [];

    // Filter the clinical dictionary for all conditions matching the selected category
    Object.keys(conditionDictionary).forEach(key => {
        const condition = conditionDictionary[key];
        if (condition.category?.toLowerCase() === selectedCategory?.toLowerCase()) {
            const output = buildStructuredOutput(key);
            if (output) {
                expandedResults.push(output);
            }
        }
    });

    return expandedResults;
}

module.exports = {
    processTreatmentInput
};
