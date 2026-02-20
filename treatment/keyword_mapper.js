const synonymMap = require('./synonym_map.json');

const DEBUG = true;


/**
 * Maps user input to a condition key based on a weighted scoring system.
 * 
 * @param {string} userInput - The raw input from the patient.
 * @returns {string|null} - The condition key or null if score < 0.3.
 */
function mapInputToCondition(userInput) {
    if (!userInput) return null;

    // 1. Process input: lowercase and remove basic stopwords
    const stopwords = ["i", "have", "am", "is", "the", "a", "an", "problem", "with", "since", "for", "and"];
    let processedInput = userInput.toLowerCase();
    processedInput = processedInput.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

    const inputTokens = processedInput.split(/\s+/).filter(token => token.length > 0 && !stopwords.includes(token));
    const cleanInput = inputTokens.join(" ");

    if (!cleanInput) return null;

    let conditionScores = {};

    // Evaluate all conditions without early returns
    for (const [condition, synonyms] of Object.entries(synonymMap)) {
        let maxConditionScore = 0;

        for (const synonym of synonyms) {
            let currentSynonymScore = 0;

            if (synonym === cleanInput) {
                // Exact phrase match
                currentSynonymScore = 1.0;
            } else if (cleanInput.includes(synonym) || synonym.includes(cleanInput)) {
                // Partial match
                currentSynonymScore = 0.7;
            } else {
                // Token overlap scoring
                const synonymTokens = synonym.split(/\s+/);
                const overlap = inputTokens.filter(token => synonymTokens.includes(token));

                if (synonymTokens.length > 0) {
                    currentSynonymScore = overlap.length / synonymTokens.length;
                }
            }

            if (currentSynonymScore > maxConditionScore) {
                maxConditionScore = currentSynonymScore;
            }
        }

        conditionScores[condition] = maxConditionScore;
    }

    // Find the condition with the highest score
    let bestCondition = null;
    let highestScore = 0;

    for (const [condition, score] of Object.entries(conditionScores)) {
        if (score > highestScore) {
            highestScore = score;
            bestCondition = condition;
        }
    }

    // Only return if confidence is high enough
    const result = highestScore >= 0.3 ? bestCondition : null;

    if (DEBUG) {
        console.log(`Input: "${userInput}"`);
        console.log("Scores:");
        Object.entries(conditionScores)
            .filter(([_, score]) => score > 0)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cond, score]) => {
                console.log(`  ${cond}: ${score.toFixed(2)}`);
            });
        console.log(`Selected: ${result || "None"}\n`);
    }

    return result;
}

module.exports = {
    mapInputToCondition
};
