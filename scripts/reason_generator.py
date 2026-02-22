import unittest

class ReasonGenerator:
    """
    Explainable AI (XAI) engine for MedDecision.
    Translates complex ML outputs and clinical metrics into human-readable reasons.
    """

    def generate_reasons(self, data):
        """
        Main entry point to generate positive and negative explanations.
        
        Input Schema:
        {
            "ml_suitability_score": float (0-100),
            "instrument_match_ratio": float (0-1),
            "hospital_rating": float (0-5),
            "cost_outcome_result": dict (from cost_outcome_service),
            "distance_km": float,
            "doctor_availability": bool or float
        }
        """
        positives = []
        warnings = []
        
        # --- 1. Clinical Suitability Analysis ---
        suitability = data.get("ml_suitability_score", 0)
        if suitability >= 85:
            positives.append(f"Expert clinical alignment ({suitability:.0f}% match)")
        elif suitability <= 30:
            warnings.append("Low suitability score for this specific clinical path")

        # --- 2. Equipment & Instrument Analysis ---
        instr_ratio = data.get("instrument_match_ratio", 0)
        if instr_ratio == 1.0:
            positives.append("Full specialized equipment and instrument availability")
        elif instr_ratio >= 0.8:
            positives.append("Highly equipped facility for your treatment")
        elif instr_ratio < 0.6:
            warnings.append(f"Equipment Gap: Only {instr_ratio*100:.0f}% of required instruments found")

        # --- 3. Financial & Cost Analysis ---
        cost_res = data.get("cost_outcome_result", {})
        oop = cost_res.get("out_of_pocket", 0)
        prob = cost_res.get("shock_probability", 0)
        rbi = cost_res.get("recovery_burden_index", 0)

        if oop <= 100000 and oop > 0:
            positives.append(f"Economical out-of-pocket cost (₹{oop:,.0f})")
        
        if prob >= 0.7:
            warnings.append(f"High risk of financial shock ({prob*100:.0f}% probability)")
        
        if rbi >= 80:
            warnings.append(f"High recovery burden predicted (Index: {rbi})")

        # --- 4. Proximity & Logistic Analysis ---
        dist = data.get("distance_km", 999)
        if dist <= 5:
            positives.append(f"Optimal proximity ({dist:.1f} km away)")
        elif dist >= 40:
            warnings.append(f"Extended travel distance ({dist:.1f} km)")

        # --- 5. Reputation & Staffing ---
        rating = data.get("hospital_rating", 0)
        if rating >= 4.5:
            positives.append(f"Top-rated medical institution ({rating} stars)")
        
        if data.get("doctor_availability") is True:
            positives.append("Confirmed immediate specialist availability")

        # --- Aggregation Strategy ---
        # Sort and pick top 3 for UI clarity
        return {
            "top_reasons": positives[:3],
            "risk_warnings": warnings,
            "summary": "Highly Recommended" if len(positives) >= 3 and not warnings else "Conditional Match"
        }

# --- Unit Tests ---
class TestReasonGenerator(unittest.TestCase):
    def setUp(self):
        self.generator = ReasonGenerator()

    def test_optimal_match(self):
        data = {
            "ml_suitability_score": 92.5,
            "instrument_match_ratio": 1.0,
            "hospital_rating": 4.8,
            "cost_outcome_result": {"out_of_pocket": 50000, "shock_probability": 0.05},
            "distance_km": 3.2,
            "doctor_availability": True
        }
        res = self.generator.generate_reasons(data)
        self.assertEqual(len(res["top_reasons"]), 3)
        self.assertIn("Expert clinical alignment", res["top_reasons"][0])
        self.assertEqual(len(res["risk_warnings"]), 0)

    def test_warning_logic(self):
        data = {
            "ml_suitability_score": 45,
            "instrument_match_ratio": 0.4,
            "hospital_rating": 3.0,
            "cost_outcome_result": {"out_of_pocket": 600000, "shock_probability": 0.85, "recovery_burden_index": 82},
            "distance_km": 50,
            "doctor_availability": False
        }
        res = self.generator.generate_reasons(data)
        self.assertGreaterEqual(len(res["risk_warnings"]), 3)
        self.assertTrue(any("Equipment Gap" in w for w in res["risk_warnings"]))
        self.assertTrue(any("financial shock" in w for w in res["risk_warnings"]))

if __name__ == "__main__":
    # Run Tests
    suite = unittest.TestLoader().loadTestsFromTestCase(TestReasonGenerator)
    unittest.TextTestRunner(verbosity=2).run(suite)
    
    # Demo
    print("\n--- Reason Generator Demo ---")
    gen = ReasonGenerator()
    sample = {
        "ml_suitability_score": 88,
        "instrument_match_ratio": 1.0,
        "hospital_rating": 4.6,
        "cost_outcome_result": {"out_of_pocket": 85000, "shock_probability": 0.1, "recovery_burden_index": 35},
        "distance_km": 4.5,
        "doctor_availability": True
    }
    output = gen.generate_reasons(sample)
    print("Recommendation Reasons:")
    for r in output["top_reasons"]: print(f"  + {r}")
    if output["risk_warnings"]:
        print("Warnings:")
        for w in output["risk_warnings"]: print(f"  ! {w}")
