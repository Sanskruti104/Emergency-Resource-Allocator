import math
import pandas as pd

def calculate_total_cost_current(base_cost, pricing_index, icu_required, instrument_intensity, recovery_days):
    icu_multiplier = 1.45 if icu_required else 1.0
    instrument_multiplier = 1 + (0.08 * instrument_intensity)
    recovery_compounding = math.exp(0.02 * recovery_days)
    
    gross_cost = (
        base_cost * 
        (1 + pricing_index) * 
        icu_multiplier * 
        instrument_multiplier
    ) * recovery_compounding
    
    return gross_cost

def calculate_total_cost_proposed(base_cost, pricing_index, icu_required, instrument_intensity, recovery_days):
    """
    Proposed Stable Model.
    Uses Additive intensity factors and Linear recovery scaling.
    """
    # 1. Start with base and hospital adjustment
    core_cost = base_cost * (1 + pricing_index)
    
    # 2. Clinical Multiplier (Additive components to prevent stacking)
    # ICU adds 25% to complexity, Instrument adds 5% per level
    clinical_markup = (0.25 if icu_required else 0.0) + (0.05 * instrument_intensity)
    
    # 3. Recovery Scaling (Linear 1.5% per day)
    # Assumes base_cost includes first 2 days
    extra_days = max(0, recovery_days - 2)
    recovery_markup = 0.015 * extra_days
    
    # 4. Calculation
    # C_total = C_core * (1 + M_clinical) * (1 + M_recovery)
    gross_cost = core_cost * (1 + clinical_markup) * (1 + recovery_markup)
    
    # 5. Safety Cap (Cannot exceed 3.0x base cost)
    cap = base_cost * 3.0
    return round(min(gross_cost, cap), 2)

def simulate_comparison():
    scenarios = [
        (100000, 0.0, False, 1, 3, "Minor/Low"),
        (300000, 0.1, False, 2, 5, "Routine/Medium"),
        (500000, 0.2, True, 4, 10, "Advanced/Large"),
        (800000, 0.3, True, 5, 30, "Extreme/Max")
    ]
    
    results = []
    for bc, pi, icu, inst, rec, label in scenarios:
        current = calculate_total_cost_current(bc, pi, icu, inst, rec)
        proposed = calculate_total_cost_proposed(bc, pi, icu, inst, rec)
        
        results.append({
            "Scenario": label,
            "Base": bc,
            "Current": round(current, 2),
            "Proposed": round(proposed, 2),
            "Diff %": round(((proposed - current) / current) * 100, 1),
            "Mult (Prop)": round(proposed / bc, 2)
        })
    
    return pd.DataFrame(results)

if __name__ == "__main__":
    df = simulate_comparison()
    print(df.to_string())
