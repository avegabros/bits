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
      <div className="auth-page relative z-10 flex min-h-screen w-full items-center justify-center px-4">
        <div className="auth-card-outer w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl">
          <div className="auth-card-flex flex flex-col md:flex-row">
            {/* Left Side - Dynamic Form Content */}
            <div className="auth-form-panel flex w-full flex-col items-center justify-center bg-white/5 px-6 py-12 backdrop-blur-md md:w-1/2 md:px-9 md:py-16">
              <div className="w-full max-w-sm">
                {/* Mobile-only: Logo & brand info integrated into form area */}
                <div className="auth-mobile-brand hidden mb-8 text-center">
                  <div className="mx-auto mb-4 h-24 w-24 overflow-hidden rounded-lg">
                    <img
                      src="/images/av.jpg"
                      alt="Company Logo"
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23DC2626" width="200" height="200"/%3E%3Ctext x="50%" y="50%" fontSize="48" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold"%3EAB%3C/text%3E%3C/svg%3E'
                      }}
                    />
                  </div>
                  <h2 className="text-xl font-bold text-gray-700">AVEGA BROS.</h2>
                  <p className="mt-1 text-sm text-gray-500">Biometric Integrated Timekeeping System</p>
                </div>

                {children}

                {/* Mobile-only: Copyright at the very bottom */}
                <p className="auth-mobile-copyright hidden mt-6 text-center text-[10px] text-gray-400">
                  © 2026 Developed by AVEGA BROS. IT Interns
                </p>
              </div>
            </div>

            {/* Right Side - Logo and Description (Solid Red Box) */}
            <div className="auth-brand-panel flex w-full flex-col items-center justify-center bg-gray-600 px-6 py-12 md:w-1/2 md:px-10 md:py-16">
              <div className="auth-brand-content w-full max-w-sm text-center">
                {/* Logo Placeholder */}
                <div className="auth-brand-logo-wrap mb-8 flex h-50 w-full items-center justify-center rounded-lg bg-red">
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
                  <h2 className="auth-brand-title text-2xl font-bold text-gray-300">AVEGA BROS.</h2>
                  <p className="auth-brand-subtitle text-sm leading-relaxed text-gray-300">
                    Biometric Integrated Timekeeping System
                  </p>
                  <p className="auth-brand-copyright text-xs text-gray-400">© 2026 Developed by AVEGA BROS. IT Interns</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
