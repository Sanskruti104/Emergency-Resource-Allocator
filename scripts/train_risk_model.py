import pandas as pd
import numpy as np
import pickle
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, f1_score, classification_report
import os

# Import the feature engineering logic
from feature_engineering import build_feature_engineering_pipeline

def train_risk():
    print("--- Training MedDecision Financial Risk Classifier ---")
    
    # 1. Prepare Data
    csv_file = "meddecision_ml_data.csv"
    X_processed, _, y_risk, _ = build_feature_engineering_pipeline(csv_file)
    
    if X_processed is None:
        return

    # Split data (stratified as it's classification)
    X_train, X_test, y_train, y_test = train_test_split(
        X_processed, y_risk, test_size=0.2, random_state=42, stratify=y_risk
    )

    # 2. Model Tuning
    models = {
        "RandomForest": {
            "model": RandomForestClassifier(random_state=42),
            "params": {
                "n_estimators": [50, 100],
                "max_depth": [10, 20],
                "class_weight": ["balanced"]
            }
        },
        "GradientBoosting": {
            "model": GradientBoostingClassifier(random_state=42),
            "params": {
                "n_estimators": [50, 100],
                "learning_rate": [0.1],
                "max_depth": [3, 5]
            }
        }
    }

    best_f1 = -np.inf
    best_model = None
    best_name = ""

    for name, config in models.items():
        print(f"\nTuning {name}...")
        grid_search = GridSearchCV(
            config["model"], 
            config["params"], 
            cv=5, 
            scoring='f1_macro', 
            n_jobs=-1
        )
        grid_search.fit(X_train, y_train)
        
        score = grid_search.best_score_
        print(f"Best CV F1-Macro for {name}: {score:.4f}")
        
        if score > best_f1:
            best_f1 = score
            best_model = grid_search.best_estimator_
            best_name = name

    # 3. Final Evaluation
    print(f"\nEvaluating Best Model ({best_name}) on Test Set...")
    y_pred = best_model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average='macro')

    print(f"Final Accuracy: {accuracy:.4f}")
    print(f"Final F1-Score (Macro): {f1:.4f}")
    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred))

    # 4. Save Model
    save_path = "risk_model.pkl"
    with open(save_path, "wb") as f:
        pickle.dump(best_model, f)
    print(f"\nModel saved to {save_path}")

if __name__ == "__main__":
    # Ensure scripts directory is in path for imports
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    train_risk()
