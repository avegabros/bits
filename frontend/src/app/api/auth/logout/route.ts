import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/auth/logout
 * - Calls backend /api/auth/logout to delete the refresh token from the DB
 * - Clears both auth_token and refresh_token HttpOnly cookies
 */
export async function POST(req: NextRequest) {
    try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'

        // Forward the refresh_token cookie to the backend so it can delete the DB record
        const cookieHeader = req.headers.get('cookie') || ''
        await fetch(`${backendUrl}/api/auth/logout`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader },
        })
    } catch {
        // Even if backend call fails, clear the cookies on the client side
        console.error('[/api/auth/logout] Backend logout call failed — clearing cookies anyway')
    }

    // Clear both cookies
    const response = NextResponse.json({ success: true, message: 'Logged out' })

    response.cookies.delete('auth_token')
    response.cookies.delete('refresh_token')

    return response
}
