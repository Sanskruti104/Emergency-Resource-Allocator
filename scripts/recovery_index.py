import unittest

def calculate_rbi(out_of_pocket_cost, base_treatment_cost, recovery_days, ml_risk_score):
    """
    Calculates the Recovery Burden Index (RBI) for MedDecision.
    
    RBI combines financial stress and physical recovery time to measure the 
    overall impact of an episode on a patient's life.
    
    Formula:
    RBI = [
       (OOP / Base * 0.4) + 
       (RecoveryDays / 30 * 0.6) + 
       (MLRisk * 0.2)
    ] * 100
    
    :param out_of_pocket_cost: Actual cost paid by the patient.
    :param base_treatment_cost: Standard benchmark cost for the procedure.
    :param recovery_days: Predicted duration of recovery in days.
    :param ml_risk_score: Normalized financial risk from ML engine (0.0 to 1.0).
    :return: float - RBI score normalized 0 to 100.
    """
    
    # 1. Input Sanitization & Edge Cases
    if base_treatment_cost <= 0:
        # Avoid division by zero. If cost is 0, we treat financial burden as 0.
        financial_ratio = 0.0
    else:
        financial_ratio = out_of_pocket_cost / base_treatment_cost
        
    # Recovery days can't be negative
    recovery_days = max(0, recovery_days)
    # ML Risk score bounded 0-1
    ml_risk_score = max(0.0, min(1.0, ml_risk_score))

    # 2. Components
    fin_component = financial_ratio * 0.4
    rec_component = (recovery_days / 30.0) * 0.6
    ml_component = ml_risk_score * 0.2
    
    # 3. Aggregation
    rbi = (fin_component + rec_component + ml_component) * 100
    
    # 4. Normalization (Safety Cap at 100)
    return round(max(0.0, min(100.0, rbi)), 2)

# --- Unit Tests ---
class TestRecoveryIndexEngine(unittest.TestCase):
    
    def test_standard_case(self):
        # OOP 2L, Base 5L (0.4 ratio), 10 days, 0.5 ML Risk
        # (0.4 * 0.4) + (10/30 * 0.6) + (0.5 * 0.2)
        # 0.16 + 0.2 + 0.1 = 0.46 * 100 = 46.0
        res = calculate_rbi(200000, 500000, 10, 0.5)
        self.assertEqual(res, 46.0)

    def test_low_burden_case(self):
        # 0 OOP, 3 days, 0.1 ML Risk
        # (0) + (3/30 * 0.6) + (0.1 * 0.2)
        # 0 + 0.06 + 0.02 = 0.08 * 100 = 8.0
        res = calculate_rbi(0, 400000, 3, 0.1)
        self.assertEqual(res, 8.0)

    def test_extreme_high_burden(self):
        # Extremely expensive + Long recovery
        # 2M OOP, 500k Base, 60 days, 1.0 ML Risk
        # (4.0 * 0.4) + (2.0 * 0.6) + (0.2)
        # 1.6 + 1.2 + 0.2 = 3.0 * 100 = 300 (should be capped at 100)
        res = calculate_rbi(2000000, 500000, 60, 1.0)
        self.assertEqual(res, 100.0)

    def test_zero_base_cost(self):
        # Edge case: base cost 0
        res = calculate_rbi(100, 0, 5, 0.5)
        # (0) + (5/30 * 0.6) + (0.1) = 0.1 + 0.1 = 0.2 * 100 = 20
        self.assertEqual(res, 20.0)

if __name__ == "__main__":
    # Run Tests
    print("Running Recovery Burden Index Tests...")
    suite = unittest.TestLoader().loadTestsFromTestCase(TestRecoveryIndexEngine)
    unittest.TextTestRunner(verbosity=1).run(suite)
    
    # Demo Scenarios
    print("\n--- RBI Demo Scenarios ---")
    scenarios = [
        {"desc": "Planned Knee Support", "oop": 50000, "base": 200000, "days": 15, "ml": 0.2},
        {"desc": "Emergency Cardiac", "oop": 450000, "base": 300000, "days": 10, "ml": 0.8},
        {"desc": "Long-term Rehab", "oop": 100000, "base": 100000, "days": 45, "ml": 0.5}
    ]
    
    for s in scenarios:
        val = calculate_rbi(s["oop"], s["base"], s["days"], s["ml"])
        print(f"Outcome: {s['desc']:<20} | Score: {val:>5} (Burden Index)")
