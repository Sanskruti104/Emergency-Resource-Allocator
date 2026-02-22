import pandas as pd
import numpy as np
import os

# Set seed for reproducibility
np.random.seed(42)

def generate_meddecision_data(n_rows=10000):
    print(f"Generating {n_rows} rows of synthetic healthcare data...")
    
    # --- 1. PATIENT FEATURES ---
    # budget_range: 50k to 2M INR
    budget_range = np.random.uniform(50000, 2000000, n_rows)
    # insurance_type: 0: None, 1: Govt, 2: Private, 3: Premium
    insurance_type = np.random.choice([0, 1, 2, 3], n_rows, p=[0.2, 0.3, 0.4, 0.1])
    # urgency_level: 1 (Elective) to 5 (Critical)
    urgency_level = np.random.randint(1, 6, n_rows)
    # icu_required: Higher urgency usually means higher ICU requirement
    icu_prob = (urgency_level / 5.0) * 0.8  # Max 80% prob for level 5
    icu_required = np.random.binomial(1, icu_prob)
    # travel_flexibility: 0 (Local only) to 1 (Willing to travel)
    travel_flexibility = np.random.uniform(0, 1, n_rows)

    # --- 2. HOSPITAL FEATURES ---
    specialty_match_score = np.random.uniform(0.4, 1.0, n_rows)
    capacity_level = np.random.uniform(0.1, 0.95, n_rows) # Bed occupancy
    icu_available = np.random.randint(0, 25, n_rows)
    insurance_acceptance_rate = np.random.uniform(0.3, 1.0, n_rows)
    negotiated_rate_diff = np.random.uniform(-0.3, 0.1, n_rows) # Difference from market avg
    claim_reliability = np.random.uniform(0.5, 1.0, n_rows)
    avg_recovery_days = np.random.normal(7, 3, n_rows).clip(3, 30)
    govt_scheme_support = np.random.binomial(1, 0.4, n_rows)
    instrument_match_ratio = np.random.uniform(0.6, 1.0, n_rows)

    # --- 3. DERIVED FEATURES ---
    # Assume a base treatment cost proxy
    treatment_base_cost = np.random.uniform(100000, 1500000, n_rows)
    # budget_compatibility_ratio = Total Estimated Cost / Patient Budget
    # If > 1, hospital is more expensive than patient budget
    budget_compatibility_ratio = treatment_base_cost / budget_range
    
    # urgency_capacity_alignment: Low capacity at hospital (high occupancy) is bad for high urgency
    urgency_capacity_alignment = (1 - capacity_level) * (urgency_level / 5.0)
    
    # cost_deviation_ratio: How much hospital deviates from normal cost
    cost_deviation_ratio = negotiated_rate_diff + np.random.normal(0, 0.05, n_rows)
    
    # reliability_index: Combined score of insurance and claims
    reliability_index = (insurance_acceptance_rate * 0.6) + (claim_reliability * 0.4)

    # Base dataframe
    df = pd.DataFrame({
        'budget_range': budget_range,
        'insurance_type': insurance_type,
        'urgency_level': urgency_level,
        'icu_required': icu_required,
        'travel_flexibility': travel_flexibility,
        'specialty_match_score': specialty_match_score,
        'capacity_level': capacity_level,
        'icu_available': icu_available,
        'insurance_acceptance_rate': insurance_acceptance_rate,
        'negotiated_rate_diff': negotiated_rate_diff,
        'claim_reliability': claim_reliability,
        'avg_recovery_days': avg_recovery_days,
        'govt_scheme_support': govt_scheme_support,
        'instrument_match_ratio': instrument_match_ratio,
        'budget_compatibility_ratio': budget_compatibility_ratio,
        'urgency_capacity_alignment': urgency_capacity_alignment,
        'cost_deviation_ratio': cost_deviation_ratio,
        'reliability_index': reliability_index
    })

    # --- 4. TARGET GENERATION (Suitability Score: 0-100) ---
    # Core logic: weights + penalties
    suitability = (
        (df['specialty_match_score'] * 30) +
        (df['instrument_match_ratio'] * 30) +
        ((1 - df['capacity_level']) * 20) +
        ((1 - df['budget_compatibility_ratio'].clip(0, 2) / 2) * 20)
    )

    # Apply Hard Gates & Realism Filters
    # ICU Missing Penalty
    icu_fail = (df['icu_required'] == 1) & (df['icu_available'] == 0)
    suitability[icu_fail] = suitability[icu_fail] * 0.2 # Drastic drop

    # Specialty mismatch penalty
    suitability[df['specialty_match_score'] < 0.5] -= 20

    # Noise (5-10%)
    noise = np.random.normal(0, 5, n_rows)
    suitability = (suitability + noise).clip(0, 100)

    df['suitability_score'] = suitability

    # --- 5. TARGET GENERATION (Financial Risk: Low/Medium/High) ---
    # High risk correlates with low budget (high comp ratio) and low reliability
    risk_prob_high = (
        (df['budget_compatibility_ratio'] > 1.2).astype(int) * 0.6 +
        (df['reliability_index'] < 0.6).astype(int) * 0.3 +
        (df['avg_recovery_days'] > 15).astype(int) * 0.1
    ).clip(0, 1)

    risk_prob_low = (
        (df['budget_compatibility_ratio'] < 0.8).astype(int) * 0.7 +
        (df['reliability_index'] > 0.8).astype(int) * 0.3
    ).clip(0, 1)

    # Assign labels based on dominant probability
    risk_labels = []
    for h, l in zip(risk_prob_high, risk_prob_low):
        # Add random randomness for noise requirement
        dice = np.random.random()
        if dice < 0.07: # 7% random noise/error in labeling
            risk_labels.append(np.random.choice(['Low', 'Medium', 'High']))
            continue
            
        if h > 0.5:
            risk_labels.append('High')
        elif l > 0.6:
            risk_labels.append('Low')
        else:
            risk_labels.append('Medium')
            
    df['financial_risk'] = risk_labels

    return df

if __name__ == "__main__":
    df = generate_meddecision_data()
    # Save as CSV
    output_path = "meddecision_ml_data.csv"
    df.to_csv(output_path, index=False)
    print(f"Dataset saved successfully to {os.path.abspath(output_path)}")
    print("\nSample Data:")
    print(df.head())
    print("\nCorrelations (Subset):")
    print(df[['suitability_score', 'budget_compatibility_ratio', 'icu_required']].corr()['suitability_score'])
