const { validateCompatibility } = require('./instrument_validator');
const conditionDictionary = require('./condition_dictionary.json');

/**
 * Validation Test Suite for Instrument Compatibility System
 */

console.log("=".repeat(80));
console.log("INSTRUMENT COMPATIBILITY SYSTEM TEST");
console.log("=".repeat(80));

const testCases = [
    {
        name: "FULL MATCH: Hospital has all required equipment for Angioplasty",
        required: ["cath_lab_system", "icu_monitor", "ventilator", "oxygen_supply", "ecg_monitor"],
        available: ["cath_lab_system", "icu_monitor", "ventilator", "oxygen_supply", "ecg_monitor", "mri_scanner"]
    },
    {
        name: "PARTIAL MATCH: Hospital missing non-critical elective equipment",
        required: ["anesthesia_workstation", "endoscopy_unit"],
        available: ["anesthesia_workstation"]
    },
    {
        name: "CRITICAL MISSING: Hospital missing Ventilator for intensive care",
        required: ["ventilator", "oxygen_supply", "icu_monitor"],
        available: ["oxygen_supply", "icu_monitor"]
    },
    {
        name: "NO MATCH: Hospital missing almost everything",
        required: ["mri_scanner", "anesthesia_workstation", "icu_monitor"],
        available: ["xray_machine"]
    }
];

testCases.forEach((tc, index) => {
    const result = validateCompatibility(tc.required, tc.available);

    console.log(`\nTest #${index + 1}: ${tc.name}`);
    console.log(`- Required:  [${tc.required.join(", ")}]`);
    console.log(`- Available: [${tc.available.join(", ")}]`);
    console.log(`- Status:    ${result.status}`);
    console.log(`- Score:     ${result.score.toFixed(1)}`);
    console.log(`- Match %:   ${(result.matchRatio * 100).toFixed(0)}%`);

    if (result.missing.length > 0) {
        console.log(`- Missing:   [${result.missing.join(", ")}]`);
    }

    // Safety check simulation
    if (result.status === "CRITICAL_MISSING") {
        console.log(">>> [SAFETY ALERT] Hospital rejected for this treatment path.");
    } else if (result.status === "FULL_MATCH") {
        console.log(">>> [VERIFIED] Hospital recommended with priority (+15 bonus).");
    }
});

console.log("\n" + "=".repeat(80));
console.log("DICTIONARY VERIFICATION");
console.log("- Checking for required_instruments field in condition_dictionary.json");

let instrumentCount = 0;
let totalPaths = 0;

Object.values(conditionDictionary).forEach(cond => {
    cond.treatment_paths?.forEach(path => {
        totalPaths++;
        if (path.required_instruments) instrumentCount++;
    });
});

console.log(`- Paths found: ${totalPaths}`);
console.log(`- Instruments mapped: ${instrumentCount}`);
console.log("- Status: " + (instrumentCount === totalPaths ? "PASSED (100% Coverage)" : "FAILED (Missing Fields)"));
console.log("=".repeat(80));
