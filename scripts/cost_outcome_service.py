import logging
import unittest
import json
import os
import sys

# Ensure local script directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the individual engine components
try:
    from cost_calculator import run_cost_analysis, calculate_total_cost, apply_govt_subsidy
    from insurance_logic import integrate_with_calculator, InsuranceEngine
    from financial_risk_engine import FinancialRiskEngine
    from recovery_index import calculate_rbi
except ImportError as e:
    # Fallback for direct execution if pathing is complex in specific environments
    print(f"Import Error: {e}. Ensure all component scripts are in the same directory.")
    raise

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("CostOutcomeService")

class CostOutcomeService:
    """
    Orchestrator for the MedDecision Cost-Outcome Pipeline.
    Integrates clinical costs, insurance adjudication, and financial risk modeling.
    """

    def __init__(self):
        self.risk_engine = FinancialRiskEngine()

    def generate_summary_tag(self, rbi, risk_label):
        """Generates a semantic tag for frontend UI highlighting."""
        if rbi > 80 or risk_label == "Critical":
            return "FINANCIAL_VULNERABILITY_ALERT"
        if rbi > 50 or risk_label == "High":
            return "HIGH_OUT_OF_POCKET_EXPOSURE"
        if rbi < 30 and risk_label == "Low":
            return "OPTIMAL_FINANCIAL_FIT"
        return "STANDARD_CLINICAL_EPISODE"

    def process_patient_hospital_match(self, data):
        """
        Executes the end-to-end financial and outcomes analysis.
        
        Input Schema:
        {
            "patient": {"budget": float, "insurance_type": str, "govt_eligible": bool},
            "hospital": {"pricing_index": float, "govt_support": bool},
            "treatment": {"base_cost": float, "is_icu": bool, "intensity": int, "recovery_days": int},
            "ml_outputs": {"risk_class": str, "risk_score": float}
        }
        """
        try:
            # 1. Validation
            required = ["patient", "hospital", "treatment", "ml_outputs"]
            if not all(k in data for k in required):
                raise ValueError(f"Missing required data blocks. Required: {required}")

            # 2. Step 1: Calculate Gross & Net Clinical Cost
            logger.info("Step 1: Calculating Clinical Costs...")
            gross_cost = calculate_total_cost(
                base_cost=data['treatment']['base_cost'],
                pricing_index=data['hospital']['pricing_index'],
                icu_required=data['treatment']['is_icu'],
                instrument_intensity=data['treatment']['intensity'],
                recovery_days=data['treatment']['recovery_days']
            )
            net_total = apply_govt_subsidy(gross_cost, data['hospital']['govt_support'] and data['patient']['govt_eligible'])

            # 3. Step 2: Adjudication (Insurance Split)
            logger.info("Step 2: Adjudicating Insurance Claim...")
            adj_res = InsuranceEngine.adjudicate_claim(
                total_cost=net_total,
                insurance_type=data['patient']['insurance_type'],
                govt_scheme_flag=data['patient']['govt_eligible'] and data['hospital']['govt_support']
            )

            # 4. Step 3: Risk Modeling
            logger.info("Step 3: Evaluating Financial Risk...")
            risk_res = self.risk_engine.analyze_risk(
                out_of_pocket_cost=adj_res['final_out_of_pocket'],
                base_treatment_cost=data['treatment']['base_cost'],
                ml_risk_class=data['ml_outputs']['risk_class']
            )

            # 5. Step 4: Recovery Impact Calculation
            logger.info("Step 4: Calculating Recovery Burden Index...")
            rbi = calculate_rbi(
                out_of_pocket_cost=adj_res['final_out_of_pocket'],
                base_treatment_cost=data['treatment']['base_cost'],
                recovery_days=data['treatment']['recovery_days'],
                ml_risk_score=data['ml_outputs']['risk_score']
            )

            # 6. Aggregation & Tagging
            summary_tag = self.generate_summary_tag(rbi, risk_res['risk_label'])

            output = {
                "estimated_total_cost": net_total,
                "insurance_covered": adj_res['approved_amount'],
                "out_of_pocket": adj_res['final_out_of_pocket'],
                "shock_probability": risk_res['shock_probability'],
                "risk_label": risk_res['risk_label'],
                "recovery_burden_index": rbi,
                "financial_summary_tag": summary_tag
            }

            logger.info(f"Analysis Complete. Result: {summary_tag}")
            return output

        except Exception as e:
            logger.error(f"Cost-Outcome Service Failure: {str(e)}")
            raise

# --- Unit Tests ---
class TestCostOutcomeService(unittest.TestCase):
    def setUp(self):
        self.service = CostOutcomeService()

    def test_ideal_optimal_flow(self):
        # Case: Moderate cost, High insurance, Fast recovery
        test_data = {
            "patient": {"budget": 1000000, "insurance_type": "Private - Premium", "govt_eligible": False},
            "hospital": {"pricing_index": -0.05, "govt_support": False},
            "treatment": {"base_cost": 300000, "is_icu": False, "intensity": 2, "recovery_days": 3},
            "ml_outputs": {"risk_class": "Low", "risk_score": 0.15}
        }
        result = self.service.process_patient_hospital_match(test_data)
        self.assertEqual(result["financial_summary_tag"], "OPTIMAL_FINANCIAL_FIT")
        self.assertLess(result["out_of_pocket"], 100000)

    def test_high_vulnerability_flow(self):
        # Case: High markup, Uninsured, Long recovery
        test_data = {
            "patient": {"budget": 200000, "insurance_type": "None", "govt_eligible": False},
            "hospital": {"pricing_index": 0.25, "govt_support": False},
            "treatment": {"base_cost": 500000, "is_icu": True, "intensity": 5, "recovery_days": 20},
            "ml_outputs": {"risk_class": "High", "risk_score": 0.9}
        }
        result = self.service.process_patient_hospital_match(test_data)
        self.assertEqual(result["financial_summary_tag"], "FINANCIAL_VULNERABILITY_ALERT")
        self.assertEqual(result["risk_label"], "Critical")

if __name__ == "__main__":
    # Run Tests
    suite = unittest.TestLoader().loadTestsFromTestCase(TestCostOutcomeService)
    unittest.TextTestRunner(verbosity=2).run(suite)
    
    # Example Usage
    print("\n--- Cost-Outcome Service Production Demo ---")
    service = CostOutcomeService()
    sample_data = {
        "patient": {"budget": 500000, "insurance_type": "Private - Tier 2", "govt_eligible": False},
        "hospital": {"pricing_index": 0.1, "govt_support": False},
        "treatment": {"base_cost": 400000, "is_icu": True, "intensity": 3, "recovery_days": 7},
        "ml_outputs": {"risk_class": "Medium", "risk_score": 0.5}
    }
    
    results = service.process_patient_hospital_match(sample_data)
    print(json.dumps(results, indent=4))
