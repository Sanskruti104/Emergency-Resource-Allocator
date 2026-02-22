import unittest
import json

class ComparisonEngine:
    """
    Comparison Engine for MedDecision.
    Analyzes multiple hospital candidates to identify 'Best-in-Category' choices
    based on clinical, financial, and explainability metrics.
    """

    def generate_comparison_report(self, recommendations):
        """
        Processes a list of recommendations to generate a comparison matrix and highlights.
        
        :param recommendations: List of dicts matching the required input schema.
        :return: dict - Structured comparison report.
        """
        if not recommendations:
            return {
                "ranking": [],
                "best_overall": None,
                "lowest_cost": None,
                "lowest_risk": None,
                "best_equipment_match": None,
                "shortest_distance": None,
                "comparison_matrix": []
            }

        # 1. Rank by suitability_score descending
        ranked_list = sorted(recommendations, key=lambda x: x.get('suitability_score', 0), reverse=True)
        
        # 2. Extract Category Leaders
        # Lowest Cost
        lowest_cost_hosp = min(recommendations, key=lambda x: x.get('out_of_pocket', float('inf')))
        
        # Lowest Financial Risk (based on shock probability then RBI)
        lowest_risk_hosp = min(recommendations, key=lambda x: (x.get('shock_probability', 1.0), x.get('recovery_burden_index', 100)))
        
        # Best Equipment Match (Based on SHAP impact of instrument_match_ratio)
        # We look for the entry with the highest positive 'instrument_match_ratio' in feature_impact
        def get_equip_impact(rec):
            impacts = rec.get('feature_impact', {})
            return impacts.get('instrument_match_ratio', -100)
            
        best_equip_hosp = max(recommendations, key=get_equip_impact)
        
        # Shortest Distance
        shortest_dist_hosp = min(recommendations, key=lambda x: x.get('distance_km', float('inf')))

        # 3. Create Comparison Matrix (Simplified view for UI table)
        matrix = []
        for rec in ranked_list:
            matrix.append({
                "hospital_name": rec.get("hospital_name"),
                "suitability": rec.get("suitability_score"),
                "out_of_pocket": rec.get("out_of_pocket"),
                "distance": rec.get("distance_km"),
                "recovery_index": rec.get("recovery_burden_index"),
                "top_driver": max(rec.get("feature_impact", {}).items(), key=lambda x: x[1])[0] if rec.get("feature_impact") else "N/A"
            })

        return {
            "ranking": [r['hospital_name'] for r in ranked_list],
            "best_overall": ranked_list[0]['hospital_name'],
            "lowest_cost": lowest_cost_hosp['hospital_name'],
            "lowest_risk": lowest_risk_hosp['hospital_name'],
            "best_equipment_match": best_equip_hosp['hospital_name'],
            "shortest_distance": shortest_dist_hosp['hospital_name'],
            "comparison_matrix": matrix
        }

# --- Unit Tests ---
class TestComparisonEngine(unittest.TestCase):
    def setUp(self):
        self.engine = ComparisonEngine()
        self.sample_data = [
            {
                "hospital_name": "General Medical Center",
                "suitability_score": 85.5,
                "out_of_pocket": 150000,
                "shock_probability": 0.1,
                "recovery_burden_index": 30,
                "distance_km": 12.0,
                "feature_impact": {"instrument_match_ratio": 40.0, "icu_available": 80.0}
            },
            {
                "hospital_name": "Premium Specialty Hospital",
                "suitability_score": 92.0,
                "out_of_pocket": 500000,
                "shock_probability": 0.25,
                "recovery_burden_index": 55,
                "distance_km": 4.5,
                "feature_impact": {"instrument_match_ratio": 100.0, "budget_range": -20.0}
            },
            {
                "hospital_name": "Community Clinic",
                "suitability_score": 65.0,
                "out_of_pocket": 45000,
                "shock_probability": 0.05,
                "recovery_burden_index": 15,
                "distance_km": 25.0,
                "feature_impact": {"instrument_match_ratio": 10.0, "budget_range": 90.0}
            }
        ]

    def test_ranking(self):
        report = self.engine.generate_comparison_report(self.sample_data)
        self.assertEqual(report["ranking"][0], "Premium Specialty Hospital")
        self.assertEqual(report["ranking"][-1], "Community Clinic")

    def test_category_leaders(self):
        report = self.engine.generate_comparison_report(self.sample_data)
        self.assertEqual(report["lowest_cost"], "Community Clinic")
        self.assertEqual(report["shortest_distance"], "Premium Specialty Hospital")
        self.assertEqual(report["best_equipment_match"], "Premium Specialty Hospital")
        self.assertEqual(report["lowest_risk"], "Community Clinic")

if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestComparisonEngine)
    unittest.TextTestRunner(verbosity=2).run(suite)
    
    # Demo
    engine = ComparisonEngine()
    dummy_data = [
        {
            "hospital_name": "City Heart",
            "suitability_score": 88,
            "out_of_pocket": 120000,
            "shock_probability": 0.0,
            "recovery_burden_index": 42,
            "distance_km": 8,
            "feature_impact": {"instrument_match_ratio": 95, "icu_available": 20}
        },
        {
            "hospital_name": "Rural Life Care",
            "suitability_score": 76,
            "out_of_pocket": 40000,
            "shock_probability": 0.05,
            "recovery_burden_index": 22,
            "distance_km": 45,
            "feature_impact": {"instrument_match_ratio": 30, "budget_range": 85}
        }
    ]
    report = engine.generate_comparison_report(dummy_data)
    print("\n--- Comparison Report Demo ---")
    print(json.dumps(report, indent=2))
