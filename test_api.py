
import requests
import json

url = "http://localhost:8001/generate-batch"
payload = {
    "patient": {
        "budget": 500000,
        "insurance_tier": "Private - Tier 2",
        "govt_eligible": False
    },
    "hospitals": [
        {
            "id": "test_h",
            "name": "Test Hospital",
            "pricing_index": 0.1,
            "govt_support": False,
            "rating": 4.5,
            "occupancy": 0.4,
            "icu_beds": 8,
            "instrument_ratio": 0.95,
            "distance_km": 5.0
        }
    ],
    "treatment": {
        "name": "Premium Cardiac Surgery",
        "base_cost": 450000,
        "is_icu": True,
        "intensity": 4,
        "recovery_days": 10
    }
}

try:
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
