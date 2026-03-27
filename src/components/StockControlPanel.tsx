"use client"

import { useState, useEffect } from "react"
import { Eye, EyeOff, Star, ChevronDown } from "lucide-react"
import { useAdmin } from "../context/AdminContext"

export function StockControlPanel() {
  const { products, stock, updateStock, toggleProductVisibility, getProductStock, markAsNewArrival, markAsFeatured } = useAdmin()
  const [expandedProduct, setExpandedProduct] = useState<string | number | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [variantTotals, setVariantTotals] = useState<Record<string, number>>({})

  useEffect(() => {
    if (products.length === 0) return
    const fetchVariantTotals = async () => {
      const totals: Record<string, number> = {}
      await Promise.all(
        products.map(async (p) => {
          try {
            const res = await fetch(`/api/products/${p.id}/variants`)
            if (res.ok) {
              const data = await res.json()
              const variants: any[] = data.data || data
              totals[String(p.id)] = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
            }
          } catch {}
        })
      )
      setVariantTotals(totals)
    }
    fetchVariantTotals()
  }, [products])

  const filteredProducts = products.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 md:px-4 py-2 md:py-3 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-black text-xs md:text-base"
        />
      </div>

      {/* Products List */}
      <div className="space-y-2 md:space-y-3">
        {filteredProducts.map((product) => {
          const productId = String(product.id)
          const productStock = getProductStock(productId)
          const isVisible = productStock?.isVisible ?? true
          const isNewArrival = productStock?.isNewArrival ?? false
          const isFeatured = productStock?.isFeatured ?? false
          const sizes = productStock?.sizes || {}
          const legacyStock = Object.values(sizes).reduce((sum, qty) => sum + (typeof qty === "number" ? qty : 0), 0)
          const totalStock = variantTotals[productId] !== undefined ? variantTotals[productId] : legacyStock

          return (
            <div
              key={product.id}
              className="bg-white border border-neutral-300 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
            <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                onKeyDown={(e) => e.key === 'Enter' && setExpandedProduct(expandedProduct === product.id ? null : product.id)}
                className="w-full p-3 md:p-4 flex flex-col md:flex-row md:items-center md:justify-between hover:bg-neutral-50 transition-colors gap-2 md:gap-4 cursor-pointer"
              >
                <div className="flex-1 text-left min-w-0">
                  <h3 className="font-semibold tracking-wide text-xs md:text-sm mb-1 line-clamp-1">{product.name}</h3>
                  <p className="text-xs text-neutral-600">
                    ₹{Number(product.price || 0).toFixed(2)} • Total Stock: {totalStock}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                  {/* Visibility Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleProductVisibility(productId)
                    }}
                    className="p-1.5 md:p-2 hover:bg-neutral-200 rounded transition-colors shrink-0"
                    title={isVisible ? "Hide product" : "Show product"}
                  >
                    {isVisible ? (
                      <Eye className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <EyeOff className="w-4 h-4 md:w-5 md:h-5 text-neutral-400" />
                    )}
                  </button>

                  <span
                    className={`text-xs px-2 py-1 rounded whitespace-nowrap font-semibold ${
                      isVisible ? "bg-green-100 text-green-700" : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {isVisible ? "VISIBLE" : "HIDDEN"}
                  </span>

                  {/* Expand Icon */}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform shrink-0 ${
                      expandedProduct === product.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Expanded Content */}
              {expandedProduct === product.id && (
                <div className="border-t border-neutral-200 p-3 md:p-4 bg-neutral-50 space-y-4">
                  {/* Product Tags */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-neutral-700">PRODUCT TAGS</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => markAsNewArrival(productId, !isNewArrival)}
                        className={`px-2 md:px-3 py-1.5 text-xs rounded transition-colors font-semibold ${
                          isNewArrival
                            ? "bg-blue-500 text-white"
                            : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                        }`}
                      >
                        NEW ARRIVAL
                      </button>
                      <button
                        onClick={() => markAsFeatured(productId, !isFeatured)}
                        className={`px-2 md:px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1 font-semibold ${
                          isFeatured
                            ? "bg-yellow-500 text-white"
                            : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                        }`}
                      >
                        <Star className="w-3 h-3" />
                        FEATURED
                      </button>
                    </div>
                  </div>

                  {/* Stock Inventory */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-neutral-700">INVENTORY BY SIZE</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {(product.sizes ?? []).map((size) => {
                        const quantity = sizes[size] ?? 50
                        const isOutOfStock = quantity === 0

                        return (
                          <div key={size} className="flex flex-col gap-1">
                            <label className="text-xs font-semibold tracking-wide">{size}</label>
                            <div className="flex gap-1 items-center">
                              <input
                                type="number"
                                value={quantity}
                                onChange={(e) =>
                                  updateStock(productId, size, Math.max(0, Number.parseInt(e.target.value) || 0))
                                }
                                className={`flex-1 px-2 py-1 border rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-black ${
                                  isOutOfStock ? "bg-red-50 border-red-300" : "border-neutral-300"
                                }`}
                              />
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded whitespace-nowrap font-semibold ${
                                  isOutOfStock ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                                }`}
                              >
                                {isOutOfStock ? "OUT" : "IN"}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* No Results */}
      {filteredProducts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-neutral-500 text-xs md:text-sm">No products found.</p>
        </div>
      )}
    </div>
  )
}
