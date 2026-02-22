import os
import logging
from transformers import pipeline

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SymptomClassifier")

# ---------------------------------------------------------
# CONFIGURATION - ALIGNED WITH FRONTEND & DICTIONARY
# ---------------------------------------------------------

MODEL_NAME = "facebook/bart-large-mnli"
CONFIDENCE_THRESHOLD = 0.5

# Aligned with condition_dictionary.json categories
CATEGORIES = [
    "Cardiac",
    "Orthopedic",
    "Neuro",
    "General Surgery",
    "Oncology",
    "Maternity",
    "Pediatrics"
]

# Map common technical terms to dictionary labels
KEYWORD_MAP = {
    "knee": "Orthopedic",
    "joint": "Orthopedic",
    "fracture": "Orthopedic",
    "bone": "Orthopedic",
    "chest": "Cardiac",
    "heart": "Cardiac",
    "cardiac": "Cardiac",
    "brain": "Neuro",
    "nerve": "Neuro",
    "seizure": "Neuro",
    "stroke": "Neuro",
    "tumor": "Oncology",
    "cancer": "Oncology",
    "appendicitis": "General Surgery",
    "gallstones": "General Surgery",
    "pregnancy": "Maternity",
    "child": "Pediatrics",
    "fever child": "Pediatrics"
}

# ---------------------------------------------------------
# MODEL INITIALIZATION (Singleton Pattern)
# ---------------------------------------------------------

_classifier = None

def get_classifier():
    global _classifier
    if _classifier is None:
        try:
            logger.info(f"Loading zero-shot classifier: {MODEL_NAME}")
            _classifier = pipeline("zero-shot-classification", model=MODEL_NAME, device=-1)
            logger.info("Model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load Hugging Face model: {e}")
            _classifier = "FAILED"
    return _classifier

# ---------------------------------------------------------
# CORE LOGIC
# ---------------------------------------------------------

_cache = {}

def detect_specialty(user_text: str) -> dict:
    if not user_text or not user_text.strip():
        return {"detected_specialty": None, "confidence": 0.0}

    text = user_text.lower().strip()

    # 1. Keyword Fallback Layer (Fast & Priority)
    for keyword, specialty in KEYWORD_MAP.items():
        if keyword in text:
            return {"detected_specialty": specialty, "confidence": 1.0}

    # 2. Cache Check
    if text in _cache:
        return _cache[text]

    # 3. Transformer Logic
    classifier = get_classifier()
    if classifier == "FAILED" or classifier is None:
        return {"detected_specialty": None, "confidence": 0.0}

    try:
        result = classifier(user_text, CATEGORIES, multi_label=False)
        top_specialty = result['labels'][0]
        confidence = result['scores'][0]

        output = {
            "detected_specialty": top_specialty if confidence >= CONFIDENCE_THRESHOLD else None,
            "confidence": round(float(confidence), 4)
        }
        
        _cache[text] = output
        return output

    except Exception as e:
        logger.error(f"Prediction Error: {e}")
        return {"detected_specialty": None, "confidence": 0.0}

if __name__ == "__main__":
    test_cases = [
        "knee pain while walking",
        "chest tightness",
        "I found a tumor",
        "child has high fever",
        "seizures and headaches"
    ]
    
    print("\n--- Testing Symptom-to-Specialty Detection ---")
    for text in test_cases:
        res = detect_specialty(text)
        print(f"Input: '{text}' -> Detected: {res['detected_specialty']} (Score: {res['confidence']})")
