import os
import logging
import re
from transformers import pipeline
from deep_translator import GoogleTranslator

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

# Marathi Keyword Map for direct detection
MARATHI_KEYWORD_MAP = {
    "गुडघा": "Orthopedic",
    "हृदय": "Cardiac",
    "छाती": "Cardiac",
    "डोळा": "Ophthalmology",
    "त्वचा": "Dermatology",
    "मेंदू": "Neuro",
    "गर्भधारणा": "Maternity",
    "बाळ": "Pediatrics"
}

# Hindi Keyword Map for direct detection
HINDI_KEYWORD_MAP = {
    "घुटना": "Orthopedic",
    "दर्द": "Orthopedic",
    "दिल": "Cardiac",
    "आंख": "Ophthalmology",
    "त्वचा": "Dermatology",
    "दिमाग": "Neuro",
    "गर्भ": "Maternity",
    "सीने": "Cardiac",
    "बुखार": "Pediatrics"
}

# ---------------------------------------------------------
# UTILS
# ---------------------------------------------------------

def is_devanagari(text: str) -> bool:
    """Detects if text contains Devanagari characters (used in Hindi and Marathi)."""
    return bool(re.search(r'[\u0900-\u097F]', text))

def translate_to_english(text: str) -> str:
    """Translates text to English using GoogleTranslator."""
    try:
        translated = GoogleTranslator(source='auto', target='en').translate(text)
        logger.info(f"Translated: '{text}' -> '{translated}'")
        return translated
    except Exception as e:
        logger.error(f"Translation Error: {e}")
        return text

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

    original_text = user_text.strip()
    detected_lang = "en"
    
    # 1. Devanagari Detection & Specific Keyword Mapping (Marathi -> Hindi)
    if is_devanagari(original_text):
        logger.info("Devanagari input detected (Hindi/Marathi).")
        
        # Check Marathi Keywords First
        for kw, specialty in MARATHI_KEYWORD_MAP.items():
            if kw in original_text:
                return {
                    "detected_specialty": specialty, 
                    "confidence": 1.0, 
                    "language": "mr",
                    "method": "keyword"
                }
        
        # Check Hindi Keywords Second
        for kw, specialty in HINDI_KEYWORD_MAP.items():
            if kw in original_text:
                return {
                    "detected_specialty": specialty, 
                    "confidence": 1.0, 
                    "language": "hi",
                    "method": "keyword"
                }
        
        # If no specific keyword match, translate to English for Zero-Shot
        user_text = translate_to_english(original_text)
        detected_lang = "hi/mr-translated"
    
    text = user_text.lower().strip()

    # 2. English Keyword Fallback Layer
    for keyword, specialty in KEYWORD_MAP.items():
        if keyword in text:
            return {
                "detected_specialty": specialty, 
                "confidence": 1.0,
                "language": detected_lang,
                "method": "keyword"
            }

    # 3. Cache Check
    if text in _cache:
        return _cache[text]

    # 4. Transformer Logic
    classifier = get_classifier()
    if classifier == "FAILED" or classifier is None:
        return {"detected_specialty": None, "confidence": 0.0}

    try:
        result = classifier(user_text, CATEGORIES, multi_label=False)
        top_specialty = result['labels'][0]
        confidence = result['scores'][0]

        output = {
            "detected_specialty": top_specialty if confidence >= CONFIDENCE_THRESHOLD else None,
            "confidence": round(float(confidence), 4),
            "language": detected_lang,
            "method": "transformer"
        }
        
        _cache[text] = output
        return output

    except Exception as e:
        logger.error(f"Prediction Error: {e}")
        return {"detected_specialty": None, "confidence": 0.0}

if __name__ == "__main__":
    test_cases = [
        "knee pain while walking",
        "माझ्या गुडघ्यात वेदना होत आहेत", # Marathi: "My knee is hurting"
        "छातीत दुखणे", # Marathi: "Chest pain"
        "मेरे घुटने में दर्द है", # Hindi
        "child has high fever",
        "mala bhuk lagat nahi" # Romanized Marathi
    ]
    
    print("\n--- Testing Multilingual Symptom Detection (En/Hi/Mr) ---")
    for t in test_cases:
        res = detect_specialty(t)
        print(f"Input: '{t}'")
        print(f"Detected: {res.get('detected_specialty')} (Score: {res.get('confidence')}, Lang: {res.get('language')})\n")
