import requests
import json

def test_full_pipeline():
    url = "http://localhost:8001/generate"
    
    payload = {
        "patient": {
            "budget": 600000,
            "insurance_tier": "Private - Tier 2",
            "govt_eligible": False
        },
        "hospital": {
            "id": "h_101",
            "name": "City Heart Center",
            "pricing_index": 0.05,
            "govt_support": True,
            "rating": 4.5,
            "occupancy": 0.3,
            "icu_beds": 10,
            "instrument_ratio": 1.0,
            "distance_km": 8.0
        },
        "treatment": {
            "name": "Valve Replacement",
            "base_cost": 400000,
            "is_icu": True,
            "intensity": 4,
            "recovery_days": 8
        }
    }

    print("Sending End-to-End Recommendation Request...")
    try:
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            print("PIPELINE SUCCESS:")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"FAILED: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    test_full_pipeline()
