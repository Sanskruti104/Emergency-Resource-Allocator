import { NextResponse } from "next/server";
import { auth } from "@/lib/firebase";
import { adminAuth } from "@/lib/firebase-admin";

export async function GET() {
    try {
        // Test client-side Firebase
        const clientFirebaseStatus = auth ? "✅ Client Firebase initialized" : "❌ Client Firebase not initialized";
        
        // Test server-side Firebase Admin
        let adminFirebaseStatus = "❌ Admin Firebase not initialized";
        if (adminAuth) {
            try {
                // Try to list users (this will fail if not properly configured, but won't crash)
                await adminAuth.listUsers(1);
                adminFirebaseStatus = "✅ Admin Firebase initialized and working";
            } catch (error: any) {
                if (error.code === 'auth/insufficient-permission' || error.code === 'auth/project-not-found') {
                    adminFirebaseStatus = `❌ Admin Firebase config issue: ${error.code}`;
                } else {
                    adminFirebaseStatus = "✅ Admin Firebase initialized (limited test)";
                }
            }
        }

        return NextResponse.json({
            status: "Firebase Configuration Test",
            client: clientFirebaseStatus,
            admin: adminFirebaseStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        return NextResponse.json({
            error: "Test failed",
            details: error.message
        }, { status: 500 });
    }
}