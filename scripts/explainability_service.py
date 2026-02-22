import logging
import json
import unittest
import os
import sys

# Ensure scripts directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the specialized XAI engines
try:
    from reason_generator import ReasonGenerator
    from tradeoff_analyzer import TradeoffAnalyzer
    from value_tag_engine import ValueTagEngine
    from summary_builder import SummaryBuilder
    from comparison_engine import ComparisonEngine
except ImportError as e:
    print(f"Integration Error: {e}. Ensure all XAI/Comparison scripts are present.")
    raise

# Configuration Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("ExplainabilityService")

class ExplainabilityService:
    """
    Orchestrator for MedDecision's Human-AI Reasoning (XAI) layer.
    Transforms data-heavy ML and financial outputs into a high-utility 
    decision support package for patients.
    """

    def __init__(self):
        self.reasons = ReasonGenerator()
        self.tradeoffs = TradeoffAnalyzer()
        self.tags = ValueTagEngine()
        self.summarizer = SummaryBuilder()
        self.comparer = ComparisonEngine()

    def generate_explainability_report(self, ml_output, cost_outcome_result, hospital_data, patient_profile, doctor_availability, instrument_validation):
        """
        Generates XAI components for a single hospital.
        """
        # 1. Parameter Extraction
        suitability_score = ml_output.get("suitability_score", 0)
        instr_ratio = instrument_validation.get("instrument_match_ratio", 0)
        
        # Robust Rating Extraction
        raw_rating = hospital_data.get("hospital_rating", 0) or hospital_data.get("rating", 0)
        if isinstance(raw_rating, dict):
            rating = float(raw_rating.get("starRating", 0))
        else:
            rating = float(raw_rating)
            
        dist = hospital_data.get("distance_km", 0)
        
        oop_cost = cost_outcome_result.get("out_of_pocket", 0)
        rbi = cost_outcome_result.get("recovery_burden_index", 0)
        shock_prob = cost_outcome_result.get("shock_probability", 0)
        feature_impact = ml_output.get("feature_impact", {})

        shared_metrics = {
            "ml_suitability_score": suitability_score,
            "instrument_match_ratio": instr_ratio,
            "hospital_rating": rating,
            "cost_outcome_result": cost_outcome_result,
            "distance_km": dist,
            "doctor_availability": doctor_availability,
            "out_of_pocket_cost": oop_cost,
            "recovery_burden_index": rbi,
            "shock_probability": shock_prob,
            "feature_impact": feature_impact
        }

        # 2. Execution Phase
        reasons_output = self.reasons.generate_reasons(shared_metrics)
        tradeoffs_output = self.tradeoffs.analyze(shared_metrics)
        tags_output = self.tags.generate_tags(shared_metrics)
        
        summary_input = {
            "reasons": reasons_output,
            "tradeoffs": tradeoffs_output,
            "value_tags": tags_output,
            "cost_outcome_result": cost_outcome_result,
            "ml_suitability_score": suitability_score
        }
        final_summary = self.summarizer.build_summary(summary_input)

        return {
            "hospital_name": hospital_data.get("hospital_name") or hospital_data.get("name", "Unknown"),
            "reasons": reasons_output,
            "tradeoffs": tradeoffs_output,
            "value_tags": tags_output,
            "summary": final_summary,
            "metrics": shared_metrics # Kept for internal comparison use
        }

    def generate_comparative_report(self, candidate_data_list):
        """
        Primary entry point for multi-hospital matching.
        Generates individual XAI reports and then attaches global comparison context to each.
        """
        try:
            logger.info(f"Processing batch explainability for {len(candidate_data_list)} candidates...")
            
            # Step 1: Generate individual reports
            individual_reports = []
            comparison_inputs = []
            
            for data in candidate_data_list:
                report = self.generate_explainability_report(
                    ml_output=data['ml_output'],
                    cost_outcome_result=data['cost_outcome'],
                    hospital_data=data['hospital'],
                    patient_profile=data['patient'],
                    doctor_availability=data['doctor_available'],
                    instrument_validation=data['instrument_validation']
                )
                individual_reports.append(report)
                
                # Flatten the data for the comparison engine
                comparison_inputs.append({
                    "hospital_name": report['hospital_name'],
                    "suitability_score": report['metrics']['ml_suitability_score'],
                    "feature_impact": report['metrics']['feature_impact'],
                    "out_of_pocket": report['metrics']['out_of_pocket_cost'],
                    "shock_probability": report['metrics']['shock_probability'],
                    "recovery_burden_index": report['metrics']['recovery_burden_index'],
                    "distance_km": report['metrics']['distance_km']
                })

            # Step 2: Generate global comparison report
            comparison_report = self.comparer.generate_comparison_report(comparison_inputs)

            # Step 3: Package final results
            # Each report now includes the global comparison context
            final_packages = []
            for report in individual_reports:
                # Remove internal metrics to keep API payload lean
                # Use .get() and .pop() safely
                if "metrics" in report:
                    report.pop("metrics")
                
                final_packages.append({
                    **report,
                    "comparison": comparison_report
                })

            logger.info("Comparative batch report generated.")
            return final_packages

        except Exception as e:
            logger.error(f"Comparative XAI Service Error: {str(e)}")
            raise

# --- Unit Tests ---
class TestExplainabilityService(unittest.TestCase):
    def setUp(self):
        self.service = ExplainabilityService()

    def test_comparative_batch(self):
        # Simulated two-hospital batch
        batch = [
            {
                "ml_output": {"suitability_score": 90, "feature_impact": {"instrument_match_ratio": 100}},
                "cost_outcome": {"out_of_pocket": 50000, "recovery_burden_index": 20, "shock_probability": 0.05},
                "hospital": {"hospital_name": "Premium Heart", "hospital_rating": 4.8, "distance_km": 5},
                "patient": {}, "doctor_available": True, "instrument_validation": {"instrument_match_ratio": 1.0}
            },
            {
                "ml_output": {"suitability_score": 70, "feature_impact": {"budget_range": 80}},
                "cost_outcome": {"out_of_pocket": 10000, "recovery_burden_index": 10, "shock_probability": 0.01},
                "hospital": {"hospital_name": "Economy Life", "hospital_rating": 3.5, "distance_km": 15},
                "patient": {}, "doctor_available": True, "instrument_validation": {"instrument_match_ratio": 0.5}
            }
        ]
        
        results = self.service.generate_comparative_report(batch)
        
        self.assertEqual(len(results), 2)
        self.assertIn("comparison", results[0])
        self.assertEqual(results[0]["comparison"]["lowest_cost"], "Economy Life")
        self.assertEqual(results[0]["comparison"]["best_overall"], "Premium Heart")

if __name__ == "__main__":
    unittest.main()
