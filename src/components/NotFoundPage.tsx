/**
 * 404 NOT FOUND PAGE
 * 
 * Displayed when user navigates to non-existent page or product
 */

import { Search, Home, ArrowLeft } from 'lucide-react'

interface NotFoundPageProps {
  title?: string
  message?: string
  onNavigateHome?: () => void
  onNavigateBack?: () => void
  showSearch?: boolean
}

export function NotFoundPage({
  title = "404 - PAGE NOT FOUND",
  message = "The page you're looking for doesn't exist or has been moved.",
  onNavigateHome,
  onNavigateBack,
  showSearch = true
}: NotFoundPageProps) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center">
        {/* Large 404 */}
        <div className="mb-8">
          <h1 className="text-[150px] md:text-[200px] font-bold leading-none text-neutral-200 select-none">
            404
          </h1>
        </div>

        {/* Error message */}
        <h2 className="text-2xl md:text-4xl font-bold tracking-wider mb-4">
          {title}
        </h2>
        <p className="text-neutral-600 text-lg mb-8">
          {message}
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="px-6 py-3 border border-neutral-300 rounded hover:bg-neutral-100 transition-colors flex items-center justify-center gap-2 tracking-wider"
            >
              <ArrowLeft className="w-5 h-5" />
              GO BACK
            </button>
          )}
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="px-6 py-3 bg-black text-white rounded hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 tracking-wider"
            >
              <Home className="w-5 h-5" />
              GO TO HOME
            </button>
          )}
        </div>

        {/* Search suggestion */}
        {showSearch && (
          <div className="border-t border-neutral-200 pt-8">
            <div className="flex items-center justify-center gap-2 text-neutral-600 mb-4">
              <Search className="w-5 h-5" />
              <p className="text-sm">Try searching for what you need</p>
            </div>
            <div className="max-w-md mx-auto">
              <input
                type="text"
                placeholder="Search products..."
                className="w-full px-4 py-3 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
        )}

        {/* Popular links */}
        <div className="mt-12 pt-8 border-t border-neutral-200">
          <p className="text-sm text-neutral-600 mb-4">POPULAR CATEGORIES</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button type="button" className="px-4 py-2 bg-neutral-100 rounded hover:bg-neutral-200 transition-colors text-sm">
              SAREES
            </button>
            <button type="button" className="px-4 py-2 bg-neutral-100 rounded hover:bg-neutral-200 transition-colors text-sm">
              KURTIS
            </button>
            <button type="button" className="px-4 py-2 bg-neutral-100 rounded hover:bg-neutral-200 transition-colors text-sm">
              LEHENGAS
            </button>
            <button type="button" className="px-4 py-2 bg-neutral-100 rounded hover:bg-neutral-200 transition-colors text-sm">
              DUPATTAS
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * OUT OF STOCK PAGE
 */
export function OutOfStockPage({
  productName,
  onNavigateBack,
  onNavigateHome,
  onNotifyMe
}: {
  productName?: string
  onNavigateBack?: () => void
  onNavigateHome?: () => void
  onNotifyMe?: () => void
}) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-neutral-100 mb-6">
          <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>

        {/* Message */}
        <h2 className="text-2xl md:text-3xl font-bold tracking-wider mb-3">
          OUT OF STOCK
        </h2>
        {productName && (
          <p className="text-lg text-neutral-600 mb-2">{productName}</p>
        )}
        <p className="text-neutral-600 mb-8">
          This product is currently unavailable. We'll restock it soon!
        </p>

        {/* Actions */}
        <div className="space-y-3 mb-8">
          {onNotifyMe && (
            <button
              onClick={onNotifyMe}
              className="w-full px-6 py-3 bg-black text-white rounded hover:bg-neutral-800 transition-colors tracking-wider"
            >
              NOTIFY ME WHEN AVAILABLE
            </button>
          )}
          {onNavigateBack && (
            <button
              onClick={onNavigateBack}
              className="w-full px-6 py-3 border border-neutral-300 rounded hover:bg-neutral-100 transition-colors tracking-wider"
            >
              BACK TO PRODUCTS
            </button>
          )}
        </div>

        {/* Similar products */}
        {onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="text-sm text-neutral-600 hover:text-black transition-colors underline"
          >
            Browse similar products
          </button>
        )}
      </div>
    </div>
  )
}
