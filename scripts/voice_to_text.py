import os
import requests
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SarvamSTT")

# ---------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------
SARVAM_API_URL = "https://api.sarvam.ai/speech-to-text"
# In a real production app, this should come from env but for this hackathon context 
# we'll look for SARVAM_API_KEY in environment
SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "PLACEHOLDER_KEY")

def transcribe_audio(file_path: str) -> dict:
    """
    Transcribes audio using Sarvam AI STT API.
    """
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return {"transcript": "", "confidence": 0.0, "error": "File not found"}

    try:
        # Check file size (Sarvam limits files to 30s usually, check size as proxy or rely on API error)
        file_size = os.path.getsize(file_path)
        logger.info(f"Transcribing file: {file_path} ({file_size} bytes)")

        headers = {
            "api-subscription-key": SARVAM_API_KEY
        }

        with open(file_path, "rb") as audio_file:
            files = {
                "file": (os.path.basename(file_path), audio_file, "audio/wav")
            }
            data = {
                "model": "saaras:v3" # Using the recommended state-of-the-art model
            }

            response = requests.post(SARVAM_API_URL, headers=headers, files=files, data=data)
            
        if response.status_code == 200:
            result = response.json()
            logger.info("Transcription successful.")
            # Sarvam response structure usually contains 'transcript'
            return {
                "transcript": result.get("transcript", ""),
                "confidence": result.get("confidence", 0.95), # Defaulting confidence if not provided
                "language_code": result.get("language_code", "hi-IN")
            }
        else:
            logger.error(f"Sarvam API Error: {response.status_code} - {response.text}")
            return {"transcript": "", "confidence": 0.0, "error": response.text}

    except Exception as e:
        logger.error(f"Transcription failure: {e}")
        return {"transcript": "", "confidence": 0.0, "error": str(e)}

if __name__ == "__main__":
    # Test stub
    import sys
    if len(sys.argv) > 1:
        print(transcribe_audio(sys.argv[1]))
    else:
        print("Usage: python voice_to_text.py <path_to_audio_file>")
