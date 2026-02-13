import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const userRole = request.cookies.get('user-role')?.value

    // Protected patterns
    const hospitalPaths = ['/hospital']
    const patientPaths = ['/profile', '/treatment', '/recommendations']

    // Check if it's a hospital path
    const isHospitalPath = hospitalPaths.some(path => pathname.startsWith(path))

    // Check if it's a patient path
    const isPatientPath = patientPaths.some(path => pathname.startsWith(path))

    // Protection logic
    if (isHospitalPath) {
        if (userRole !== 'hospital') {
            return NextResponse.redirect(new URL('/login/hospital', request.url))
        }
    }

    if (isPatientPath) {
        if (userRole !== 'patient') {
            return NextResponse.redirect(new URL('/login/patient', request.url))
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
