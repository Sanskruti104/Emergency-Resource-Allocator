import math

def calculate_total_cost(base_cost, pricing_index, icu_required, instrument_intensity, recovery_days):
    """
    Calculates the gross estimated total cost using the MedDecision Stable Model (v2.1).
    
    Formula: [C_base * (1 + H_pi) * (1 + (0.25 * R_icu) + (0.05 * L_inst))] * (1 + 0.015 * D_extra)
    
    Prevents exponential stacking while maintaining clinical sensitivity.
    
    :param base_cost: Internal benchmark cost for the treatment.
    :param pricing_index: Hospital-specific markup/discount (-0.3 to 0.3).
    :param icu_required: Boolean (True/False) if ICU care is mandatory.
    :param instrument_intensity: Level of specialized equipment needed (1-5).
    :param recovery_days: Predicted stay duration in days.
    :return: float - Gross estimated total cost capped at 3x base.
    """
    # 1. Institutional Core (Hospital Markup)
    core_base = base_cost * (1 + pricing_index)
    
    # 2. Clinical Complexity Multiplier (Additive to prevent stacking)
    # ICU adds 25% intensity; Instruments add 5% per level
    clinical_markup = (0.25 if icu_required else 0.0) + (0.05 * instrument_intensity)
    
    # 3. Recovery Scaling (Linear 1.5% per day, assuming first 2 days in base)
    extra_days = max(0, recovery_days - 2)
    recovery_markup = 0.015 * extra_days
    
    # 4. Composite Calculation
    gross_cost = core_base * (1 + clinical_markup) * (1 + recovery_markup)
    
    # 5. Safety Floor/Cap: Cap at 3x base to prevent theoretical outliers
    max_cap = base_cost * 3.0
    final_output = min(gross_cost, max_cap)
    
    return round(final_output, 2)

def apply_govt_subsidy(gross_cost, has_govt_support):
    """
    Applies mandated government scheme caps if the hospital supports them.
    
    Formula: C_Total * (1 - 0.65 * G_sch)
    
    :param gross_cost: The calculated gross cost of treatment.
    :param has_govt_support: Boolean (True/False) if patient/hospital use govt schemes.
    :return: float - Net total cost after subsidy.
    """
    subsidy_multiplier = 0.35 if has_govt_support else 1.0
    net_cost = gross_cost * subsidy_multiplier
    return round(net_cost, 2)

def calculate_distribution(net_total, insurance_coverage, base_benchmark, recovery_days):
    """
    Calculates financial split, shock probability, and recovery burden index.
    
    :param net_total: The final cost to be paid (after subsidy).
    :param insurance_coverage: Coverage percentage as float (0.0 to 1.0).
    :param base_benchmark: The initial base cost used for relative stress indexing.
    :param recovery_days: Duration of recovery.
    :return: dict - Structured financial metrics.
    """
    # 1. Financial Distribution
    insurance_amount = round(net_total * insurance_coverage, 2)
    out_of_pocket = round(net_total - insurance_amount, 2)
    
    # 2. Financial Shock Probability (P_shock)
    # Using Logistic Sigmoid: 1 / (1 + e^-k(C_oop - theta))
    # theta (Panic Threshold) = 1.25 * base_benchmark
    k = 0.0001
    theta = 1.25 * base_benchmark
    p_shock = 1 / (1 + math.exp(-k * (out_of_pocket - theta)))
    
    # 3. Recovery Burden Index (RBI)
    # Formula: [(C_oop / C_base * 0.4) + (D_rec / 30 * 0.6)] * 100
    rbi = ((out_of_pocket / base_benchmark * 0.4) + (recovery_days / 30 * 0.6)) * 100
    
    return {
        "estimated_total_cost": net_total,
        "insurance_covered_amount": insurance_amount,
        "out_of_pocket_cost": out_of_pocket,
        "financial_shock_probability": round(p_shock, 4),
        "recovery_burden_index": round(min(rbi, 100), 2) # Capped at 100 for display
    }

def run_cost_analysis(inputs):
    """
    Unified entry point for a complete financial eligibility scan.
    """
    gross = calculate_total_cost(
        inputs['base_treatment_cost'],
        inputs['hospital_pricing_index'],
        inputs['icu_required'],
        inputs['instrument_intensity'],
        inputs['recovery_days']
    )
    
    net = apply_govt_subsidy(gross, inputs['govt_scheme_support'])
    
    results = calculate_distribution(
        net, 
        inputs['insurance_coverage_pct'], 
        inputs['base_treatment_cost'],
        inputs['recovery_days']
    )
    
    return results

if __name__ == "__main__":
    # Sample Simulation: Major Surgery Case
    sample_case = {
        "base_treatment_cost": 500000,   # 5 Lakhs
        "hospital_pricing_index": 0.15,  # Premium Hospital (+15%)
        "insurance_coverage_pct": 0.70,  # 70% Covered
        "icu_required": True,
        "instrument_intensity": 4,      # High intensity
        "govt_scheme_support": False,
        "recovery_days": 10
    }
    
    output = run_cost_analysis(sample_case)
    
    print("--- MedDecision Cost-Outcome Engine: Financial Analysis ---")
    import json
    print(json.dumps(output, indent=4))
