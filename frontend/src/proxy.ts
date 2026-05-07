import { NextRequest, NextResponse } from 'next/server'

/**
 * Next.js Edge Auth Proxy (Next.js 16+)
 *
 * Runs on the Edge Runtime BEFORE any page is rendered or API route is called.
 * Checks for auth cookies and redirects unauthenticated users to /login —
 * no page HTML is ever delivered to unauthenticated requests.
 *
 * Next.js 16 uses "proxy.ts" as the file convention (middleware.ts is deprecated).
 * Requires a default export — the function name is arbitrary.
 */

// Routes that do NOT require authentication
const PUBLIC_PATHS = ['/login']

// Prefixes that are always allowed through
const PUBLIC_PREFIXES = ['/api/', '/_next/', '/favicon', '/icon', '/placeholder', '/images/']

export default function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Allow public paths and Next.js internals through without auth check
    if (
        PUBLIC_PATHS.includes(pathname) ||
        PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))
    ) {
        return NextResponse.next()
    }

    // Root path — let the page's own redirect handle it
    if (pathname === '/') {
        return NextResponse.next()
    }

    // Check for the HttpOnly auth cookies
    const authToken = request.cookies.get('auth_token')?.value
    const refreshToken = request.cookies.get('refresh_token')?.value

    if (!authToken && !refreshToken) {
        // No tokens at all → definitely not authenticated
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('from', pathname)
        return NextResponse.redirect(loginUrl)
    }

    // At least one token present — allow through.
    // If auth_token is expired, the client-side interceptor will
    // attempt a silent refresh via the refresh_token.
    return NextResponse.next()
}

/**
 * Matcher: run this proxy on all routes EXCEPT Next.js static internals
 */
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|icon\\.jpg).*)',
    ],
}
