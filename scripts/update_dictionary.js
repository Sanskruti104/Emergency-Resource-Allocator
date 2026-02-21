const fs = require('fs');
const path = require('path');

const dictionaryPath = path.join(process.cwd(), 'treatment', 'condition_dictionary.json');
const dictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));

const instrumentMapping = {
    "Cath Lab": ["cath_lab_system"],
    "Cardiac ICU": ["icu_monitor", "ventilator", "oxygen_supply", "ecg_monitor"],
    "Neuro ICU": ["icu_monitor", "ventilator", "oxygen_supply"],
    "ICU": ["icu_monitor", "ventilator", "oxygen_supply"],
    "Cardiac OT": ["anesthesia_workstation", "icu_monitor", "ecg_monitor"],
    "Neuro OT": ["anesthesia_workstation", "icu_monitor"],
    "Modular OT": ["anesthesia_workstation"],
    "General OT": ["anesthesia_workstation"],
    "Laparoscopic OT": ["anesthesia_workstation", "endoscopy_unit"],
    "Endoscopy Suite": ["endoscopy_unit"],
    "Radiology": ["ct_scanner"],
    "MRI Center": ["mri_scanner"],
    "CT Scan": ["ct_scanner"],
    "Neuro-interventional Suite": ["ct_scanner", "anesthesia_workstation"],
    "Emergency Department": ["defibrillator", "ecg_monitor", "oxygen_supply"]
};

for (const condition in dictionary) {
    const treatments = dictionary[condition].treatment_paths;
    if (treatments) {
        treatments.forEach(path => {
            const instruments = new Set();
            if (path.required_capabilities) {
                path.required_capabilities.forEach(cap => {
                    if (instrumentMapping[cap]) {
                        instrumentMapping[cap].forEach(inst => instruments.add(inst));
                    }
                });
            }

            // Special cases based on treatment name
            if (path.name.toLowerCase().includes('mri')) instruments.add('mri_scanner');
            if (path.name.toLowerCase().includes('ct scan')) instruments.add('ct_scanner');
            if (path.name.toLowerCase().includes('ventilator')) instruments.add('ventilator');
            if (path.name.toLowerCase().includes('dialysis')) instruments.add('dialysis_unit');
            if (path.name.toLowerCase().includes('endoscopy')) instruments.add('endoscopy_unit');
            if (path.name.toLowerCase().includes('angioplasty')) instruments.add('cath_lab_system');

            path.required_instruments = Array.from(instruments);
        });
    }
}

fs.writeFileSync(dictionaryPath, JSON.stringify(dictionary, null, 4));
console.log('Updated condition_dictionary.json with required_instruments');
