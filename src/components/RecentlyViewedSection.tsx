"use client"

import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useAdmin } from "../context/AdminContext"
import { useRecentlyViewed, type RecentlyViewedItem } from "../hooks/useRecentlyViewed"
import { ChevronLeft, Trash2 } from "lucide-react"

interface RecentlyViewedSectionProps {
  onNavigateHome?: () => void
  onViewProduct?: (productId: number) => void
  isStandalone?: boolean
}

export function RecentlyViewedSection({ onNavigateHome, onViewProduct, isStandalone = false }: RecentlyViewedSectionProps) {
  const { user } = useAuth()
  const { products } = useAdmin()
  const { getRecentlyViewed, clearRecentlyViewed } = useRecentlyViewed()
  const [recentItems, setRecentItems] = useState<RecentlyViewedItem[]>([])

  useEffect(() => {
    loadRecentlyViewed()
  }, [user?.id])

  const loadRecentlyViewed = () => {
    const items = getRecentlyViewed(user?.id)
    setRecentItems(items)
    console.log('📚 Loaded recently viewed:', items.length, 'items')
  }

  const handleClear = () => {
    if (window.confirm('Clear all recently viewed products?')) {
      clearRecentlyViewed(user?.id)
      setRecentItems([])
    }
  }

  const handleRemoveItem = (productId: number) => {
    const updated = recentItems.filter(item => item.id !== productId)
    setRecentItems(updated)
    const key = user?.id ? `recentlyViewed_${user.id}` : 'recentlyViewed_guest'
    localStorage.setItem(key, JSON.stringify(updated))
  }

  if (recentItems.length === 0 && !isStandalone) {
    return null
  }

  const containerClass = isStandalone
    ? "min-h-screen bg-neutral-50 p-8"
    : "my-12 px-4 md:px-8"

  return (
    <div className={containerClass}>
      <div className="max-w-7xl mx-auto">
        {isStandalone && (
          <div className="mb-8 flex items-center justify-between">
            <button
              onClick={onNavigateHome}
              className="flex items-center gap-2 text-sm hover:underline"
            >
              <ChevronLeft className="h-4 w-4" />
              BACK TO HOME
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl md:text-3xl tracking-wider">RECENTLY VIEWED</h2>
          {recentItems.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-neutral-200 hover:bg-neutral-300 rounded transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              CLEAR ALL
            </button>
          )}
        </div>

        {recentItems.length === 0 ? (
          <div className="text-center py-16 bg-white rounded">
            <p className="text-neutral-500 mb-4">No recently viewed products</p>
            <p className="text-sm text-neutral-400">Products you view will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {recentItems.map((item) => {
              const fullProduct = products.find(p => p.id === item.id)
              // Use full product image if available, otherwise use cached image
              const imageUrl = fullProduct?.images?.[0] || fullProduct?.image || item.image;
              
              return (
                <div key={item.id} className="group relative bg-white rounded overflow-hidden shadow-sm hover:shadow-md transition-all">
                  {/* Product Image */}
                  <div 
                    className="aspect-[3/4] relative overflow-hidden cursor-pointer bg-neutral-100"
                    onClick={() => onViewProduct?.(item.id)}
                  >
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          // Fallback on image load error
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLElement).parentElement;
                          if (parent && !parent.querySelector('.fallback-text')) {
                            const fallback = document.createElement('div');
                            fallback.className = 'fallback-text w-full h-full flex items-center justify-center bg-neutral-200';
                            fallback.innerHTML = '<span class="text-neutral-400 text-sm">No Image</span>';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-200 flex items-center justify-center">
                        <span className="text-neutral-400 text-sm">No Image</span>
                      </div>
                    )}
                    
                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveItem(item.id)
                      }}
                      className="absolute top-2 right-2 p-2 bg-white/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                      title="Remove from recently viewed"
                    >
                      <Trash2 className="h-4 w-4 text-neutral-600" />
                    </button>

                    {/* Out of stock overlay */}
                    {fullProduct && fullProduct.stock !== undefined && fullProduct.stock <= 0 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">OUT OF STOCK</span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3 md:p-4">
                    <p className="text-xs text-neutral-500 mb-1">{item.category}</p>
                    <h3 
                      className="text-sm md:text-base font-medium mb-2 line-clamp-2 cursor-pointer hover:underline"
                      onClick={() => onViewProduct?.(item.id)}
                    >
                      {item.name}
                    </h3>
                    <p className="text-lg font-medium">₹{item.price.toLocaleString()}</p>
                    
                    {/* View date */}
                    <p className="text-xs text-neutral-400 mt-2">
                      Viewed {new Date(item.viewedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
