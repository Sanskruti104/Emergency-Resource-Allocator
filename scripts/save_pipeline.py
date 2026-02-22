import pickle
import os
import sys

# Add scripts directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from feature_engineering import build_feature_engineering_pipeline

def save_fitted_pipeline():
    print("Fitting and saving the feature engineering pipeline...")
    csv_file = "meddecision_ml_data.csv"
    _, _, _, pipeline = build_feature_engineering_pipeline(csv_file)
    
    if pipeline is not None:
        with open("feature_pipeline.pkl", "wb") as f:
            pickle.dump(pipeline, f)
        print("Pipeline saved to feature_pipeline.pkl")

if __name__ == "__main__":
    save_fitted_pipeline()
