import pickle
import pandas as pd
import numpy as np
import feature_engineering

with open("feature_pipeline.pkl", "rb") as f:
    pipeline = pickle.load(f)

# Get feature names
num_features = [
    'budget_range', 'urgency_level', 'travel_flexibility', 
    'specialty_match_score', 'capacity_level', 'icu_available', 
    'insurance_acceptance_rate', 'negotiated_rate_diff', 
    'claim_reliability', 'avg_recovery_days', 'instrument_match_ratio',
    'budget_compatibility_ratio', 'urgency_capacity_alignment', 
    'cost_deviation_ratio', 'reliability_index',
    'icu_required', 'govt_scheme_support'
]

cat_features = ['insurance_type']
interaction_features = ['budget_cost_interaction', 'urgency_capacity_interaction', 'insurance_utility_interaction']

# Replicate the logic in feature_engineering.py
cat_onehot = pipeline.named_steps['preprocessor'].named_transformers_['cat'].named_steps['onehot']
cat_names = list(cat_onehot.get_feature_names_out(cat_features))

all_feature_names = num_features + cat_names + interaction_features
print("All Feature Names in Order:")
print(all_feature_names)
print(f"Total features: {len(all_feature_names)}")
