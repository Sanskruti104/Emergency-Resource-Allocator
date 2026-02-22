import math
import unittest

class FinancialRiskEngine:
    """
    Financial Risk Engine for MedDecision.
    Calculates the probability of financial shock and provides risk labeling
    using a hybrid mathematical and ML approach.
    """

    def __init__(self, k=0.0001):
        self.k = k  # Scaling factor for sigmoid sensitivity

    def calculate_shock_probability(self, out_of_pocket_cost, base_treatment_cost, ml_risk_class):
        """
        Calculates the probability of financial shock using a sigmoid function
        adjusted by ML risk classifications.
        
        :param out_of_pocket_cost: The actual cost the patient pays.
        :param base_treatment_cost: The benchmark cost for the procedure.
        :param ml_risk_class: Risk class from the ML engine ('Low', 'Medium', 'High').
        :return: float - Adjusted shock probability (0.0 to 1.0).
        """
        # 1. Input Validation
        if out_of_pocket_cost < 0 or base_treatment_cost <= 0:
            raise ValueError("Costs must be positive and base cost cannot be zero.")
        
        valid_ml_classes = ['low', 'medium', 'high']
        ml_class_normalized = ml_risk_class.lower()
        if ml_class_normalized not in valid_ml_classes:
            raise ValueError(f"Invalid ML risk class. Must be one of: {valid_ml_classes}")

        # 2. Formula Parameters
        theta = 1.25 * base_treatment_cost  # Panic Threshold

        # 3. Core Sigmoid Calculation
        # C_oop = out_of_pocket_cost
        raw_prob = 1 / (1 + math.exp(-self.k * (out_of_pocket_cost - theta)))

        # 4. ML Adjustment Factors
        adjustment_map = {
            'low': 0.90,    # -10% risk reduction for positive ML indicators
            'medium': 1.00, # No change
            'high': 1.15    # +15% risk increase for negative ML indicators
        }
        
        multiplier = adjustment_map[ml_class_normalized]
        adjusted_prob = raw_prob * multiplier

        # 5. Boundary Clipping
        return min(max(adjusted_prob, 0.0), 1.0)

    def get_risk_label(self, shock_prob):
        """
        Maps a probability to a semantic risk label.
        
        :param shock_prob: Float (0.0 to 1.0).
        :return: str - Risk Label.
        """
        if shock_prob < 0.30:
            return "Low"
        elif shock_prob < 0.60:
            return "Medium"
        elif shock_prob < 0.85:
            return "High"
        else:
            return "Critical"

    def analyze_risk(self, out_of_pocket_cost, base_treatment_cost, ml_risk_class):
        """
        Higher-level utility to run full analysis and return structured result.
        """
        prob = self.calculate_shock_probability(out_of_pocket_cost, base_treatment_cost, ml_risk_class)
        label = self.get_risk_label(prob)
        
        return {
            "shock_probability": round(prob, 4),
            "risk_label": label,
            "panic_threshold": 1.25 * base_treatment_cost
        }

# --- Unit Tests ---
class TestFinancialRiskEngine(unittest.TestCase):
    def setUp(self):
        self.engine = FinancialRiskEngine()

    def test_ideal_case(self):
        # OOP is way below Panic Threshold
        res = self.engine.analyze_risk(50000, 200000, "Low")
        self.assertEqual(res["risk_label"], "Low")
        self.assertLess(res["shock_probability"], 0.3)

    def test_critical_case(self):
        # OOP is significantly above Panic Threshold (1.25 * 100k = 125k)
        # 500k is 375k above threshold. Sigmoid will be near 1.0.
        res = self.engine.analyze_risk(500000, 100000, "High")
        self.assertEqual(res["risk_label"], "Critical")
        self.assertEqual(res["shock_probability"], 1.0) # Clipped at 1.0

    def test_invalid_inputs(self):
        with self.assertRaises(ValueError):
            self.engine.calculate_shock_probability(-100, 100, "Low")
        with self.assertRaises(ValueError):
            self.engine.calculate_shock_probability(100, 100, "InvalidClass")

if __name__ == "__main__":
    # 1. Run Tests
    print("Running Unit Tests...")
    suite = unittest.TestLoader().loadTestsFromTestCase(TestFinancialRiskEngine)
    unittest.TextTestRunner(verbosity=1).run(suite)
    
    # 2. Sample Demo
    print("\n--- Financial Risk Engine Demo ---")
    engine = FinancialRiskEngine()
    
    scenarios = [
        (120000, 100000, "Low"),    # Near threshold, ML Low
        (130000, 100000, "Medium"), # Slightly over threshold, ML Med
        (150000, 100000, "High")    # Over threshold, ML High
    ]
    
    for oop, base, ml in scenarios:
        res = engine.analyze_risk(oop, base, ml)
        print(f"OOP: {oop} | Base: {base} | ML: {ml} => Prob: {res['shock_probability']} [{res['risk_label']}]")
