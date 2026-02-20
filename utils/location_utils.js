/**
 * Location Utility Module
 * Provides deterministic geographic calculations for the hospital recommendation engine.
 */

/**
 * Calculates the distance between two points on Earth using the Haversine formula.
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers rounded to 2 decimal places
 */
const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;

    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Number(distance.toFixed(2));
};

/**
 * Calculates a compatibility score based on travel distance and user flexibility.
 * @param {number} distanceKm - Distance in km
 * @param {number} travelFlexibility - 0 (Local), 1 (State), 2 (Anywhere)
 * @returns {number} Score between 0 and 1
 */
const getTravelCompatibilityScore = (distanceKm, travelFlexibility) => {
    // If distance is unknown, assume compatible
    if (distanceKm === null || distanceKm === undefined) return 1;

    // Convert flexibility to number just in case
    const flex = Number(travelFlexibility);

    if (flex === 0) { // Local only
        if (distanceKm < 20) return 1.0;
        if (distanceKm <= 50) return 0.7;
        return 0.2;
    }

    if (flex === 1) { // Within state
        if (distanceKm < 100) return 1.0;
        if (distanceKm <= 300) return 0.7;
        return 0.4;
    }

    if (flex === 2) { // Anywhere
        if (distanceKm > 800) return 0.5;
        return 1.0; // Meets the "Always >= 0.7" logic for shorter distances in this category
    }

    return 1.0;
};

/**
 * Calculates a penalty multiplier based on urgency and distance.
 * @param {number} distanceKm - Distance in km
 * @param {number} urgency - 0 (Planned), 1 (Emergency)
 * @returns {number} Multiplier between 0 and 1
 */
const getUrgencyDistancePenalty = (distanceKm, urgency) => {
    const isEmergency = Number(urgency) === 1;

    if (!isEmergency) {
        return 1.0; // No penalty for planned procedures
    }

    // Emergency Logic
    if (distanceKm < 30) return 1.0;
    if (distanceKm <= 100) return 0.6;
    return 0.2;
};

export {
    calculateDistanceKm,
    getTravelCompatibilityScore,
    getUrgencyDistancePenalty
};
