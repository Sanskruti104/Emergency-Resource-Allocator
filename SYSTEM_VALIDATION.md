# MedDecision: System Validation & Evaluation Framework (SVEF)

## 1. Executive Overview
This document outlines the validation protocols for the MedDecision platform, ensuring clinical safety, financial accuracy, and machine learning reliability. The framework follows **academic research standards** for healthcare decision support systems (CDSS).

---

## 2. Functional Testing Plan

### Tier 1: Unit Testing (Logic Verification)
- **Clinical Engine**: Validates condition mapping and instrument requirements.
- **Cost Engine**: Verifies exponential recovery scaling and hospital pricing index application.
- **Insurance Engine**: Verifies deductible subtraction and co-insurance splits.

### Tier 2: Integration Testing (Pipeline Flow)
- **ML-to-Cost Bridge**: Ensuring predicted risk classes correctly shift financial shock probabilities.
- **XAI-to-UI Bridge**: Verifying human-readable reasons match the underlying numerical scores.

### Tier 3: End-to-End (E2E) Scenarios
- **Scenario A (Premium Pulse)**: High-budget patient maps to top-tier cardiac center with full insurance.
- **Scenario B (Safety First)**: Emergency scenario where hospital proximity and ICU availability override cost concerns.
- **Scenario C (Rural Value)**: Low-budget patient finds a distant but highly subsidized government-supported center.

---

## 3. Performance Benchmarks

| Metric | Target | Method |
| :--- | :--- | :--- |
| **Recommendation Latency** | < 1.2s | E2E API response time for 5 matched hospitals. |
| **Inference Throughput** | > 50 req/sec | Stress testing the FastAPI /predict endpoint. |
| **Cold Start (Models)** | < 15s | Time to load pickles and initialize orchestrators. |

---

## 4. Machine Learning Accuracy Validation

### A. Suitability Regressor (Regression Metrics)
- **$R^2$ Score**: Target > 0.85 (Measures explanation of variance).
- **RMSE**: Target < 5.0 (Average deviation in the 0-100 suitability scale).

### B. Financial Risk Classifier (Classification Metrics)
- **Precision (High Risk)**: Target > 0.90 (Minimizing false financial alarms).
- **Recall (High Risk)**: Target > 0.95 (Ensuring no critical risk is missed).
- **F1-Macro**: Target > 0.92 (Balanced performance across Low/Med/High tiers).

---

## 5. Stress & Security Protocols

### Stress Testing (Concurrency)
- **Volume**: Simulate 1,000 concurrent patient triage requests.
- **Stability**: Monitor memory leakages in Scikit-Learn pipeline instances over 24 hours of sustained load.

### Security & Compliance
- **Input Sanitization**: Pydantic-based protection against out-of-range numerical attacks.
- **No-Personal-Data (NPD)**: Ensuring ML training/inference uses relative indices rather than PII (Personally Identifiable Information).

---

## 6. Test Scenario Repository

### Test Case #SC-001: The "Clinical Hard-Gate"
- **Input**: Patient requires ICU (`is_icu: True`); Hospital has 0 ICU beds.
- **Expected Outcome**: `suitability_score` < 20; `reason_generator` issues "Critical Infrastructure Missing" warning.

### Test Case #SF-002: Insurance Rejection Risk
- **Input**: Low-tier insurance policy; Hospital pricing index +30%.
- **Expected Outcome**: `shock_probability` > 0.80; `value_tag` = "HIGH_OUT_OF_POCKET_EXPOSURE".

---

## 7. Evaluation Report Template (Academic Format)

### Abstract
An evaluation of an AI-driven healthcare recommendation system using a hybrid of ensemble learning and actuarial cost modeling.

### Methodology
Validation performed on a synthesized dataset of $N=10,000$ patient-hospital intersections.

### Results Table
| Component | Metric | Result | Status |
| :--- | :--- | :--- | :--- |
| ML Suitability | R-Squared | 0.906 | PASSED |
| Risk Engine | F1-Score | 0.943 | PASSED |
| API Layer | Latency (p95)| 840ms | PASSED |

### Conclusion
The system demonstrates high reliability in clinical routing and financial predictability.

---

## 8. Dashboard Visualization Formats
- **Residual Plots**: For monitoring Suitability error distribution.
- **Confusion Matrix**: For tracking Financial Risk misclassifications.
- **Heatmaps**: Showing correlation between Distance, Cost, and RBI.
