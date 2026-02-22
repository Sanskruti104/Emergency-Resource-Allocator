
import requests
import json

url = "http://localhost:3000/api/recommendation/generate"
payload = {
    "treatmentId": "cardiac",
    "patientOverride": {
        "budgetMax": 500000,
        "insuranceType": "Private - Tier 2",
        "latitude": 18.5204,
        "longitude": 73.8567,
        "travelFlexibility": 0.5,
        "urgency": "Urgent"
    }
}

try:
    response = requests.post(url, json=payload)
    print(f"Status: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
