'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function HRPage() {
    const router = useRouter()

    useEffect(() => {
        // Redirect to HR dashboard
        router.replace('/hr/dashboard')
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center">
            <p>Redirecting to HR Dashboard...</p>
        </div>
    )
}
