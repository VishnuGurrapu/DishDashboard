import { useState } from 'react'

interface ImageWithFallbackProps {
  src: string
  alt: string
  className?: string
}

export const ImageWithFallback = ({
  src,
  alt,
  className = '',
}: ImageWithFallbackProps) => {
  const [hasError, setHasError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-800/80 text-slate-400 p-4 border border-slate-700/50 ${className}`}
        role="img"
        aria-label={`${alt} (image unavailable)`}
      >
        <svg
          className="w-10 h-10 mb-1 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.5"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
          />
        </svg>
        <span className="text-xs font-medium text-slate-400">Image Unavailable</span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden bg-slate-800 ${className}`}>
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-800 animate-pulse flex items-center justify-center">
          <span className="text-xs text-slate-500">Loading...</span>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
