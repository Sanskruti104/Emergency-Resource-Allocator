import unittest

class SummaryBuilder:
    """
    Final Aggregator for MedDecision XAI.
    Synthesizes clinical, financial, and tradeoff analytics into 
    human-readable executive summaries for patient decision support.
    """

    def build_summary(self, data):
        """
        Combines outputs from individual analytics engines into a final UX summary.
        
        Input Schema:
        {
            "reasons": dict (from reason_generator),
            "tradeoffs": dict (from tradeoff_analyzer),
            "value_tags": dict (from value_tag_engine),
            "cost_outcome_result": dict (from cost_outcome_service),
            "ml_suitability_score": float
        }
        """
        reasons_data = data.get("reasons", {})
        tradeoff_data = data.get("tradeoffs", {})
        tags_data = data.get("value_tags", {})
        cost_data = data.get("cost_outcome_result", {})
        
        primary_tag = tags_data.get("primary_tag", "STANDARD_MATCH")
        tag_labels = tags_data.get("tags", [])
        
        # 1. Executive Summary Generation
        # Logic: Combine primary tag value proposition with tradeoff context
        exec_summary = self._generate_exec_summary(
            primary_tag, 
            tradeoff_data.get("tradeoff_summary", ""),
            data.get("ml_suitability_score", 0)
        )

        # 2. Key Highlights (Positive focus)
        # Combine top reasons and relevant value tags
        highlights = reasons_data.get("top_reasons", [])
        if "LOWEST_RISK" in tag_labels:
            highlights.append("Clinically and financially predictable outcome")

        # 3. Caution Notes (Risk/Tradeoff focus)
        # Combine risk warnings and tradeoff descriptions
        cautions = reasons_data.get("risk_warnings", [])
        for t in tradeoff_data.get("tradeoffs", []):
            if "DISTANCE" in t["type"] or "COST" in t["type"] or "RECOVERY" in t["type"]:
                # Filter to only warn about significant 'give-takes'
                if t["type"] != "ECONOMY_MATCH":
                    cautions.append(t["description"].split('.')[0] + ".")

        return {
            "executive_summary": exec_summary,
            "highlights": highlights[:4], # Capped for UI space
            "cautions": sorted(list(set(cautions))) # Unique and sorted
        }

    def _generate_exec_summary(self, primary_tag, tradeoff_summary, score):
        """Narrative template logic based on primary classification."""
        
        templates = {
            "PREMIUM_CARE": "This facility represents our highest level of clinical match. It is recommended for patients seeking the most advanced care pathways and top-tier medical expertise.",
            "BEST_VALUE": "This option offers a superior balance of medical quality and financial efficiency. It represents a 'smart choice' for patients balancing high clinical standards with budget awareness.",
            "LOWEST_COST": f"Focused on maximum affordability, this selection ensures base medical standards ({score:.0f}% match) are met within a minimal out-of-pocket framework.",
            "STANDARD_MATCH": f"A reliable clinical match for your procedure. This selection provides consistent medical quality adhering to established recovery protocols.",
            "LONG_DISTANCE_VALUE": "Despite the travel distance, this hospital offers clinical or financial advantages that significantly outperform closer alternatives."
        }
        
        base_desc = templates.get(primary_tag, templates["STANDARD_MATCH"])
        
        # Append tradeoff context if available
        if tradeoff_summary:
            return f"{base_desc} {tradeoff_summary}"
        return base_desc

# --- Unit Tests ---
class TestSummaryBuilder(unittest.TestCase):
    def setUp(self):
        self.builder = SummaryBuilder()

    def test_ideal_premium_summary(self):
        test_input = {
            "reasons": {"top_reasons": ["Expert clinical alignment", "Full equipment"], "risk_warnings": []},
            "tradeoffs": {"tradeoff_summary": "elite expertise with a manageable investment."},
            "value_tags": {"primary_tag": "PREMIUM_CARE", "tags": ["PREMIUM_CARE", "LOWEST_RISK"]},
            "ml_suitability_score": 95,
            "cost_outcome_result": {"out_of_pocket": 400000}
        }
        res = self.builder.build_summary(test_input)
        self.assertIn("highest level of clinical match", res["executive_summary"])
        self.assertIn("Clinically and financially predictable outcome", res["highlights"])
        self.assertEqual(len(res["cautions"]), 0)

    def test_risk_summary(self):
        test_input = {
            "reasons": {"top_reasons": ["Budget match"], "risk_warnings": ["High risk of financial shock"]},
            "tradeoffs": {
                "tradeoff_summary": "Economical but far.", 
                "tradeoffs": [{"type": "SAVINGS_VS_DISTANCE", "description": "Needs long travel."}]
            },
            "value_tags": {"primary_tag": "LOWEST_COST", "tags": ["LOWEST_COST"]},
            "ml_suitability_score": 75,
            "cost_outcome_result": {"out_of_pocket": 20000}
        }
        res = self.builder.build_summary(test_input)
        self.assertTrue(any("High risk of financial shock" in c for c in res["cautions"]))
        self.assertTrue(any("Needs long travel" in c for c in res["cautions"]))

if __name__ == "__main__":
    import json
    suite = unittest.TestLoader().loadTestsFromTestCase(TestSummaryBuilder)
    unittest.TextTestRunner(verbosity=2).run(suite)
    
    # Demo
    builder = SummaryBuilder()
    print("\n--- Summary Builder UX Demo ---")
    
    sample_final_input = {
        "reasons": {
            "top_reasons": ["Expert clinical alignment (92%)", "Confirmed specialist availability", "Economical cost"],
            "risk_warnings": []
        },
        "tradeoffs": {
            "tradeoff_summary": "Rare clinical excellence at an affordable price point.",
            "tradeoffs": [{"type": "QUALITY_VS_DISTANCE", "description": "Exceptional match but requires 45km travel."}]
        },
        "value_tags": {
            "primary_tag": "BEST_VALUE",
            "tags": ["BEST_VALUE", "LOWEST_RISK"]
        },
        "ml_suitability_score": 92,
        "cost_outcome_result": {"out_of_pocket": 85000}
    }
    
    final_output = builder.build_summary(sample_final_input)
    print(f"EXECUTIVE SUMMARY:\n{final_output['executive_summary']}\n")
    print("KEY HIGHLIGHTS:")
    for h in final_output['highlights']: print(f"  * {h}")
    print("\nCAUTIONS:")
    for c in final_output['cautions']: print(f"  ! {c}")
