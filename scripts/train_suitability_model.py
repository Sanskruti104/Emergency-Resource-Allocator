import pandas as pd
import numpy as np
import pickle
from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, r2_score
import os

# Import the feature engineering logic
from feature_engineering import build_feature_engineering_pipeline

def train_suitability():
    print("--- Training MedDecision Suitability Regressor ---")
    
    # 1. Prepare Data
    csv_file = "meddecision_ml_data.csv"
    X_processed, y_suitability, _, _ = build_feature_engineering_pipeline(csv_file)
    
    if X_processed is None:
        return

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X_processed, y_suitability, test_size=0.2, random_state=42
    )

    # 2. Model Comparison & Hyperparameter Tuning
    # We will tune RandomForest and use GradientBoosting as a comparison (XGB fallback)
    
    models = {
        "RandomForest": {
            "model": RandomForestRegressor(random_state=42),
            "params": {
                "n_estimators": [50, 100],
                "max_depth": [10, 20, None],
                "min_samples_split": [2, 5]
            }
        },
        "GradientBoosting": {
            "model": GradientBoostingRegressor(random_state=42),
            "params": {
                "n_estimators": [50, 100],
                "learning_rate": [0.01, 0.1],
                "max_depth": [3, 5]
            }
        }
    }

    best_score = -np.inf
    best_model = None
    best_name = ""

    for name, config in models.items():
        print(f"\nTuning {name}...")
        grid_search = GridSearchCV(
            config["model"], 
            config["params"], 
            cv=5, 
            scoring='r2', 
            n_jobs=-1
        )
        grid_search.fit(X_train, y_train)
        
        score = grid_search.best_score_
        print(f"Best CV R2 for {name}: {score:.4f}")
        
        if score > best_score:
            best_score = score
            best_model = grid_search.best_estimator_
            best_name = name

    # 3. Final Evaluation
    print(f"\nEvaluating Best Model ({best_name}) on Test Set...")
    y_pred = best_model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)

    print(f"Final RMSE: {rmse:.4f}")
    print(f"Final R2: {r2:.4f}")

    # 4. Save Model
    save_path = "suitability_model.pkl"
    with open(save_path, "wb") as f:
        pickle.dump(best_model, f)
    print(f"\nModel saved to {save_path}")

if __name__ == "__main__":
    # Ensure scripts directory is in path for imports
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    train_suitability()
