const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkProfiles() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not found');
        return;
    }

    const client = new MongoClient(uri);
    try {
        await client.connect();
        const db = client.db();
        const profiles = await db.collection('patient_profiles').find({}).toArray();
        console.log(`Found ${profiles.length} profiles:`);
        profiles.forEach(p => {
            console.log(`- UID: ${p.uid}, Diagnosis: ${p.diagnosisCategory}, UpdatedAt: ${p.updatedAt}`);
        });
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
    } finally {
        await client.close();
    }
}

checkProfiles();
