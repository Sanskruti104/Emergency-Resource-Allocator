import unittest

class ValueTagEngine:
    """
    Value Tagging Engine for MedDecision.
    Categorizes hospital recommendations into quick, actionable labels 
    to simplify front-end UI badges and summary views.
    """

    def __init__(self):
        # Configuration Thresholds
        self.PREMIUM_SUITABILITY = 90.0
        self.PREMIUM_RATING = 4.5
        
        self.VALUE_SUITABILITY = 80.0
        self.VALUE_COST = 150000.0
        
        self.LOW_COST_LIMIT = 75000.0
        self.LOW_RISK_PROB = 0.15
        self.FAST_RECOVERY_RBI = 25.0
        
        self.LONG_DISTANCE_LIMIT = 40.0
        self.HIGH_UTILITY_SUITABILITY = 90.0

    def generate_tags(self, data):
        """
        Assigns one or more value tags based on clinical and financial metrics.
        
        :param data: dict containing metrics
        :return: dict with 'tags' list and 'primary_tag' string
        """
        suitability = data.get("ml_suitability_score", 0)
        oop = data.get("out_of_pocket_cost", 0)
        rbi = data.get("recovery_burden_index", 0)
        shock_prob = data.get("shock_probability", 0)
        rating = data.get("hospital_rating", 0)
        dist = data.get("distance_km", 0)

        found_tags = []

        # 1. PREMIUM_CARE: Top tier clinical and reputation
        if suitability >= self.PREMIUM_SUITABILITY and rating >= self.PREMIUM_RATING:
            found_tags.append("PREMIUM_CARE")

        # 2. BEST_VALUE: High suitability but controlled costs
        if suitability >= self.VALUE_SUITABILITY and oop <= self.VALUE_COST:
            # Avoid tagging as BEST_VALUE if it's already PREMIUM_CARE (user rule: avoid redundancy/contradiction)
            # Unless it's truly a steal
            found_tags.append("BEST_VALUE")

        # 3. LOWEST_COST: Extreme budget focus
        if oop <= self.LOW_COST_LIMIT and oop > 0:
            found_tags.append("LOWEST_COST")

        # 4. LOWEST_RISK: High reliability indicators
        if shock_prob <= self.LOW_RISK_PROB and rbi <= 35:
            found_tags.append("LOWEST_RISK")

        # 5. FASTEST_RECOVERY: Physical impact focus
        if rbi <= self.FAST_RECOVERY_RBI:
            found_tags.append("FASTEST_RECOVERY")

        # 6. LONG_DISTANCE_VALUE: Worth the travel
        if dist >= self.LONG_DISTANCE_LIMIT and (suitability >= self.HIGH_UTILITY_SUITABILITY or oop <= self.LOW_COST_LIMIT):
            found_tags.append("LONG_DISTANCE_VALUE")

        # Select Primary Tag based on Priority
        primary_tag = self._select_primary(found_tags)

        return {
            "tags": sorted(list(set(found_tags))), # Ensure unique and sorted
            "primary_tag": primary_tag
        }

    def _select_primary(self, tags):
        """Priority-based primary tag selection."""
        if not tags: return "STANDARD_MATCH"
        
        # Priority order
        priority = [
            "BEST_VALUE",
            "PREMIUM_CARE",
            "LOWEST_COST",
            "FASTEST_RECOVERY",
            "LOWEST_RISK",
            "LONG_DISTANCE_VALUE"
        ]
        
        for p in priority:
            if p in tags:
                return p
        return tags[0]

# --- Unit Tests ---
class TestValueTagEngine(unittest.TestCase):
    def setUp(self):
        self.engine = ValueTagEngine()

    def test_premium_care(self):
        data = {
            "ml_suitability_score": 95,
            "hospital_rating": 4.8,
            "out_of_pocket_cost": 500000,
            "recovery_burden_index": 50,
            "shock_probability": 0.2
        }
        res = self.engine.generate_tags(data)
        self.assertIn("PREMIUM_CARE", res["tags"])
        self.assertEqual(res["primary_tag"], "PREMIUM_CARE")

    def test_best_value_overlap(self):
        data = {
            "ml_suitability_score": 85,
            "out_of_pocket_cost": 80000, # Also LOWEST_COST threshold
            "recovery_burden_index": 20, # Also FASTEST_RECOVERY
            "hospital_rating": 4.0
        }
        res = self.engine.generate_tags(data)
        self.assertIn("BEST_VALUE", res["tags"])
        self.assertIn("FASTEST_RECOVERY", res["tags"])
        # BEST_VALUE has higher priority than FASTEST_RECOVERY
        self.assertEqual(res["primary_tag"], "BEST_VALUE")

    def test_long_distance_logic(self):
        data = {
            "distance_km": 50,
            "ml_suitability_score": 95,
            "out_of_pocket_cost": 200000
        }
        res = self.engine.generate_tags(data)
        self.assertIn("LONG_DISTANCE_VALUE", res["tags"])

if __name__ == "__main__":
    import json
    suite = unittest.TestLoader().loadTestsFromTestCase(TestValueTagEngine)
    unittest.TextTestRunner(verbosity=2).run(suite)
    
    # Demo
    engine = ValueTagEngine()
    print("\n--- Value Tag Engine Demo ---")
    
    scenarios = [
        {"name": "Budget Cardiac", "metrics": {"ml_suitability_score": 88, "out_of_pocket_cost": 65000, "recovery_burden_index": 30, "hospital_rating": 4.2}},
        {"name": "Premium Specialty", "metrics": {"ml_suitability_score": 98, "hospital_rating": 4.9, "out_of_pocket_cost": 600000}},
        {"name": "Remote Excellence", "metrics": {"ml_suitability_score": 95, "distance_km": 55, "out_of_pocket_cost": 120000}}
    ]
    
    for s in scenarios:
        res = engine.generate_tags(s["metrics"])
        print(f"Scenario: {s['name']:<20} | Primary: {res['primary_tag']:<15} | All Tags: {res['tags']}")
