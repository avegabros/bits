import { NextRequest } from 'next/server'

/**
 * Next.js Route Handler for the employee-scoped attendance SSE stream.
 * Pipes the backend's `/api/me/attendance/stream` response directly to the client.
 */

const backendUrl = process.env.BACKEND_URL

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    if (!backendUrl) {
        console.error('[SSE Proxy] BACKEND_URL is not set')
        return new Response('BACKEND_URL not configured', { status: 500 })
    }

    const cookie = request.headers.get('cookie') ?? ''

    try {
        const url = `${backendUrl}/api/me/attendance/stream`
        console.log(`[SSE Proxy] Connecting to ${url}`)

        const backendRes = await fetch(url, {
            headers: {
                'Accept': 'text/event-stream',
                'Cookie': cookie,
            },
            cache: 'no-store',
        })

        if (!backendRes.ok) {
            const text = await backendRes.text().catch(() => 'no body')
            console.error(`[SSE Proxy] Backend returned ${backendRes.status}: ${text}`)
            return new Response(`Backend error: ${backendRes.status}`, { status: 502 })
        }

        if (!backendRes.body) {
            console.error('[SSE Proxy] Backend response has no body')
            return new Response('No stream body', { status: 502 })
        }

        console.log('[SSE Proxy] Piping employee attendance SSE stream to client')

        return new Response(backendRes.body as ReadableStream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no',
            },
        })
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[SSE Proxy] Fetch failed: ${message}`)
        return new Response(`SSE proxy error: ${message}`, { status: 502 })
    }
}
