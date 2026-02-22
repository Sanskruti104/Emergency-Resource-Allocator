import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder, FunctionTransformer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
import os

def create_interaction_features(X):
    """
    Creates specific healthcare-ML interaction features:
    - Budget Efficiency Index (budget * cost deviation)
    - Urgency-Capacity Strain (urgency * capacity)
    - Insurance Acceptance Power (insurance_type_val * acceptance_rate)
    """
    X_ext = X.copy()
    
    # Interaction: budget_range * cost_deviation_ratio
    # Measures the financial impact of cost deviations relative to patient budget
    X_ext['budget_cost_interaction'] = X_ext['budget_range'] * X_ext['cost_deviation_ratio']
    
    # Interaction: urgency_level * capacity_level
    # Measures the stress on hospital resources relative to clinical urgency
    X_ext['urgency_capacity_interaction'] = X_ext['urgency_level'] * X_ext['capacity_level']
    
    # Interaction: insurance_type * insurance_acceptance_rate
    # Measures the actual utility of a patient's insurance type at a specific facility
    X_ext['insurance_utility_interaction'] = X_ext['insurance_type'].astype(float) * X_ext['insurance_acceptance_rate']
    
    return X_ext

def build_feature_engineering_pipeline(data_path):
    if not os.path.exists(data_path):
        print(f"Error: {data_path} not found. Please run generate_ml_data.py first.")
        return None, None

    # 1. Load Data
    df = pd.read_csv(data_path)
    print(f"Loaded {len(df)} rows from {data_path}")

    # 2. Separation of Features and Targets
    # Note: We have two targets (Regression and Classification)
    X = df.drop(columns=['suitability_score', 'financial_risk'])
    y_reg = df['suitability_score']
    y_clf = df['financial_risk']

    # 3. Define Feature Groups
    # Categorical: insurance_type (it's stored as numeric 0-3 but it's an enum)
    # Boolean/Flag: icu_required, govt_scheme_support
    # Continuous: Everything else
    categorical_features = ['insurance_type']
    numeric_features = [
        'budget_range', 'urgency_level', 'travel_flexibility', 
        'specialty_match_score', 'capacity_level', 'icu_available', 
        'insurance_acceptance_rate', 'negotiated_rate_diff', 
        'claim_reliability', 'avg_recovery_days', 'instrument_match_ratio',
        'budget_compatibility_ratio', 'urgency_capacity_alignment', 
        'cost_deviation_ratio', 'reliability_index',
        'icu_required', 'govt_scheme_support'
    ]

    # 4. Pipeline Construction
    
    # Custom Interaction Transformer
    interaction_transformer = FunctionTransformer(create_interaction_features)

    # Numeric Transformer (Impute + Scale)
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    # Categorical Transformer (OneHotEncode)
    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value=0)),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])

    # 5. Column Transformer Preprocessor
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_features),
            ('cat', categorical_transformer, categorical_features)
        ],
        remainder='passthrough'
    )

    # 6. Final Feature Engineering Pipeline
    # First create interactions, then preprocess (scale/encode)
    full_pipeline = Pipeline(steps=[
        ('interactions', interaction_transformer),
        ('preprocessor', preprocessor)
    ])

    # 7. Execute Transformation
    X_transformed = full_pipeline.fit_transform(X)
    
    # Get feature names for transparency
    feature_names = numeric_features + list(full_pipeline.named_steps['preprocessor'].named_transformers_['cat'].named_steps['onehot'].get_feature_names_out(['insurance_type']))
    # Add interaction features manually as they are appended by the FunctionTransformer
    feature_names = feature_names + ['budget_cost_interaction', 'urgency_capacity_interaction', 'insurance_utility_interaction']

    print(f"Transformation complete. Input shape: {X.shape} -> Transformed shape: {X_transformed.shape}")
    
    return X_transformed, y_reg, y_clf, full_pipeline

if __name__ == "__main__":
    csv_file = "meddecision_ml_data.csv"
    X_processed, y_suitability, y_risk, pipeline = build_feature_engineering_pipeline(csv_file)
    
    if X_processed is not None:
        # Split for suitability (Regression)
        X_train_res, X_test_res, y_train_res, y_test_res = train_test_split(
            X_processed, y_suitability, test_size=0.2, random_state=42
        )
        
        # Split for risk (Classification)
        X_train_clf, X_test_clf, y_train_clf, y_test_clf = train_test_split(
            X_processed, y_risk, test_size=0.2, random_state=42, stratify=y_risk
        )
        
        print("\nDataset Splits:")
        print(f"Regression (Suitability) Training: {X_train_res.shape}")
        print(f"Classification (Financial Risk) Training: {X_train_clf.shape}")
        
        # Display sample of engineered features
        print("\nSample Transformed Row (First 5 columns):")
        print(X_processed[0, :5])
        
        print("\nFeature Engineering Stage Complete.")
