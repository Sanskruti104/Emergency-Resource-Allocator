import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({
        firebase_client: {
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "✅ Set" : "❌ Missing",
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ? "✅ Set" : "❌ Missing",
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? "✅ Set" : "❌ Missing",
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ? "✅ Set" : "❌ Missing",
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ? "✅ Set" : "❌ Missing",
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? "✅ Set" : "❌ Missing",
        },
        firebase_admin: {
            projectId: process.env.FIREBASE_PROJECT_ID ? "✅ Set" : "❌ Missing",
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL ? "✅ Set" : "❌ Missing",
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? "✅ Set" : "❌ Missing",
        },
        mongodb: {
            uri: process.env.MONGODB_URI ? "✅ Set" : "❌ Missing",
        }
    });
}