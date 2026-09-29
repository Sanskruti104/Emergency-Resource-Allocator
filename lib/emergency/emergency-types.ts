/**
 * Real-Time Emergency Resource Allocator Domain Types
 * Extends the MedDecision platform with Emergency Response, Ambulance Dispatch,
 * Hospital Capacity Tracking, Two-Way Reservation, and Patient Handoff models.
 */

// ==========================================
// 1. Triage & Priority Enums
// ==========================================

export type TriagePriority = "RED" | "YELLOW" | "GREEN" | "BLACK";

export type EmergencyType =
    | "TRAUMA"
    | "CARDIAC"
    | "STROKE"
    | "RESPIRATORY"
    | "PEDIATRIC"
    | "OBSTETRIC"
    | "GENERAL";

export type EmergencyRequestStatus =
    | "PENDING"          // Intake recorded, awaiting allocation
    | "ALLOCATING"       // Engine computing optimal facility
    | "ALLOCATED"        // Facility assigned, bed reserved
    | "DISPATCHED"       // Ambulance assigned and en-route to scene
    | "ON_SCENE"         // Paramedics assessing on scene
    | "TRANSPORTING"     // In-transit to destination hospital
    | "ARRIVED"          // Arrived at Emergency Department
    | "HANDED_OFF"       // Transferred to hospital clinical team
    | "ADMITTED"         // Admitted to receiving department
    | "CANCELLED";

export type AmbulanceStatus =
    | "AVAILABLE"
    | "DISPATCHED"
    | "EN_ROUTE_SCENE"
    | "ON_SCENE"
    | "TRANSPORTING"
    | "AT_HOSPITAL"
    | "OUT_OF_SERVICE";

export type ReservationStatus =
    | "PENDING"
    | "CONFIRMED"
    | "ADMITTED"
    | "DISCHARGED"
    | "HELD"
    | "FULFILLED"
    | "EXPIRED"
    | "CANCELLED"
    // Extended states for the Real-Time Emergency Reservation Service
    | "RELEASED"    // Reservation returned capacity (supersedes CANCELLED for emergency flow)
    | "REJECTED";   // Allocation overridden / hospital declined

export type ResourceType =
    | "GENERAL_BED"
    | "ICU_BED"
    | "TRAUMA_BAY"
    | "OPERATION_THEATRE"
    | "VENTILATOR"
    | "CATH_LAB"
    | "CT_SCAN"
    | "SPECIALIST";

export type HospitalEventType =
    | "RESERVATION_CONFIRMED"
    | "RESERVATION_REJECTED"
    | "PATIENT_ADMITTED"
    | "PATIENT_DISCHARGED"
    | "ICU_RESERVED"
    | "ICU_RELEASED"
    | "VENTILATOR_ASSIGNED"
    | "VENTILATOR_RELEASED"
    | "DIVERSION_ACTIVATED"
    | "DIVERSION_LIFTED"
    | "CAPACITY_OVERRIDE"
    | "TRANSPORT_STARTED"
    | "AMBULANCE_EN_ROUTE"
    | "AMBULANCE_ARRIVED"
    | "HANDOFF_STARTED"
    | "HANDOFF_COMPLETED";

export type HandoffStatus =
    | "IN_TRANSIT"
    | "ARRIVED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "DIVERTED"
    | "CANCELLED";

// ==========================================
// 2. Common Value Objects
// ==========================================

export interface IncidentLocation {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    state?: string;
    landmark?: string;
}

export interface EmergencyVitals {
    sbp?: number;           // Systolic Blood Pressure (mmHg)
    dbp?: number;           // Diastolic Blood Pressure (mmHg)
    heartRate?: number;     // Pulse (bpm)
    spo2?: number;          // Oxygen saturation (%)
    gcs?: number;           // Glasgow Coma Scale (3–15)
    respiratoryRate?: number;
    bloodGlucose?: number;  // mg/dL
    temperature?: number;   // Celsius
}

export interface EmergencyPatientInfo {
    age?: number;
    gender?: "male" | "female" | "other" | "unknown";
    name?: string;
    contactNumber?: string;
}

// ==========================================
// 3. Domain Model: EmergencyRequest
// ==========================================

export interface EmergencyRequest {
    _id?: any;
    emergencyId: string;                    // Unique identifier (e.g. "EMG-2026-0001" or "EMS-100000")
    ambulanceId?: string | null;            // Assigned ambulance if dispatched
    emergencyType: EmergencyType;           // High-level category
    priority: TriagePriority;               // RED (Immediate), YELLOW (Urgent), GREEN (Minimal)
    incidentLocation: IncidentLocation;
    vitals?: EmergencyVitals;
    chiefComplaint: string;                 // Descriptive symptom string
    condition: string;                      // Normalized category (e.g. 'cardiac', 'trauma', 'stroke')
    requiredSpecialty: string;              // Target department (e.g. 'Cardiology', 'Neurology', 'Trauma Surgery')
    requiredResources: ResourceType[];      // Resources required (e.g. ['ICU_BED', 'VENTILATOR'])
    allocatedHospitalId?: string | null;    // Assigned hospital UID
    receivingHospitalId?: string | null;    // Confirmed destination hospital UID
    reservationId?: string | null;          // Active reservation ID
    status: EmergencyRequestStatus;
    transportStatus?: "EN_ROUTE" | "ARRIVED" | null;
    handoffStatus?: "IN_PROGRESS" | "COMPLETED" | null;
    transportStartedAt?: Date | null;
    arrivedHospitalAt?: Date | null;
    admittedAt?: Date | null;
    patient?: EmergencyPatientInfo;
    source: "MANUAL_INTAKE" | "EMS_SIMULATION" | "VOICE_NLP";
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

// ==========================================
// 4. Domain Model: Ambulance
// ==========================================

export interface Ambulance {
    _id?: any;
    ambulanceId: string;                    // e.g. "AMB-PUNE-01"
    callSign?: string;                      // Radio callsign (e.g. "Medic-1")
    vehicleType?: "BLS" | "ALS" | "MICU";   // Basic, Advanced, Mobile ICU
    status: AmbulanceStatus;
    transportStatus?: "EN_ROUTE" | "ARRIVED" | null;
    handoffStatus?: "IN_PROGRESS" | "COMPLETED" | null;
    currentLocation: {
        latitude: number;
        longitude: number;
        heading?: number;
        speedKmH?: number;
        updatedAt: Date;
    };
    currentEmergencyId?: string | null;     // Active dispatch ID
    destinationHospitalId?: string | null;  // En-route destination hospital UID
    ETA?: number | null;                    // Estimated Time of Arrival in minutes
    assignedCrew?: {
        leadParamedic?: string;
        contactPhone?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

// ==========================================
// 5. Domain Model: Reservation
// ==========================================

export interface Reservation {
    _id?: any;
    reservationId: string;                  // Unique reservation ID (e.g. "RES-883921")
    emergencyId: string;                    // Associated EmergencyRequest ID
    hospitalId: string;                     // Target hospital UID
    resourceType: ResourceType;             // Type of bed or equipment reserved
    quantity: number;                       // Number of units (default 1)
    status: ReservationStatus;
    allocatedBy?: "AUTO_ALLOCATOR" | "MANUAL_DISPATCH";
    createdAt: Date;
    expiresAt: Date;                        // Auto-expire time (e.g. 30 minutes from creation)
    fulfilledAt?: Date | null;
    cancelledAt?: Date | null;
}

// ==========================================
// 6. Domain Model: HospitalEvent
// ==========================================

export interface HospitalEvent {
    _id?: any;
    eventId: string;                        // Unique event ID (e.g. "EVT-109283")
    hospitalId: string;                     // Hospital UID
    eventType: HospitalEventType;
    emergencyId?: string | null;
    reservationId?: string | null;
    resourceType?: ResourceType;
    quantity?: number;
    details: Record<string, any>;           // Operational context / audit parameters
    actorId?: string;                       // Staff or system ID that recorded event
    timestamp: Date;
}

// ==========================================
// 7. Domain Model: Handoff
// ==========================================

export interface Handoff {
    _id?: any;
    handoffId: string;                      // Unique handoff ID (e.g. "HND-00129")
    emergencyId: string;
    ambulanceId: string;
    hospitalId: string;
    reservationId?: string | null;
    arrivalTime: Date;                      // Timestamp ambulance touched down at ED
    handoffStartTime?: Date | null;         // Timestamp handoff initiated
    handoffTime?: Date | null;              // Timestamp clinical responsibility transferred
    receivingStaffId?: string | null;       // Doctor/Nurse ID accepting patient
    receivingDoctorName?: string;
    triageCategoryConfirmed?: TriagePriority;
    status: HandoffStatus;
    clinicalNotes?: string;
    delayReason?: string;                   // Document delays if ED is crowded
    createdAt: Date;
    updatedAt?: Date;
}

// ==========================================
// 8. Triage Intake DTO (Data Transfer Object)
// ==========================================

export interface EmergencyIntakeDTO {
    condition: string;
    chiefComplaint: string;
    age?: number;
    gender?: "male" | "female" | "other" | "unknown";
    sbp?: number;
    heartRate?: number;
    spo2?: number;
    gcs?: number;
    triagePriority?: "RED" | "YELLOW" | "GREEN";
    latitude?: number;
    longitude?: number;
    address?: string;
    source?: "MANUAL_INTAKE" | "EMS_SIMULATION" | "VOICE_NLP";
    notes?: string;
}
