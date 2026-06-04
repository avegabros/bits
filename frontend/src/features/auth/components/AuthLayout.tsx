import React from 'react'
import { GlobalLoading } from '@/components/ui/GlobalLoading'

interface AuthLayoutProps {
  children: React.ReactNode
  showLoading?: boolean
  loadingMessage?: string
}

export function AuthLayout({ 
  children, 
  showLoading = false, 
  loadingMessage = 'Preparing your workspace...' 
}: AuthLayoutProps) {
  // Fullscreen loading overlay
  if (showLoading) {
    return <GlobalLoading message={loadingMessage} />
  }

  return (
    <div className="relative min-h-screen w-full overflow-y-auto">
      {/* Background gradient */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          opacity: 0.3,
        }}
      />

      {/* Gradient Overlay */}
      <div className="absolute inset-0 z-0 bg-linear-to-r from-gray-200 to-gray-900" />

      {/* Content Container - Centered Card */}
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-4">
        <div className="w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl">
          <div className="flex flex-col md:flex-row">
            {/* Left Side - Dynamic Form Content */}
            <div className="flex w-full flex-col items-center justify-center bg-white/5 px-6 py-12 backdrop-blur-md md:w-1/2 md:px-9 md:py-16">
              <div className="w-full max-w-sm">
                {children}
              </div>
            </div>

            {/* Right Side - Logo and Description (Solid Red Box) */}
            <div className="flex w-full flex-col items-center justify-center bg-gray-600 px-6 py-12 md:w-1/2 md:px-10 md:py-16">
              <div className="w-full max-w-sm text-center">
                {/* Logo Placeholder */}
                <div className="mb-8 flex h-50 w-full items-center justify-center rounded-lg bg-red">
                  <img
                    src="/images/av.jpg"
                    alt="Company Logo"
                    className="h-full w-full object-contain p-4"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23DC2626" width="200" height="200"/%3E%3Ctext x="50%" y="50%" fontSize="48" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold"%3EAB%3C/text%3E%3C/svg%3E'
                    }}
                  />
                </div>

                {/* Description Text */}
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-gray-300">AVEGA BROS.</h2>
                  <p className="text-sm leading-relaxed text-gray-300">
                    Biometric Integrated Timekeeping System
                  </p>
                  <p className="text-xs text-gray-400">© 2026 Developed by AVEGA BROS. IT Interns</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
