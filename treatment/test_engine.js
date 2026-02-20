const { processTreatmentInput } = require('./treatment_engine');
const { mapInputToCondition } = require('./keyword_mapper');

/**
 * Stress Test Suite for Treatment Understanding Engine
 * Verifies mapping accuracy, treatment selection, and invalid input handling.
 */

const testInputs = [
    // Cardiac Cases (Specific)
    { input: "i have heart blockage and chest pressure", category: "Cardiac" },
    { input: "irregular heartbeat and racing feel", category: "Cardiac" },

    // Orthopedic Cases (Specific)
    { input: "hip joint pain while walking", category: "Orthopedic" },
    { input: "knee bone on bone grinding", category: "Orthopedic" },

    // Neuro Cases (Specific)
    { input: "sudden weakness on one side and slurred speech", category: "Neuro" },

    // General Surgery Cases (Specific)
    { input: "stomach pain right side and burst appendix", category: "General Surgery" },

    // NEW: Category-only cases (No condition matching)
    { input: "I need a general heart checkup", category: "Cardiac" },
    { input: "My bones hurt but i don't know why", category: "Orthopedic" },
    { input: "Feeling dizzy and confused", category: "Neuro" },
    { input: "I need a surgical consultation", category: "General Surgery" },

    // Invalid / Unrelated Cases (Should fall back to category evaluation)
    { input: "random headache and stress", category: "Neuro" },
    { input: "is it going to rain today", category: "General Surgery" }
];

console.log("=".repeat(80));
console.log("TREATMENT ENGINE STRESS TEST (OPTIONAL CONDITION SUPPORT)");
console.log("=".repeat(80));
console.log(`${"INPUT".padEnd(40)} | ${"CATEGORY".padEnd(10)} | ${"CONDITION".padEnd(20)} | ${"TREATMENT"}`);
console.log("-".repeat(80));

testInputs.forEach(({ input, category }, index) => {
    const conditionKey = mapInputToCondition(input);
    const results = processTreatmentInput(conditionKey, category);
    
    const inputDisplay = input.length > 37 ? input.substring(0, 34) + "..." : input;
    
    console.log(`\nInput: "${inputDisplay}" [Category: ${category}]`);
    console.log(`Matched Conditions: ${results.length}`);
    
    results.forEach((res, i) => {
        const treatment = res.selectedTreatment || "N/A (Evaluation Only)";
        console.log(
            `  [${i + 1}] ${res.conditionName.padEnd(25)} | ` +
            `${treatment.padEnd(40)} | Intensity: ${res.resourceIntensity}`
        );
    });
});

console.log("=".repeat(80));
console.log(`Test Complete: ${testInputs.length} cases processed.`);
console.log("=".repeat(80));
