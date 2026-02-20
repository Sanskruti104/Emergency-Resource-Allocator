import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if API key is present and valid
let auth: Auth | undefined;
let storage: ReturnType<typeof getStorage> | undefined;

// Debug logging
console.log('Firebase Config Check:', {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.substring(0, 10) + '...',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    isDemoApiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'demo-api-key',
    isDemoProject: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID === 'demo-project'
});

const hasValidFirebaseConfig = process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key' &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'demo-project';

console.log('Firebase validation result:', hasValidFirebaseConfig);

if (hasValidFirebaseConfig) {
    try {
        const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        auth = getAuth(app);
        storage = getStorage(app);
        console.log('✅ Firebase client initialized successfully');
    } catch (error) {
        console.warn('❌ Firebase initialization failed:', error);
    }
} else {
    console.warn('❌ Firebase not configured - using placeholder credentials. Please set up Firebase for authentication.');
}

export { auth, storage };
