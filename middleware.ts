import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const sessionCookie = request.cookies.get('session')?.value
    const userRole = request.cookies.get('user-role')?.value

    // Protected patterns
    const hospitalPaths = ['/hospital']
    const patientPaths = ['/profile', '/treatment', '/recommendations']

    const isHospitalPath = hospitalPaths.some(path => pathname.startsWith(path))
    const isPatientPath = patientPaths.some(path => pathname.startsWith(path))

    // 1. Hospital Path Protection
    if (isHospitalPath) {
        // If no session or role is not hospital, redirect to login
        if (!sessionCookie || userRole !== 'hospital') {
            const loginUrl = new URL('/login/hospital', request.url)
            loginUrl.searchParams.set('from', pathname)
            return NextResponse.redirect(loginUrl)
        }
    }

    // 2. Patient Path Protection
    if (isPatientPath) {
        if (!sessionCookie || userRole !== 'patient') {
            const loginUrl = new URL('/login/patient', request.url)
            loginUrl.searchParams.set('from', pathname)
            return NextResponse.redirect(loginUrl)
        }
    }

    // 3. Prevent logged-in users from visiting login pages
    if (pathname.startsWith('/login') && sessionCookie && userRole) {
        if (userRole === 'hospital') {
            return NextResponse.redirect(new URL('/hospital/dashboard', request.url))
        }
        if (userRole === 'patient') {
            return NextResponse.redirect(new URL('/recommendations', request.url)) // Or their home
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/hospital/:path*',
        '/profile/:path*',
        '/treatment/:path*',
        '/recommendations/:path*',
    ],
}
