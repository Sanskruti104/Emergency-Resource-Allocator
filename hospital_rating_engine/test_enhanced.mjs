import { calculateHospitalRating } from './hospital_rating_engine.js';

const mockHospitals = [
    {
        name: "Premium Multi-Specialty",
        capacity: {
            totalBeds: 120,
            availableBeds: 24, // 80% occupancy -> Full 15 points
            icuBeds: 15,
            operationTheatres: 6,
            onDutySpecialist: 12,
            emergencyAvailable: true
        },
        specialties: ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Oncology', 'Gastroenterology', 'Dermatology', 'Urology'],
        governmentApproved: true,
        governmentSchemes: true,
        insuranceAvailable: true,
        insuranceSanctionRate: 0.95
    },
    {
        name: "Data Missing Clinic",
        capacity: {
            totalBeds: 20
            // Missing icuBeds
        },
        // Missing specialties, insuranceSanctionRate
        governmentApproved: false
    }
];

mockHospitals.forEach(h => {
    console.log(`Rating for ${h.name}:`);
    const rating = calculateHospitalRating(h);
    console.log(JSON.stringify(rating, null, 2));
    console.log('---');
});
