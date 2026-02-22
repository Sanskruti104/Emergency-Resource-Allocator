import unittest

class TradeoffAnalyzer:
    """
    Tradeoff Analysis Engine for MedDecision.
    Evaluates the 'give-and-take' between quality, cost, and convenience 
    to help patients make informed compromises.
    """

    def __init__(self):
        # Configuration Thresholds
        self.QUALITY_HIGH = 85.0
        self.RATING_HIGH = 4.2
        self.COST_HIGH = 250000.0
        self.DISTANCE_FAR = 30.0
        self.RBI_HIGH = 60.0

    def analyze(self, data):
        """
        Analyzes the data to identify specific healthcare tradeoffs.
        """
        suitability = data.get("ml_suitability_score", 0)
        rating = data.get("hospital_rating", 0)
        oop = data.get("out_of_pocket_cost", 0)
        dist = data.get("distance_km", 0)
        rbi = data.get("recovery_burden_index", 0)

        is_high_quality = suitability >= self.QUALITY_HIGH or rating >= self.RATING_HIGH
        is_high_cost = oop >= self.COST_HIGH
        is_far = dist >= self.DISTANCE_FAR
        is_high_burden = rbi >= self.RBI_HIGH

        tradeoffs = []

        # 1. Quality vs Cost
        if is_high_quality and is_high_cost:
            tradeoffs.append({
                "type": "QUALITY_VS_COST",
                "label": "Premium Care / High Investment",
                "description": "This facility offers top-tier clinical alignment but comes with a significant out-of-pocket financial commitment."
            })
        elif not is_high_quality and not is_high_cost:
            tradeoffs.append({
                "type": "ECONOMY_MATCH",
                "label": "Economical / Standard Care",
                "description": "A budget-friendly option suitable for routine procedures without premium amenities."
            })

        # 2. Quality vs Distance
        if is_high_quality and is_far:
            tradeoffs.append({
                "type": "QUALITY_VS_DISTANCE",
                "label": "Clinical Excellence / Remote",
                "description": "Exceptional medical match found, but requires traveling a long distance from your location."
            })

        # 3. Cost vs Distance
        if not is_high_cost and is_far:
            tradeoffs.append({
                "type": "SAVINGS_VS_DISTANCE",
                "label": "Higher Savings / Travel Required",
                "description": "Significant cost savings available at this facility, though it is located outside your immediate local area."
            })

        # 4. Result vs Recovery
        if is_high_quality and is_high_burden:
            tradeoffs.append({
                "type": "QUALITY_VS_RECOVERY",
                "label": "Superior Results / Intensive Recovery",
                "description": "High likelihood of surgical success, but be prepared for a demanding post-operative recovery period."
            })

        # Summary Generation
        summary = self._generate_summary(tradeoffs, is_high_quality, is_high_cost)

        return {
            "tradeoffs": tradeoffs,
            "tradeoff_summary": summary,
            "indicators": {
                "high_quality": is_high_quality,
                "high_cost": is_high_cost,
                "remote": is_far,
                "intensive_recovery": is_high_burden
            }
        }

    def _generate_summary(self, tradeoffs, high_q, high_c):
        if not tradeoffs:
            return "A balanced recommendation with no significant tradeoffs identified."
        
        main = tradeoffs[0]["label"]
        if high_q and high_c:
            return f"This is a {main} scenario: You gain elite medical expertise but must manage a higher out-of-pocket expense."
        if high_q and not high_c:
            return "This is a Rare Value match: High clinical quality detected without the typical premium cost."
        if not high_q and not high_c:
            return "This selection focuses on affordability and standard care pathways."
        
        return f"Key considerations include {tradeoffs[0]['description'].split('.')[0]}."

# --- Unit Tests ---
class TestTradeoffAnalyzer(unittest.TestCase):
    def setUp(self):
        self.analyzer = TradeoffAnalyzer()

    def test_premium_tradeoff(self):
        data = {
            "ml_suitability_score": 90,
            "hospital_rating": 4.5,
            "out_of_pocket_cost": 300000,
            "distance_km": 5,
            "recovery_burden_index": 40
        }
        res = self.analyzer.analyze(data)
        self.assertTrue(any(t["type"] == "QUALITY_VS_COST" for t in res["tradeoffs"]))
        self.assertIn("Premium Care", res["tradeoff_summary"])

    def test_value_travel_tradeoff(self):
        data = {
            "ml_suitability_score": 70,
            "hospital_rating": 3.8,
            "out_of_pocket_cost": 50000,
            "distance_km": 45,
            "recovery_burden_index": 30
        }
        res = self.analyzer.analyze(data)
        self.assertTrue(any(t["type"] == "SAVINGS_VS_DISTANCE" for t in res["tradeoffs"]))

if __name__ == "__main__":
    import json
    suite = unittest.TestLoader().loadTestsFromTestCase(TestTradeoffAnalyzer)
    unittest.TextTestRunner(verbosity=2).run(suite)
    
    # Demo
    print("\n--- Tradeoff Analyzer Demo ---")
    analyzer = TradeoffAnalyzer()
    
    # Simulation: High quality hospital very far away
    case = {
        "ml_suitability_score": 95,
        "out_of_pocket_cost": 150000, # Mid-range
        "distance_km": 60,
        "recovery_burden_index": 70 # Heavy burden
    }
    
    results = analyzer.analyze(case)
    print(f"Summary: {results['tradeoff_summary']}\n")
    print("Identified Tradeoffs:")
    for t in results["tradeoffs"]:
        print(f"  [{t['label']}]: {t['description']}")
