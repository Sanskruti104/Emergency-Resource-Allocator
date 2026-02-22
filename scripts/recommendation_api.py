from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import json
import os
import sys
import uvicorn
import pandas as pd
import numpy as np
import pickle

# Ensure scripts directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import internal service modules
try:
    from cost_outcome_service import CostOutcomeService
    from explainability_service import ExplainabilityService
    from symptom_classifier import detect_specialty
except ImportError as e:
    print(f"Integration Error: {e}")
    raise

# Define Logger
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("UnifiedRecommendationAPI")

app = FastAPI(
    title="MedDecision Unified Recommendation Engine",
    description="E2E Pipeline: ML Suitability -> Cost-Outcome -> XAI Explainability",
    version="2.0.0"
)

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development, allow all. In production, specify origins.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- MODELS & SERVICES CACHING ---
SERVICES = {}

@app.on_event("startup")
def startup_event():
    logger.info("Initializing ML Models and Processing Pipelines...")
    try:
        # Load ML Artifacts (Cached from inference_service logic)
        with open("feature_pipeline.pkl", "rb") as f:
            SERVICES["pipeline"] = pickle.load(f)
        with open("suitability_model.pkl", "rb") as f:
            SERVICES["suitability_model"] = pickle.load(f)
        with open("risk_model.pkl", "rb") as f:
            SERVICES["risk_model"] = pickle.load(f)
        
        # Initialize Orchestrators
        SERVICES["cost_outcome"] = CostOutcomeService()
        SERVICES["explainability"] = ExplainabilityService()
        
        logger.info("All engines initialized successfully.")
    except Exception as e:
        logger.error(f"Startup Failure: {e}")
        raise RuntimeError("Could not load ML/Service artifacts.")

# --- API SCHEMAS ---
class RecommendationRequest(BaseModel):
    patient: dict 
    hospital: dict
    treatment: dict
    symptom_text: str = ""  # Optional field for auto-detection

class BatchRecommendationRequest(BaseModel):
    patient: dict
    hospitals: list # List of hospital dictionaries
    treatment: dict
    symptom_text: str = ""  # Optional field for auto-detection

class SymptomAnalysisRequest(BaseModel):
    symptom_text: str

# --- CORE PIPELINE LOGIC ---
@app.post("/analyze-symptoms")
async def analyze_symptoms(request: SymptomAnalysisRequest):
    """
    Dedicated endpoint for frontend auto-detection.
    """
    try:
        detection = detect_specialty(request.symptom_text)
        return detection
    except Exception as e:
        logger.error(f"Symptom Analysis Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate")
async def generate_recommendation_report(request: RecommendationRequest):
    """
    Unified Endpoint for generating a complete hospital suitability report.
    (Legacy/Single for backwards compatibility)
    """
    try:
        data = request.dict()
        h_data = data['hospital']
        p_data = data['patient']
        t_data = data['treatment']

        # Reuse batch logic with single hospital
        results, detection = process_recommendations(p_data, [h_data], t_data, request.symptom_text)
        
        response = results[0]
        response["detected_specialty"] = detection.get("detected_specialty")
        response["confidence"] = detection.get("confidence")
        return response

    except Exception as e:
        logger.error(f"Recommendation Generation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-batch")
async def generate_batch_recommendations(request: BatchRecommendationRequest):
    """
    Processes multiple hospital candidates and returns individual XAI reports 
    plus a global comparison matrix.
    """
    try:
        data = request.dict()
        results, detection = process_recommendations(data['patient'], data['hospitals'], data['treatment'], request.symptom_text)
        
        return {
            "detected_specialty": detection.get("detected_specialty"),
            "confidence": detection.get("confidence"),
            "recommendations": results
        }
    except Exception as e:
        logger.error(f"Batch Recommendation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def process_recommendations(p_data, h_list, t_data, symptom_text=None):
    try:
        candidate_inputs = []
        
        # --- NEW: SYMPTOM-TO-SPECIALTY FILTERING LAYER ---
        user_query = symptom_text or p_data.get('symptoms') or t_data.get('query') or ""
        detection = detect_specialty(user_query)
        detected_specialty = detection.get("detected_specialty")
        
        if detected_specialty:
            logger.info(f"Context Layer: Detected Specialty '{detected_specialty}' (Conf: {detection['confidence']})")
            # Filter hospitals that support this specialty
            # Expecting hospital['specialties'] to be a list or comma-separated string
            filtered_hospitals = []
            for h in h_list:
                h_specs = h.get('specialties', [])
                if isinstance(h_specs, str):
                    h_specs = [s.strip() for s in h_specs.split(',')]
                
                if detected_specialty in h_specs:
                    filtered_hospitals.append(h)
            
            # If filtering results in empty set, fallback to original list to avoid breaking pipeline
            if filtered_hospitals:
                logger.info(f"Filtering: {len(h_list)} -> {len(filtered_hospitals)} hospitals matching {detected_specialty}")
                h_list = filtered_hospitals
            else:
                logger.warning(f"No hospitals match detected specialty '{detected_specialty}'. Falling back to full list.")
        
        for h_data in h_list:
            # 1. PHASE 1: ML INFERENCE
            ml_features = {
                "budget_range": float(p_data.get('budget', 500000)),
                "insurance_type": int(p_data.get('insurance_type_code', 2)),
                "urgency_level": int(p_data.get('urgency_level', 3)),
                "icu_required": int(t_data.get('is_icu', 0)),
                "travel_flexibility": float(p_data.get('travel_flexibility', 0.8)),
                "specialty_match_score": float(h_data.get('specialty_match', 0.9)),
                "capacity_level": float(h_data.get('occupancy', 0.5)),
                "icu_available": int(h_data.get('icu_beds', 5)),
                "insurance_acceptance_rate": 0.9,
                "negotiated_rate_diff": h_data.get('pricing_index', 0.0),
                "claim_reliability": 0.95,
                "avg_recovery_days": float(t_data.get('recovery_days', 7)),
                "govt_scheme_support": int(h_data.get('govt_support', 0)),
                "instrument_match_ratio": float(h_data.get('instrument_ratio', 1.0)),
                "budget_compatibility_ratio": 0.8,
                "urgency_capacity_alignment": 0.5,
                "cost_deviation_ratio": 0.0,
                "reliability_index": 0.9
            }
            
            df_ml = pd.DataFrame([ml_features])
            X_trans = SERVICES["pipeline"].transform(df_ml)
            ml_suitability = float(SERVICES["suitability_model"].predict(X_trans)[0])
            ml_risk_class = str(SERVICES["risk_model"].predict(X_trans)[0])
            ml_risk_prob = float(np.max(SERVICES["risk_model"].predict_proba(X_trans)))

            # Mock feature impact since real SHAP might be slow in this loop
            # In production, this would call the SHAP explainer
            feature_impact = {
                "instrument_match_ratio": round(float(h_data.get('instrument_ratio', 1.0) * 40), 1),
                "budget_range": round(float(p_data.get('budget', 500000) / 1000000 * 20), 1),
                "distance_km": round(float(-h_data.get('distance_km', 10) * 2), 1)
            }

            ml_output = {
                "suitability_score": round(float(ml_suitability), 2),
                "risk_class": ml_risk_class,
                "risk_score": round(float(ml_risk_prob), 4),
                "feature_impact": feature_impact
            }

            # 2. PHASE 2: COST-OUTCOME ANALYSIS
            cost_outcome = SERVICES["cost_outcome"].process_patient_hospital_match({
                "patient": {
                    "budget": p_data.get('budget', 500000),
                    "insurance_type": p_data.get('insurance_tier', "Private - Tier 2"),
                    "govt_eligible": p_data.get('govt_eligible', False)
                },
                "hospital": {
                    "pricing_index": h_data.get('pricing_index', 0.0),
                    "govt_support": h_data.get('govt_support', False)
                },
                "treatment": {
                    "base_cost": t_data.get('base_cost', 400000),
                    "is_icu": t_data.get('is_icu', False),
                    "intensity": t_data.get('intensity', 3),
                    "recovery_days": t_data.get('recovery_days', 7)
                },
                "ml_outputs": ml_output
            })

            candidate_inputs.append({
                "ml_output": ml_output,
                "cost_outcome": cost_outcome,
                "hospital": {**h_data, "hospital_rating": h_data.get('rating', 4.0)},
                "patient": p_data,
                "doctor_available": h_data.get('doctor_available', True),
                "instrument_validation": {"instrument_match_ratio": h_data.get('instrument_ratio', 1.0)}
            })

        # 3. PHASE 3: BATCH EXPLAINABILITY
        final_reports = SERVICES["explainability"].generate_comparative_report(candidate_inputs)
        
        # Enrich reports with ML/Cost assessments for backward compatibility/detail
        for i, report in enumerate(final_reports):
            report["ml_assessment"] = candidate_inputs[i]["ml_output"]
            report["financial_adjudication"] = candidate_inputs[i]["cost_outcome"]
            # Ensure top level fields requested by the user are present
            report["feature_impact"] = candidate_inputs[i]["ml_output"]["feature_impact"]
            report["suitability_score"] = candidate_inputs[i]["ml_output"]["suitability_score"]
            # summary is already in report from explainability_service
            
        return final_reports, detection

    except Exception as e:
        logger.error(f"Recommendation Generation Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
