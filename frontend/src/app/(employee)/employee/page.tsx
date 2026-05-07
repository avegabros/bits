'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function EmployeeRedirectPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/employee/dashboard')
    }, [router])

    return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-gray-500">Loading your workspace...</p>
        </div>
    )
}
