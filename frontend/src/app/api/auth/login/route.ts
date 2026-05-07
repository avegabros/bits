import { NextRequest, NextResponse } from 'next/server'

// BACKEND_URL must be set in .env.local (local) or docker-compose.yml (Docker).
const backendUrl = process.env.BACKEND_URL;
if (!backendUrl) {
    throw new Error(
        '[STARTUP] BACKEND_URL is not set.\n' +
        '  LOCAL:  Add BACKEND_URL=http://localhost:3001 to frontend/.env.local\n' +
        '  DOCKER: Set BACKEND_URL in docker-compose.yml (already configured).'
    );
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const res = await fetch(`${backendUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })

        const data = await res.json()

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status })
        }

        // ── Set HttpOnly cookies (JS can never read these) ────────────────────
        // Strip all token fields from the JSON body so they never touch
        // localStorage or any client-side JavaScript variable.
        const { accessToken, token, refreshToken: refreshTokenValue, ...safeData } = data

        const response = NextResponse.json(
            { ...safeData, success: true },
            { status: 200 }
        )

        const cookieBase = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax' as const,
            path: '/',
        }

        // Access token — short lived (1 hour)
        response.cookies.set('auth_token', accessToken ?? token, {
            ...cookieBase,
            maxAge: 60 * 60,
        })

        // Refresh token — long lived (7 days), used to silently renew access token
        if (refreshTokenValue) {
            response.cookies.set('refresh_token', refreshTokenValue, {
                ...cookieBase,
                maxAge: 7 * 24 * 60 * 60,
            })
        }

        return response

    } catch (error) {
        return NextResponse.json(
            { message: 'Network error. Could not reach the server.' },
            { status: 503 }
        )
    }
}
