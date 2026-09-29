import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
    createMongoUser,
    createMongoSessionToken,
    AUTH_COOKIE_NAME,
    ROLE_COOKIE_NAME,
    SESSION_EXPIRY_SECONDS,
} from "@/lib/mongodb-auth";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { fullName, email, phone, password, role = "patient" } = body;

        // 1. Validate required fields
        if (!email || typeof email !== "string" || !email.includes("@")) {
            return NextResponse.json(
                { error: "A valid email address is required." },
                { status: 400 }
            );
        }

        if (!password || typeof password !== "string" || password.length < 8) {
            return NextResponse.json(
                { error: "Password must be at least 8 characters long." },
                { status: 400 }
            );
        }

        if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
            return NextResponse.json(
                { error: "Full name must be at least 2 characters long." },
                { status: 400 }
            );
        }

        if (!phone || typeof phone !== "string" || phone.trim().length < 10) {
            return NextResponse.json(
                { error: "Phone number must be at least 10 digits." },
                { status: 400 }
            );
        }

        if (role !== "patient" && role !== "hospital") {
            return NextResponse.json(
                { error: "Invalid user role." },
                { status: 400 }
            );
        }

        // 2. Create user in MongoDB with scrypt password hash & duplicate check
        let safeUser;
        try {
            safeUser = await createMongoUser({
                email,
                password,
                role,
                fullName,
                phone,
            });
        } catch (err: any) {
            if (err.code === "DUPLICATE_EMAIL" || err.message?.includes("already registered")) {
                return NextResponse.json(
                    { error: "This email is already registered." },
                    { status: 409 }
                );
            }
            throw err;
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
        return NextResponse.json(
            {
                success: true,
                message: "User registered successfully",
                user: safeUser,
            },
            { status: 201 }
        );
    } catch (error: any) {
        console.error("Auth register error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
