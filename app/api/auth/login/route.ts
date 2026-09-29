import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
    authenticateMongoUser,
    createMongoSessionToken,
    AUTH_COOKIE_NAME,
    ROLE_COOKIE_NAME,
    SESSION_EXPIRY_SECONDS,
    UserRole,
} from "@/lib/mongodb-auth";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password, expectedRole } = body;

        // 1. Validate required fields
        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required." },
                { status: 400 }
            );
        }

        // 2. Authenticate against MongoDB with scrypt password verification
        let safeUser;
        try {
            safeUser = await authenticateMongoUser(
                email,
                password,
                expectedRole as UserRole | undefined
            );
        } catch (err: any) {
            if (err.code === "ROLE_MISMATCH") {
                return NextResponse.json(
                    { error: "role-mismatch", message: err.message },
                    { status: 403 }
                );
            }
            return NextResponse.json(
                { error: err.message || "Invalid email or password." },
                { status: 401 }
            );
        }

        // 3. Create secure MongoDB application session
        const sessionToken = createMongoSessionToken({
            uid: safeUser.uid,
            email: safeUser.email,
            role: safeUser.role,
        });

        // 4. Set HTTP-only session cookie & role cookie
        const cookieStore = await cookies();
        const isProduction = process.env.NODE_ENV === "production";

        cookieStore.set(AUTH_COOKIE_NAME, sessionToken, {
            maxAge: SESSION_EXPIRY_SECONDS,
            httpOnly: true,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
        });

        cookieStore.set(ROLE_COOKIE_NAME, safeUser.role, {
            maxAge: SESSION_EXPIRY_SECONDS,
            httpOnly: false,
            secure: isProduction,
            sameSite: "lax",
            path: "/",
        });

        // 5. Return success (NEVER return password or passwordHash)
        return NextResponse.json({
            success: true,
            message: "Signed in successfully",
            user: safeUser,
        });
    } catch (error: any) {
        console.error("Auth login error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
