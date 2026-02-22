import random

class InsuranceEngine:
    """
    Electronic Insurance Adjudication System for MedDecision.
    Handles coverage caps, deductibles, and clinical rejection logic.
    """
    
    # Configurable limits per insurance tier
    POLICY_CONFIG = {
        "None": {"cap": 0, "base_rejection": 1.0, "deductible_default": 0},
        "Govt - PMJAY": {"cap": 500000, "base_rejection": 0.05, "deductible_default": 0},
        "Private - Tier 2": {"cap": 1000000, "base_rejection": 0.15, "deductible_default": 25000},
        "Private - Premium": {"cap": 5000000, "base_rejection": 0.05, "deductible_default": 5000}
    }

    @staticmethod
    def adjudicate_claim(total_cost, insurance_type, coverage_rate=None, deductible=None, govt_scheme_flag=False):
        """
        Calculates the insurance payout and actual patient liability.
        
        :param total_cost: The net cost from cost_calculator.
        :param insurance_type: Key from POLICY_CONFIG (None, Govt, Private - Tier 2, etc.)
        :param coverage_rate: Override for the policy coverage percentage (0.0 - 1.0)
        :param deductible: Override for the patient's deductible.
        :param govt_scheme_flag: If True, forces PMJAY logic (0 out-of-pocket for eligible costs).
        :return: dict - Adjudication results
        """
        
        # 1. Initialization and Tier Lookup
        cfg = InsuranceEngine.POLICY_CONFIG.get(insurance_type, InsuranceEngine.POLICY_CONFIG["None"])
        
        # Handle Govt Scheme Override
        if govt_scheme_flag:
            return {
                "approved_amount": total_cost,
                "rejected_amount": 0.0,
                "final_out_of_pocket": 0.0,
                "adjudication_status": "FULL_GOVT_COVERAGE",
                "rejection_reason": None
            }

        if insurance_type == "None":
            return {
                "approved_amount": 0.0,
                "rejected_amount": 0.0,
                "final_out_of_pocket": total_cost,
                "adjudication_status": "NO_INSURANCE",
                "rejection_reason": "No policy detected"
            }

        # Select Rate Defaults if not provided
        eff_coverage = coverage_rate if coverage_rate is not None else 0.8
        eff_deductible = deductible if deductible is not None else cfg["deductible_default"]
        annual_cap = cfg["cap"]

        # 2. Rejection Logic (Simulating clinical audit)
        rejection_prob = cfg["base_rejection"]
        # Partial rejection: Factor of the total cost that might be excluded (consumables, etc.)
        rejection_factor = random.uniform(0, rejection_prob) if random.random() < 0.3 else 0
        
        # 3. Calculation Sequence
        # A. Exclude non-medical/rejected items first
        claimable_basis = total_cost * (1 - rejection_factor)
        rejected_clinical = total_cost - claimable_basis
        
        # B. Apply Deductible
        after_deductible = max(0, claimable_basis - eff_deductible)
        patient_deductible_share = min(claimable_basis, eff_deductible)
        
        # C. Apply Coverage Percentage
        tentative_approved = after_deductible * eff_coverage
        patient_copay_share = after_deductible - tentative_approved
        
        # D. Apply Annual Cap
        approved_amount = min(tentative_approved, annual_cap)
        cap_overflow = max(0, tentative_approved - annual_cap)
        
        # 4. Final Aggregation
        final_oop = patient_deductible_share + patient_copay_share + rejected_clinical + cap_overflow
        
        status = "PARTIAL_APPROVAL" if approved_amount > 0 else "DENIED"
        if approved_amount == tentative_approved: status = "FULL_APPROVAL"
        
        return {
            "approved_amount": round(approved_amount, 2),
            "rejected_amount": round(rejected_clinical, 2),
            "final_out_of_pocket": round(final_oop, 2),
            "adjudication_status": status,
            "rejection_reason": f"Audit excluded {int(rejection_factor*100)}% of items" if rejection_factor > 0 else None
        }

def integrate_with_calculator(calc_output, insurance_details):
    """
    Bridge function to connect cost_calculator output to insurance adjudication.
    """
    total_cost = calc_output["estimated_total_cost"]
    
    return InsuranceEngine.adjudicate_claim(
        total_cost=total_cost,
        insurance_type=insurance_details.get("type", "None"),
        coverage_rate=insurance_details.get("rate"),
        deductible=insurance_details.get("deductible"),
        govt_scheme_flag=insurance_details.get("govt_flag", False)
    )

if __name__ == "__main__":
    # Test Integration
    from cost_calculator import run_cost_analysis
    
    # 1. Step: Calculator
    sample_inputs = {
        "base_treatment_cost": 400000,
        "hospital_pricing_index": 0.1,
        "insurance_coverage_pct": 1.0, # Not used in internal logic now, handled by engine
        "icu_required": True,
        "instrument_intensity": 3,
        "govt_scheme_support": False,
        "recovery_days": 7
    }
    
    calc_res = run_cost_analysis(sample_inputs)
    print(f"Calculator Output: Total Cost = {calc_res['estimated_total_cost']}\n")
    
    # 2. Step: Insurance Adjudication
    insurance_info = {
        "type": "Private - Tier 2",
        "rate": 0.85,
        "deductible": 20000
    }
    
    adj_res = integrate_with_calculator(calc_res, insurance_info)
    
    print("--- MedDecision Insurance Adjudication Result ---")
    import json
    print(json.dumps(adj_res, indent=4))
