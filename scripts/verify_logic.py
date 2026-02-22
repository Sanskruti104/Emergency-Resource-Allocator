import pickle
import pandas as pd
import numpy as np
import os
import sys

# Add scripts directory to path for imports if needed
sys.path.append(os.path.join(os.getcwd(), 'scripts'))
from feature_engineering import create_interaction_features

def quick_verify():
    print("--- MedDecision Model Logic Verification ---")
    
    # Load artifacts
    with open("feature_pipeline.pkl", "rb") as f:
        pipeline = pickle.load(f)
    with open("suitability_model.pkl", "rb") as f:
        reg_model = pickle.load(f)
    with open("risk_model.pkl", "rb") as f:
        clf_model = pickle.load(f)

    # Test Case 1: Ideal Match
    case_ideal = {
        "budget_range": 1500000.0,
        "insurance_type": 3, # Premium
        "urgency_level": 2,
        "icu_required": 0,
        "travel_flexibility": 0.9,
        "specialty_match_score": 0.95,
        "capacity_level": 0.2, # Low occupancy
        "icu_available": 10,
        "insurance_acceptance_rate": 0.98,
        "negotiated_rate_diff": -0.1,
        "claim_reliability": 0.98,
        "avg_recovery_days": 4.0,
        "govt_scheme_support": 1,
        "instrument_match_ratio": 1.0,
        "budget_compatibility_ratio": 0.5, # Very safe
        "urgency_capacity_alignment": 0.1,
        "cost_deviation_ratio": -0.1,
        "reliability_index": 0.98
    }

    # Test Case 2: Critical Safety Risk (ICU Required but unavailable)
    case_no_icu = case_ideal.copy()
    case_no_icu['icu_required'] = 1
    case_no_icu['icu_available'] = 0
    case_no_icu['urgency_level'] = 5

    # Test Case 3: High Financial Risk
    case_expensive = case_ideal.copy()
    case_expensive['budget_range'] = 100000.0 # Low budget
    case_expensive['budget_compatibility_ratio'] = 2.5 # Huge gap
    case_expensive['claim_reliability'] = 0.4

    cases = [case_ideal, case_no_icu, case_expensive]
    labels = ["Ideal Match", "Critical Safety Risk (Missing ICU)", "High Financial Risk"]

    for i, case in enumerate(cases):
        df_input = pd.DataFrame([case])
        X_trans = pipeline.transform(df_input)
        
        score = reg_model.predict(X_trans)[0]
        risk = clf_model.predict(X_trans)[0]
        
        print(f"\nScenario: {labels[i]}")
        print(f"-> Suitability Score: {score:.2f}/100")
        print(f"-> Financial Risk: {risk}")

if __name__ == "__main__":
    quick_verify()
