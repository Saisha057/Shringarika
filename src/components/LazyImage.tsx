import { useState, useEffect } from 'react'

interface LazyImageProps {
  src: string
  alt: string
  className?: string
  width?: number | string
  height?: number | string
  placeholder?: string
  onLoad?: () => void
  onError?: () => void
}

export function LazyImage({
  src,
  alt,
  className = '',
  width,
  height,
  placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect width="400" height="300" fill="%23f5f5f5"/%3E%3C/svg%3E',
  onLoad,
  onError,
}: LazyImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(placeholder)
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let observer: IntersectionObserver
    let didCancel = false

    if (imageRef && imageSrc === placeholder) {
      // Create intersection observer
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            // When image is in viewport
            if (!didCancel && (entry.intersectionRatio > 0 || entry.isIntersecting)) {
              setImageSrc(src)
              observer.unobserve(imageRef)
            }
          })
        },
        {
          threshold: 0.01,
          rootMargin: '100px',
        }
      )

      observer.observe(imageRef)
    }

    return () => {
      didCancel = true
      if (observer && imageRef) {
        observer.unobserve(imageRef)
      }
    }
  }, [src, imageSrc, imageRef, placeholder])

  const handleImageLoad = () => {
    setIsLoading(false)
    if (onLoad) onLoad()
  }

  const handleImageError = () => {
    setHasError(true)
    setIsLoading(false)
    if (onError) onError()
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <img
        ref={setImageRef}
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'blur-sm' : ''} transition-all duration-300`}
        style={{ width, height }}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
      {isLoading && imageSrc !== placeholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      )}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 text-neutral-400 text-sm">
          Failed to load image
        </div>
      )}
    </div>
  )
}

// Hook for preloading images
export const useImagePreloader = (imageUrls: string[]) => {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadImage = (url: string) => {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          setLoadedImages((prev) => new Set(prev).add(url))
          resolve(url)
        }
        img.onerror = reject
        img.src = url
      })
    }

    // Preload images in batches
    const batchSize = 3
    const batches = []
    for (let i = 0; i < imageUrls.length; i += batchSize) {
      batches.push(imageUrls.slice(i, i + batchSize))
    }

    const loadBatches = async () => {
      for (const batch of batches) {
        await Promise.allSettled(batch.map(loadImage))
      }
    }

    loadBatches()
  }, [imageUrls])

  return loadedImages
}

// Image compression utility
export const compressImage = async (
  file: File,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.8
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob)
            } else {
              reject(new Error('Canvas to Blob conversion failed'))
            }
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Image load failed'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}
