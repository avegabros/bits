import { NextRequest } from 'next/server'

/**
 * Next.js Route Handler that pipes the backend's attendance SSE stream
 * directly to the browser.
 *
 * WHY this exists: Next.js rewrites (in next.config.ts) proxy HTTP
 * responses through an internal http-proxy layer that buffers the body.
 * SSE requires each chunk to be flushed immediately. This Route Handler
 * uses the Web Streams API (ReadableStream) which Next.js streams to
 * the client without buffering.
 */

const backendUrl = process.env.BACKEND_URL

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    if (!backendUrl) {
        console.error('[SSE Proxy] BACKEND_URL is not set')
        return new Response('BACKEND_URL not configured', { status: 500 })
    }

    // Forward the auth cookie so the backend's authenticate middleware
    // sees the JWT and allows the SSE connection.
    const cookie = request.headers.get('cookie') ?? ''

    try {
        const url = `${backendUrl}/api/attendance/stream`
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

        console.log('[SSE Proxy] Piping attendance SSE stream to client')

        // Pipe the backend ReadableStream straight to the client.
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
