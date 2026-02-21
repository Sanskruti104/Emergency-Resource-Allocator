# MedDecision: Project Overview Document

## 1. Executive Summary
**MedDecision** is a comprehensive health-tech platform designed to bridge the transparency gap in healthcare. It empowers patients to make data-driven decisions regarding medical treatments by comparing costs, evaluating hospital infrastructure, and analyzing quality ratings. For hospitals, it provides a robust dashboard for capacity management and profile optimization.

---

## 2. Technical Stack
The project leverages a modern, scalable stack focused on performance and real-time data handling:

- **Frontend**: Next.js 15+ (App Router architecture) using React 19.
- **Styling**: Tailwind CSS for responsive design and Radix UI / Shadcn UI for accessible, premium-feel components.
- **Backend**: Next.js Server Components and API Routes.
- **Database**: 
  - **MongoDB**: Primary persistent storage for hospital data, patient profiles, and treatment details.
  - **Firebase**: Used for Authentication (Patients/Hospitals) and Cloud Storage (Media uploads).
- **Analytics & Visualization**: 
  - **Recharts**: For radar charts and price comparison graphs.
  - **Leaflet**: For interactive map-based hospital discovery.
- **Logic Layers**: 
  - **Hospital Rating Engine**: Custom JavaScript scoring engine.
  - **Zod**: For robust schema validation and type safety.

---

## 3. Core Logic & Systematic Analysis

### 3.1 Hospital Rating Engine (HRE)
The HRE is a deterministic scoring system that evaluates hospitals on a 100-point scale. It is designed to prioritize factual infrastructure over subjective reviews.

**Scoring Breakdown:**
1.  **Infrastructure (40%)**: Evaluates bed capacity (total/ICU), number of Operation Theatres, on-duty specialists, and 24/7 emergency availability.
2.  **Utilization (15%)**: Uses an "Optimal Occupancy" algorithm (Ideal: 60-85%). Penalty is applied for under-utilization (inefficiency) or over-capacity (care quality risk).
3.  **Governance & Financial (25%)**: Checks for government approval (e.g., NABH), availability of government schemes (PM-JAY), and insurance sanction rates.
4.  **Clinical Coverage (20%)**: Based on the variety and depth of medical specialties offered.

**Transparency Features:**
- **Explanation Generator**: Dynamically generates textual justifications for the score.
- **Confidence Indicator**: Measures data "freshness" and completeness, providing a reliability score (High/Medium/Low).

### 3.2 Recommendation & Matching Logic
The platform doesn't just list hospitals; it *matches* them to specific patient needs using a multi-factor suitability algorithm:

- **Specialty Match (35 pts)**: Primary filter based on the patient's diagnosis.
- **Proximity Logic (25 pts)**: Uses Haversine distance, adjusted by:
  - **Travel Flexibility**: Adjusts score based on whether the patient is willing to travel locally, state-wide, or nationally.
  - **Urgency Penalty**: For emergency cases, the matching score drops exponentially with distance.
- **Budget Compatibility (20 pts)**: Filters hospitals based on estimated treatment costs vs. patient budget.
- **Emergency Readiness (10 pts)**: Weightage given to 24/7 facility status for urgent cases.
- **Insurance Match (10 pts)**: Real-time matching with supported insurance networks and government schemes.

---

## 4. System Architecture & Flow

### 4.1 User Roles
- **Patient**: Can manage health profiles, search for treatments, and receive ranked hospital recommendations.
- **Hospital Administrator**: Can update real-time bed availability, manage media galleries (360° tours, ward images), and update specialized service costs.

### 4.2 Application Flow
1.  **Onboarding**: User selects a role and signs up via Firebase.
2.  **Context Building**: Patients define their condition, budget, and location.
3.  **Recommendation Phase**: The `api/treatment/match` endpoint gathers MongoDB data, runs the Rating Engine, calculates Proximity, and returns a ranked list.
4.  **Decision Making**: Patients view the breakdown of *why* a hospital fits (Suitability Score) vs. their *quality* (Rating).
5.  **Hospital Management**: Hospitals use their dashboard to keep data current, ensuring the accuracy of the rating and matching engines.

### 4.3 Security & Middleware
- **Role-Based Access Control (RBAC)**: Next.js middleware intercepts requests to `/hospital/` and `/profile/`, verifying session cookies and user roles stored in Firebase/encrypted cookies.

---

## 5. Scalability & Future Roadmap
- **Scalability**: The modular Rating Engine can be easily expanded with new metrics (e.g., surgery outcome rates).
- **Data Integrity**: The Confidence Indicator encourages hospitals to maintain accurate data to improve their visibility.
- **Planned Features**:
  - AI-driven treatment cost forecasting.
  - Real-time inquiry and appointment booking gateway.
  - Enhanced 360° Virtual Tour integrations for remote facility inspection.

---
*Created on February 21, 2026, for AISSMS Techathon Review 1*
