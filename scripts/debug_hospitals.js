const { MongoClient } = require('mongodb');

async function checkHospitals() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not found');
        return;
    }

    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db();
        const hospitals = await db.collection('hospitals').find({}).toArray();

        console.log(`Total hospitals found: ${hospitals.length}`);
        hospitals.forEach(h => {
            console.log(`- ${h.hospitalName}: Lat: ${h.latitude}, Lon: ${h.longitude}, City: ${h.city}`);
        });

    } catch (error) {
        console.error(error);
    } finally {
        await client.close();
    }
}

checkHospitals();
