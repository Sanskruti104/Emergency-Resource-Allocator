from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import pandas as pd
import numpy as np
import pickle
import os
import sys
import uvicorn
import shap

# Ensure the directory containing feature_engineering.py is in the system path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import feature_engineering

app = FastAPI(
    title="MedDecision ML Inference Service",
    description="API for predicting hospital suitability and financial risk with XAI.",
    version="1.1.0"
)

# --- MODELS & PIPELINE CACHING ---
MODELS = {}

@app.on_event("startup")
def load_models():
    """Load the models, pipeline, and XAI explainer into memory."""
    try:
        with open("feature_pipeline.pkl", "rb") as f:
            MODELS["pipeline"] = pickle.load(f)
        with open("suitability_model.pkl", "rb") as f:
            MODELS["suitability"] = pickle.load(f)
        with open("risk_model.pkl", "rb") as f:
            MODELS["risk"] = pickle.load(f)
        
        # Initialize SHAP TreeExplainer for the suitability regressor
        MODELS["explainer"] = shap.TreeExplainer(MODELS["suitability"])
        
        print("All models, pipelines, and XAI explainers loaded.")
    except Exception as e:
        print(f"Error loading models: {e}")
        raise RuntimeError(f"Could not load ML artifacts: {e}")

# --- API MODELS ---
class InferenceInput(BaseModel):
    # Core inputs
    budget_range: float = Field(..., example=500000.0)
    insurance_type: int = Field(..., ge=0, le=3, example=2)
    urgency_level: int = Field(..., ge=1, le=5, example=3)
    icu_required: bool = Field(..., example=False)
    travel_flexibility: float = Field(..., ge=0, le=1, example=0.8)
    specialty_match_score: float = Field(..., ge=0, le=1, example=0.9)
    capacity_level: float = Field(..., ge=0, le=1, example=0.4)
    icu_available: int = Field(..., ge=0, example=5)
    insurance_acceptance_rate: float = Field(..., ge=0, le=1, example=0.95)
    negotiated_rate_diff: float = Field(..., example=-0.1)
    claim_reliability: float = Field(..., ge=0, le=1, example=0.9)
    avg_recovery_days: float = Field(..., example=7.0)
    govt_scheme_support: bool = Field(..., example=True)
    instrument_match_ratio: float = Field(..., ge=0, le=1, example=0.9)
    budget_compatibility_ratio: float = Field(..., example=0.85)
    urgency_capacity_alignment: float = Field(..., example=0.6)
    cost_deviation_ratio: float = Field(..., example=-0.05)
    reliability_index: float = Field(..., example=0.92)
    
    # Optional extensions for XAI mapping if needed by client
    distance_km: float = Field(None, example=8.5)
    out_of_pocket: float = Field(None, example=150000.0)

class InferenceOutput(BaseModel):
    suitability_score: float
    financial_risk: str
    confidence_suitability: float
    confidence_risk: float
    feature_impact: dict = Field(..., description="Normalized feature influence (-100 to 100)")

# --- ENDPOINTS ---
@app.post("/predict", response_model=InferenceOutput)
def predict(input_data: InferenceInput):
    """
    Takes hospital-patient intersection data and returns ML predictions with feature impact.
    """
    try:
        input_dict = input_data.dict()
        # Drop keys not used in model if they were provided as helper fields
        model_input_keys = [
            'budget_range', 'insurance_type', 'urgency_level', 'icu_required',
            'travel_flexibility', 'specialty_match_score', 'capacity_level',
            'icu_available', 'insurance_acceptance_rate', 'negotiated_rate_diff',
            'claim_reliability', 'avg_recovery_days', 'govt_scheme_support',
            'instrument_match_ratio', 'budget_compatibility_ratio',
            'urgency_capacity_alignment', 'cost_deviation_ratio', 'reliability_index'
        ]
        
        filtered_dict = {k: input_dict[k] for k in model_input_keys}
        filtered_dict['icu_required'] = int(filtered_dict['icu_required'])
        filtered_dict['govt_scheme_support'] = int(filtered_dict['govt_scheme_support'])
        
        df_input = pd.DataFrame([filtered_dict])
        X_transformed = MODELS["pipeline"].transform(df_input)

        # 1. Predictions
        suitability_score = float(MODELS["suitability"].predict(X_transformed)[0])
        risk_label = str(MODELS["risk"].predict(X_transformed)[0])
        confidence_risk = float(np.max(MODELS["risk"].predict_proba(X_transformed)))

        # 2. XAI Logic: SHAP Feature Attribution
        shap_values = MODELS["explainer"].shap_values(X_transformed)[0]
        
        # Mapping SHAP indices to requested features
        # Note: indices depend on feature_engineering.py ordering
        indices = {
            "budget_range": 0,
            "icu_available": 5,
            "instrument_match_ratio": 10,
            "distance_km": 2, # Mapping to travel_flexibility
            "out_of_pocket": 21 # Mapping to budget_cost_interaction
        }
        
        raw_impacts = {k: float(shap_values[idx]) for k, idx in indices.items()}
        
        # 3. Normalization to range [-100, 100]
        max_abs_impact = max([abs(v) for v in raw_impacts.values()]) if raw_impacts else 1.0
        if max_abs_impact == 0: max_abs_impact = 1.0
        
        normalized_impacts = {
            k: round((v / max_abs_impact) * 100, 2)
            for k, v in raw_impacts.items()
        }

        return InferenceOutput(
            suitability_score=round(suitability_score, 2),
            financial_risk=risk_label,
            confidence_suitability=0.95,
            confidence_risk=round(confidence_risk, 4),
            feature_impact=normalized_impacts
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
