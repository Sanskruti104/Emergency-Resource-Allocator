import math
import numpy as np
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

def simulate():
    scenarios = [
        # Base Cost, PI, ICU, Intensity, Recovery
        (100000, 0.0, False, 1, 3, "Minor/Low"),
        (300000, 0.1, False, 2, 5, "Routine/Medium"),
        (500000, 0.2, True, 4, 10, "Advanced/Large"),
        (800000, 0.3, True, 5, 30, "Extreme/Max")
    ]
    
    results = []
    for bc, pi, icu, inst, rec, label in scenarios:
        cost = calculate_total_cost_current(bc, pi, icu, inst, rec)
        multiplier = cost / bc
        results.append({
            "Scenario": label,
            "Base": bc,
            "Multipliers": f"PI:{pi}, ICU:{icu}, Inst:{inst}, Rec:{rec}",
            "Final Cost": round(cost, 2),
            "Total Multiplier": round(multiplier, 2)
        })
    
    return pd.DataFrame(results)

if __name__ == "__main__":
    df = simulate()
    print(df.to_string())
