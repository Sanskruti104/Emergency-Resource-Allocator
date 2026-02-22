import json
import logging
from cost_outcome_service import CostOutcomeService
from explainability_service import ExplainabilityService
import unittest

# Configure Validation Logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SystemValidation")

class MedDecisionValidationSuite:
    """
    Automated System Validation Suite for MedDecision.
    Evaluates functional correctness across clinical and financial edges.
    """

    def __init__(self):
        self.xai_service = ExplainabilityService()
        self.cost_service = CostOutcomeService()

    def run_validation(self):
        print("--- MedDecision System Validation Report ---")
        
        results = []
        
        # Test Case 1: The Clinical Hard-Gate
        # ICU required but none available
        tc1_data = {
            "ml_output": {"suitability_score": 15.0, "risk_class": "Low", "risk_score": 0.1},
            "cost_outcome_result": {"out_of_pocket": 50000, "recovery_burden_index": 20, "shock_probability": 0.05},
            "hospital_data": {"hospital_rating": 4.0, "distance_km": 5.0, "icu_beds": 0},
            "patient_profile": {"uid": "p001"},
            "doctor_availability": True,
            "instrument_validation": {"instrument_match_ratio": 0.0}
        }
        
        logger.info("Running TC-001: Clinical Hard-Gate Verification...")
        report1 = self.xai_service.generate_explainability_report(
            tc1_data["ml_output"], tc1_data["cost_outcome_result"], tc1_data["hospital_data"], 
            tc1_data["patient_profile"], tc1_data["doctor_availability"], tc1_data["instrument_validation"]
        )
        
        tc1_passed = any("Equipment Gap" in w for w in report1["reasons"]["risk_warnings"])
        results.append({"id": "TC-001", "name": "Clinical Hard-Gate", "status": "PASS" if tc1_passed else "FAIL"})

        # Test Case 2: Financial Shock Detection
        # Low budget, High OOP
        tc2_data = {
            "ml_output": {"suitability_score": 85.0, "risk_class": "High", "risk_score": 0.9},
            "cost_outcome_result": {"out_of_pocket": 800000, "recovery_burden_index": 85, "shock_probability": 0.95},
            "hospital_data": {"hospital_rating": 4.5, "distance_km": 10.0},
            "patient_profile": {"uid": "p002", "budget": 100000},
            "doctor_availability": True,
            "instrument_validation": {"instrument_match_ratio": 1.0}
        }
        
        logger.info("Running TC-002: Financial Shock Detection...")
        report2 = self.xai_service.generate_explainability_report(
            tc2_data["ml_output"], tc2_data["cost_outcome_result"], tc2_data["hospital_data"], 
            tc2_data["patient_profile"], tc2_data["doctor_availability"], tc2_data["instrument_validation"]
        )
        
        tc2_passed = report2["value_tags"]["primary_tag"] != "BEST_VALUE" and \
                     any("financial shock" in w for w in report2["reasons"]["risk_warnings"])
        results.append({"id": "TC-002", "name": "Financial Shock Alert", "status": "PASS" if tc2_passed else "FAIL"})

        # Final Summary
        print("\nVALIDATION SUMMARY:")
        for r in results:
            print(f"[{r['id']}] {r['name']:<25}: {r['status']}")
            
        with open("system_validation_results.json", "w") as f:
            json.dump(results, f, indent=4)
        print("\nFull validation logs exported to system_validation_results.json")

if __name__ == "__main__":
    suite = MedDecisionValidationSuite()
    suite.run_validation()
