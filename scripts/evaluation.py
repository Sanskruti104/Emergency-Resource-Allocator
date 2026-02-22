import pandas as pd
import numpy as np
import pickle
import json
import matplotlib.pyplot as plt
from sklearn.metrics import (
    mean_squared_error, r2_score, accuracy_score, f1_score, 
    confusion_matrix, roc_curve, auc, classification_report
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import label_binarize
import os

# Import the feature engineering logic
from feature_engineering import build_feature_engineering_pipeline

def run_evaluation():
    print("--- MedDecision ML Research: Model Reliability Evaluation ---")
    
    # 1. Load Data and Process Features
    csv_file = "meddecision_ml_data.csv"
    X_processed, y_suitability, y_risk, _ = build_feature_engineering_pipeline(csv_file)
    
    if X_processed is None:
        return

    # 2. Split Data (using same random_state as training for consistency)
    X_train, X_test, y_reg_train, y_reg_test = train_test_split(
        X_processed, y_suitability, test_size=0.2, random_state=42
    )
    X_train_c, X_test_c, y_clf_train, y_clf_test = train_test_split(
        X_processed, y_risk, test_size=0.2, random_state=42, stratify=y_risk
    )

    # 3. Load Models
    if not os.path.exists("suitability_model.pkl") or not os.path.exists("risk_model.pkl"):
        print("Error: Models not found. Please train models first.")
        return

    with open("suitability_model.pkl", "rb") as f:
        reg_model = pickle.load(f)
    with open("risk_model.pkl", "rb") as f:
        clf_model = pickle.load(f)

    # --- 4. EVALUATE REGRESSION (Suitability) ---
    print("\nEvaluating Suitability Regressor...")
    y_reg_pred = reg_model.predict(X_test)
    rmse = np.sqrt(mean_squared_error(y_reg_test, y_reg_pred))
    r2 = r2_score(y_reg_test, y_reg_pred)
    
    # Residual Plot
    residuals = y_reg_test - y_reg_pred
    plt.figure(figsize=(10, 6))
    plt.scatter(y_reg_pred, residuals, alpha=0.3, color='blue')
    plt.axhline(y=0, color='red', linestyle='--')
    plt.title('Suitability Model Residual Plot')
    plt.xlabel('Predicted Values')
    plt.ylabel('Residuals')
    plt.grid(True)
    plt.savefig('suitability_residual_plot.png')
    print("Saved suitability_residual_plot.png")

    # --- 5. EVALUATE CLASSIFICATION (Financial Risk) ---
    print("\nEvaluating Financial Risk Classifier...")
    y_clf_pred = clf_model.predict(X_test_c)
    acc = accuracy_score(y_clf_test, y_clf_pred)
    f1_macro = f1_score(y_clf_test, y_clf_pred, average='macro')
    
    # Confusion Matrix
    cm = confusion_matrix(y_clf_test, y_clf_pred, labels=['Low', 'Medium', 'High'])
    plt.figure(figsize=(8, 6))
    plt.imshow(cm, interpolation='nearest', cmap=plt.cm.Blues)
    plt.title('Financial Risk Confusion Matrix')
    plt.colorbar()
    tick_marks = np.arange(3)
    plt.xticks(tick_marks, ['Low', 'Medium', 'High'], rotation=45)
    plt.yticks(tick_marks, ['Low', 'Medium', 'High'])
    plt.xlabel('Predicted')
    plt.ylabel('Actual')
    
    # Add numbers to matrix
    for i in range(3):
        for j in range(3):
            plt.text(j, i, format(cm[i, j], 'd'),
                     horizontalalignment="center",
                     color="white" if cm[i, j] > cm.max()/2 else "black")
    
    plt.tight_layout()
    plt.savefig('risk_confusion_matrix.png')
    print("Saved risk_confusion_matrix.png")

    # Multiclass ROC Curve
    # Binarize labels 
    y_test_bin = label_binarize(y_clf_test, classes=['Low', 'Medium', 'High'])
    y_score = clf_model.predict_proba(X_test_c)
    n_classes = 3
    
    plt.figure(figsize=(10, 6))
    colors = ['aqua', 'darkorange', 'cornflowerblue']
    classes = ['Low', 'Medium', 'High']
    
    for i in range(n_classes):
        fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_score[:, i])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, color=colors[i], lw=2,
                 label='ROC curve of class {0} (area = {1:0.2f})'.format(classes[i], roc_auc))

    plt.plot([0, 1], [0, 1], 'k--', lw=2)
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title('Multiclass Financial Risk ROC Curve')
    plt.legend(loc="lower right")
    plt.savefig('risk_roc_curve.png')
    print("Saved risk_roc_curve.png")

    # --- 6. EXPORT METRICS ---
    metrics = {
        "suitability_model": {
            "rmse": float(rmse),
            "r2_score": float(r2)
        },
        "financial_risk_model": {
            "accuracy": float(acc),
            "f1_macro": float(f1_macro),
            "classification_report": classification_report(y_clf_test, y_clf_pred, output_dict=True)
        }
    }
    
    with open('model_evaluation_metrics.json', 'w') as jf:
        json.dump(metrics, jf, indent=4)
    print("\nMetrics exported to model_evaluation_metrics.json")

    print("\nEvaluation Summary:")
    print(f"Suitability R2: {r2:.4f}")
    print(f"Risk Accuracy: {acc:.4f}")

if __name__ == "__main__":
    import sys
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    run_evaluation()
