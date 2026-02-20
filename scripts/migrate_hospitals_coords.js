const { MongoClient } = require('mongodb');

async function getCoordinates(hospital) {
    const address = hospital.address || '';
    const city = hospital.city || '';
    const state = hospital.state || '';

    // Skip if no address info at all
    if (!address && !city) return null;

    try {
        const query = encodeURIComponent(`${address}, ${city}, ${state}, India`);
        console.log(`Geocoding: ${hospital.hospitalName} (${query})`);

        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`,
            {
                headers: {
                    'User-Agent': 'MedDecision-Migration-Script'
                }
            }
        );
        const data = await response.json();

        // Wait a bit to respect Nominatim usage policy (1 request per second)
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        console.error(`Geocoding failed for ${hospital.hospitalName}:`, error.message);
    }
    return null;
}

async function migrateHospitals() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not found');
        return;
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db();
        const hospitalsCollection = db.collection('hospitals');

        const hospitals = await hospitalsCollection.find({
            $or: [
                { latitude: { $exists: false } },
                { latitude: null },
                { longitude: { $exists: false } },
                { longitude: null }
            ]
        }).toArray();

        console.log(`Found ${hospitals.length} hospitals needing coordinates.`);

        for (const hospital of hospitals) {
            const coords = await getCoordinates(hospital);
            if (coords) {
                await hospitalsCollection.updateOne(
                    { _id: hospital._id },
                    {
                        $set: {
                            latitude: coords.lat,
                            longitude: coords.lon,
                            updatedAt: new Date()
                        }
                    }
                );
                console.log(`✅ Updated ${hospital.hospitalName} with ${coords.lat}, ${coords.lon}`);
            } else {
                console.warn(`❌ Could not find coordinates for ${hospital.hospitalName}`);
                // Set default for India center so it's at least selectable
                await hospitalsCollection.updateOne(
                    { _id: hospital._id },
                    {
                        $set: {
                            latitude: 20.5937,
                            longitude: 78.9629,
                            updatedAt: new Date()
                        }
                    }
                );
            }
        }

        console.log('Migration completed.');

    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await client.close();
    }
}

migrateHospitals();
