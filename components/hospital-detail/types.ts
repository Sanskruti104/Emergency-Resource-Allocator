export interface Hospital {
    _id: string;
    uid: string;
    hospitalName: string;
    description: string;
    specialties: string[];
    achievements: string[];
    helplineNumber: string;
    opdTiming: string;
    capacity: {
        totalBeds: number;
        availableBeds: number;
        icuBeds: number;
        emergencyAvailable: boolean;
        level: 'High' | 'Medium' | 'Low';
    };
    media: {
        exterior: string[];
        wards: string[];
        icu: string[];
        gallery: string[];
        virtualTourLink?: string;
    };
    insuranceNetworks: string[];
    insuranceEligibility: {
        accepted: boolean;
        notes: string;
    };
    packageRates: {
        [treatment: string]: {
            range: [number, number];
            insuranceRate: number;
            cashRate: number;
        };
    };
    claimMetrics: {
        claimReliabilityScore: number;
        averageApprovalTime: string;
        coverageLikelihood: number;
    };
    governmentSchemes: string[];
    address?: string;
    isVerified?: boolean;
}
