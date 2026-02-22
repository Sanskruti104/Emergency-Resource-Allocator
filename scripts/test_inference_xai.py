import requests
import json

def test_inference_xai():
    url = "http://127.0.0.1:8000/predict"
    
    payload = {
        "budget_range": 500000.0,
        "insurance_type": 2,
        "urgency_level": 3,
        "icu_required": False,
        "travel_flexibility": 0.8,
        "specialty_match_score": 0.9,
        "capacity_level": 0.4,
        "icu_available": 5,
        "insurance_acceptance_rate": 0.95,
        "negotiated_rate_diff": -0.1,
        "claim_reliability": 0.9,
        "avg_recovery_days": 7.0,
        "govt_scheme_support": True,
        "instrument_match_ratio": 0.9,
        "budget_compatibility_ratio": 0.85,
        "urgency_capacity_alignment": 0.6,
        "cost_deviation_ratio": -0.05,
        "reliability_index": 0.92,
        "distance_km": 10.5,
        "out_of_pocket": 120000.0
    }

    print("Testing ML Inference with SHAP Feature Impact...")
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print("SUCCESS:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"FAILED: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_inference_xai()
