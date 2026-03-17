"use client"

import { ChevronLeft, SlidersHorizontal } from "lucide-react"
import { useState, useMemo } from "react"
import { useAdmin } from "../context/AdminContext"
import { CATEGORIES } from "../data/categories"

interface ProductsPageProps {
  onNavigateHome: () => void
  onViewProduct: (productId: number) => void
}

/**
 * CUSTOMER-FACING PRODUCT PAGE
 * 
 * This component displays all products to customers with filtering and sorting.
 * It now uses the dynamic products from AdminContext, so any products added
 * via the admin system will instantly appear here without page refresh.
 * 
 * KEY INTEGRATION:
 * - Uses `products` from useAdmin() hook instead of static import
 * - Uses CATEGORIES constant for filter tabs (matches admin form)
 * - Shows/hides products based on stock visibility
 * - Supports real-time updates when products are added/edited
 */
export function ProductsPage({ onNavigateHome, onViewProduct }: ProductsPageProps) {
  const { products, getProductStock } = useAdmin()
  const [selectedCategory, setSelectedCategory] = useState("ALL")
  const [sortBy, setSortBy] = useState("NEWEST")

  const categories = ["ALL", ...CATEGORIES]
  const sortOptions = [
    { value: "NEWEST", label: "Newest First" },
    { value: "PRICE_LOW", label: "Price: Low → High" },
    { value: "PRICE_HIGH", label: "Price: High → Low" },
    { value: "BEST_SELLING", label: "Best Selling" },
  ]

  // Filter and sort products
  const filteredAndSortedProducts = useMemo(() => {
    console.log("🔍 Filtering products. Total products:", products.length, "Selected category:", selectedCategory)
    
    // SAFETY: Filter out any corrupted products
    let filtered = [...products].filter((p) => {
      if (!p || !p.id || !p.name) {
        console.warn("⚠️ Skipping corrupted product:", p)
        return false
      }
      const stock = getProductStock(p.id)
      return stock?.isVisible !== false // Show products unless explicitly hidden
    })

    // Filter by category
    if (selectedCategory === "NEW IN") {
      filtered = filtered.filter((p) => {
        const stock = getProductStock(p.id)
        return stock?.isNewArrival === true
      })
    } else if (selectedCategory !== "ALL") {
      filtered = filtered.filter((p) => p.category === selectedCategory)
    }

    // Sort products
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "PRICE_LOW":
          return a.price - b.price
        case "PRICE_HIGH":
          return b.price - a.price
        case "BEST_SELLING":
          return b.reviews - a.reviews
        case "NEWEST":
        default:
          return b.id - a.id
      }
    })

    console.log("✅ Filtered products:", filtered.length, "Category:", selectedCategory)
    return filtered
  }, [products, selectedCategory, sortBy, getProductStock])

  return (
    <div className="bg-neutral-100 min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b border-neutral-300">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
          <button
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-xs md:text-sm hover:underline mb-3 md:mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO HOME</span>
          </button>

          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl tracking-wider mb-2">ALL PRODUCTS</h1>
          <p className="text-xs sm:text-sm text-neutral-600 mt-1">Discover our complete collection</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border-b border-neutral-300 sticky top-[60px] md:top-[73px] z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Categories */}
            <div
              className="category-scroll flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:pb-1"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
                flexWrap: 'nowrap',
              }}
            >
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`whitespace-nowrap shrink-0 px-3 py-1.5 text-xs md:text-sm border rounded-full transition-colors ${
                    selectedCategory === category
                      ? "bg-black text-white border-black"
                      : "bg-white text-black border-neutral-300"
                  }`}
                  style={{ flexShrink: 0 }}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 md:gap-3">
              <SlidersHorizontal className="w-4 h-4" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs sm:text-sm py-1 px-2 sm:py-2 sm:px-3 border border-neutral-300 rounded bg-transparent outline-none cursor-pointer min-h-9"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 md:py-12">
        <div className="mb-4 md:mb-6 text-xs md:text-sm text-neutral-600">
          Showing {filteredAndSortedProducts.length} products
        </div>

                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2 sm:gap-3 md:gap-4 lg:gap-6">
          {filteredAndSortedProducts.map((product) => {
            // FIX: Use product.images[0] as primary image from admin form
            const primaryImage = product.images && product.images.length > 0 ? product.images[0] : null
            
            return (
            <div key={product.id} className="group cursor-pointer">
              {/* Product Image */}
              <div
                onClick={() => onViewProduct(product.id)}
                className="relative bg-neutral-200 aspect-3/4 mb-2 md:mb-4 overflow-hidden border border-neutral-300 hover:border-neutral-500 transition-colors"
              >
                {primaryImage ? (
                  <img 
                    src={primaryImage} 
                    alt={product.name}
                                className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-300 hover:scale-105"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '/placeholder-product.jpg'
                                }}
                  />
                ) : null}
                
                <div 
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ display: primaryImage ? 'none' : 'flex' }}
                >
                  <span className="text-xs md:text-sm text-neutral-500 text-center px-2">{product.name}</span>
                </div>

                {/* Label */}
                {product.label && (
                              <div className="absolute top-2 left-2 bg-black text-white text-xs px-2 py-0.5 tracking-wider">
                    {product.label}
                  </div>
                )}

                {/* Quick View Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    onClick={() => onViewProduct(product.id)}
                    className="bg-white text-black px-4 md:px-6 py-2 text-xs md:text-sm tracking-wider transform translate-y-4 group-hover:translate-y-0 transition-transform"
                  >
                    QUICK VIEW
                  </button>
                </div>
              </div>

              {/* Product Info */}
              <div onClick={() => onViewProduct(product.id)} className="space-y-1">
                            <h3 className="text-xs sm:text-sm md:text-base font-medium tracking-wider mt-2 line-clamp-2 group-hover:underline">{product.name}</h3>
                            <p className="text-xs text-neutral-500 mt-0.5 truncate">
                  {product.colors && product.colors.length > 0 ? product.colors.join(", ") : product.color}
                </p>
                            <p className="text-sm sm:text-base font-bold mt-1">₹{Number(product.price || 0).toFixed(2)}</p>
                {product.subType && (
                              <p className="text-xs text-neutral-400 mt-0.5 uppercase truncate">{product.subType}</p>
                )}
              </div>
            </div>
            )
          })}
        </div>

        {/* No Results */}
        {filteredAndSortedProducts.length === 0 && (
          <div className="text-center py-12 md:py-20">
            <p className="text-neutral-500 text-sm md:text-lg">No products found in this category.</p>
          </div>
        )}
      </div>
    </div>
  )
}
