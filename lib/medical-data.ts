
export interface Treatment {
    id: string;
    name: string;
    simpleDescription: string;
    medicalDescription: string;
    recoveryTime: string;
    hospitalStay: "Yes" | "No" | "Day Care";
    icuPossibility: "Low" | "Medium" | "High";
    costEstimateRange?: { min: number; max: number };
}

export interface Condition {
    id: string;
    keywords: string[];
    name: string;
    category: string; // e.g., Orthopedics, Cardiology
    conditionCategory?: string; // Standardized key used for matching
    simpleExplanation: string;
    medicalExplanation: string;
    treatments: Treatment[];
}

export interface PatientContext {
    latitude?: number | null;
    longitude?: number | null;
    travelFlexibility?: string;
    city?: string;
    state?: string;
}

export interface RecommendationResult extends Condition {
    symptoms?: string;
    patientContext?: {
        latitude?: number;
        longitude?: number;
        travelFlexibility?: string;
    };
    selectedTreatment?: string;
    resourceIntensity?: string;
    requiresICU?: boolean;
}

export interface HospitalInstrument {
    hospital_id: string;
    name: string;
    instruments: {
        available: string[];
        last_updated: string;
        verified: boolean;
    }
}

export const medicalData: Condition[] = [
    {
        id: "osteoarthritis-knee",
        keywords: ["knee pain", "joint pain", "difficulty walking", "knee arthritis", "knee injury"],
        name: "Osteoarthritis (Knee)",
        category: "Orthopedic",
        simpleExplanation: "Wear and tear of the knee joint causing pain and stiffness. It happens when the protective cushion (cartilage) between your bones wears down.",
        medicalExplanation: "Degenerative joint disease characterized by the breakdown of articular cartilage and underlying bone. Symptoms include joint pain, stiffness, and locomotor restriction.",
        treatments: [
            {
                id: "knee-replacement-total",
                name: "Total Knee Replacement (TKR)",
                simpleDescription: "Surgery to replace the damaged knee joint with artificial parts (metal and plastic). Best for severe pain when other treatments fail.",
                medicalDescription: "Surgical procedure to replace the weight-bearing surfaces of the knee joint to relieve pain and disability. Involves resection of damaged femoral and tibial surfaces.",
                recoveryTime: "3-6 months for full recovery; walking with support in 2 days.",
                hospitalStay: "Yes",
                icuPossibility: "Low"
            },
            {
                id: "knee-arthroscopy",
                name: "Knee Arthroscopy",
                simpleDescription: "A minor surgery using a tiny camera to look inside and fix small problems like torn cartilage.",
                medicalDescription: "Minimally invasive surgical procedure on a joint in which an examination and sometimes treatment of damage is performed using an arthroscope.",
                recoveryTime: "2-4 weeks",
                hospitalStay: "Day Care",
                icuPossibility: "Low"
            },
            {
                id: "physiotherapy-conservative",
                name: "Physiotherapy & Medication",
                simpleDescription: "Exercises to strengthen muscles around the knee and medicines to reduce pain. No surgery involved.",
                medicalDescription: "Conservative management including NSAIDs, weight management, and physical therapy to improve range of motion and muscle strength.",
                recoveryTime: "Ongoing",
                hospitalStay: "No",
                icuPossibility: "Low"
            }
        ]
    },
    {
        id: "coronary-artery-disease",
        keywords: ["heart blockage", "chest pain", "angina", "shortness of breath", "heart attack"],
        name: "Coronary Artery Disease (Heart Blockage)",
        category: "Cardiac",
        simpleExplanation: "Narrowing of the blood vessels that supply blood to the heart. This can cause chest pain or a heart attack.",
        medicalExplanation: "Pathological process characterized by the accumulation of atherosclerotic plaque within the coronary arteries, leading to reduced myocardial blood flow.",
        treatments: [
            {
                id: "angioplasty-stent",
                name: "Angioplasty & Stenting",
                simpleDescription: "A procedure to open blocked arteries using a tiny balloon and placing a small mesh tube (stent) to keep it open.",
                medicalDescription: "Percutaneous Coronary Intervention (PCI) involving balloon dilation and deployment of a drug-eluting stent to restore patency.",
                recoveryTime: "1 week",
                hospitalStay: "Yes",
                icuPossibility: "Low"
            },
            {
                id: "cabg-bypass",
                name: "Coronary Artery Bypass Graft (CABG)",
                simpleDescription: "Open heart surgery to create a new path for blood to flow around a blocked artery.",
                medicalDescription: "Surgical procedure that diverts blood around narrowed or clogged parts of the major arteries to improve blood flow and oxygen supply to the heart.",
                recoveryTime: "2-3 months",
                hospitalStay: "Yes",
                icuPossibility: "High"
            }
        ]
    },
    {
        id: "gallstones",
        keywords: ["gallstones", "stomach pain", "abdominal pain", "gallbladder stone"],
        name: "Gallstones (Cholelithiasis)",
        category: "General Surgery",
        simpleExplanation: "Hardened deposits of digestive fluid that can form in your gallbladder, causing sudden pain in the upper right abdomen.",
        medicalExplanation: "Presence of stones in the gallbladder, which can cause cholecystitis (inflammation) or obstruction of the biliary tree.",
        treatments: [
            {
                id: "laparoscopic-cholecystectomy",
                name: "Laparoscopic Cholecystectomy",
                simpleDescription: "Keyhole surgery to remove the gallbladder. It has a faster recovery and smaller scars.",
                medicalDescription: "Minimally invasive removal of the gallbladder using a laparoscope. The standard of care for symptomatic gallstones.",
                recoveryTime: "1-2 weeks",
                hospitalStay: "Day Care",
                icuPossibility: "Low"
            },
            {
                id: "open-cholecystectomy",
                name: "Open Cholecystectomy",
                simpleDescription: "Traditional surgery with a larger cut to remove the gallbladder. Used if keyhole surgery isn't possible.",
                medicalDescription: "Surgical removal of the gallbladder through a large abdominal incision (subcostal). Usually reserved for complicated cases.",
                recoveryTime: "4-6 weeks",
                hospitalStay: "Yes",
                icuPossibility: "Medium"
            }
        ]
    },
    {
        id: "cataract",
        keywords: ["cataract", "blurry vision", "cloudy vision", "eye surgery"],
        name: "Cataract",
        category: "Other",
        simpleExplanation: "Clouding of the eye's natural lens, which lies behind the iris and the pupil. It is the most common cause of vision loss in people over age 40.",
        medicalExplanation: "Opacification of the crystalline lens of the eye which obstructs the passage of light.",
        treatments: [
            {
                id: "phacoemulsification",
                name: "Phacoemulsification (Phaco)",
                simpleDescription: "Modern cataract surgery using ultrasound to break up the cloudy lens and replace it with a clear artificial lens.",
                medicalDescription: "Ultrasonic emulsification of the cataractous lens through a small incision, followed by aspiration and implantation of an Intraocular Lens (IOL).",
                recoveryTime: "2-4 weeks",
                hospitalStay: "Day Care",
                icuPossibility: "Low"
            }
        ]
    }
];
