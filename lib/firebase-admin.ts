import * as admin from "firebase-admin";

if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.error("Firebase Admin Error: Missing one or more required environment variables");
        console.error("Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY");
        console.error("Found:", { 
            projectId: !!projectId, 
            clientEmail: !!clientEmail, 
            privateKey: !!privateKey 
        });
    } else {
        try {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId,
                    clientEmail,
                    privateKey: privateKey.replace(/\\n/g, "\n"),
                }),
            });
            console.log("Firebase Admin initialized successfully");
        } catch (error: any) {
            console.error("Firebase Admin initialization error:", error.message);
        }
    }
}

// Only export if Firebase Admin is initialized
let adminAuth: admin.auth.Auth | undefined;
let adminDb: admin.firestore.Firestore | undefined;

try {
    if (admin.apps.length > 0) {
        adminAuth = admin.auth();
        adminDb = admin.firestore();
    }
} catch (error) {
    console.error("Error accessing Firebase Admin services:", error);
}

export { adminAuth, adminDb };
