import React, { useState } from 'react'

interface AvatarProps {
  src?: string | null
  alt?: string
  initials?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-24 h-24 text-2xl',
  xl: 'w-32 h-32 text-4xl',
}

export function Avatar({ src, alt = 'Avatar', initials, size = 'md', className = '' }: AvatarProps) {
  const [hasError, setHasError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const classes = `${sizeClasses[size]} rounded-full flex items-center justify-center overflow-hidden bg-blue-100 text-blue-700 font-bold shrink-0 ${className}`

  if (src && !hasError) {
    return (
      <div className={classes}>
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      </div>
    )
  }

  // Fallback to initials if no src or image fails to load
  return (
    <div className={classes}>
      {initials ? initials.toUpperCase() : alt.charAt(0).toUpperCase()}
    </div>
  )
}
