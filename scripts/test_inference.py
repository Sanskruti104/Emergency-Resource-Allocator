import requests
import json

def test_ml_service():
    url = "http://127.0.0.1:8000/predict"
    
    # High suitability, Low risk case
    test_input = {
        "budget_range": 1000000.0,
        "insurance_type": 2,
        "urgency_level": 3,
        "icu_required": False,
        "travel_flexibility": 0.8,
        "specialty_match_score": 0.95,
        "capacity_level": 0.2, # Low occupancy
        "icu_available": 10,
        "insurance_acceptance_rate": 0.98,
        "negotiated_rate_diff": -0.15, # Cheaper than avg
        "claim_reliability": 0.95,
        "avg_recovery_days": 5.0,
        "govt_scheme_support": True,
        "instrument_match_ratio": 0.98,
        "budget_compatibility_ratio": 0.6, # Well within budget
        "urgency_capacity_alignment": 0.3,
        "cost_deviation_ratio": -0.12,
        "reliability_index": 0.97
    }

    print(f"Sending test request to {url}...")
    try:
        response = requests.post(url, json=test_input)
        if response.status_code == 200:
            print("Successfully received prediction:")
            print(json.dumps(response.json(), indent=4))
        else:
            print(f"Error: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Could not connect to service. Make sure uvicorn is running. Error: {e}")

if __name__ == "__main__":
    test_ml_service()
