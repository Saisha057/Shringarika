/**
 * PRODUCT DETAIL PAGE - COMPLETE FIX
 * 
 * FIXES APPLIED:
 * 1. ✅ Product images now display from product.images[0]
 * 2. ✅ Product price is visible
 * 3. ✅ Product color is displayed correctly
 * 4. ✅ Reads product from dynamic context (useAdmin)
 * 5. ✅ Image gallery with thumbnails
 * 
 * DATA FLOW:
 * - Receives productId from route
 * - Fetches product from AdminContext
 * - Displays all product details including images, price, color
 */

"use client"

import { ChevronLeft, Star, ShoppingBag, Heart, Share2, Ruler } from "lucide-react"
import { useState } from "react"
import { useCart } from "../context/CartContext"
import { useAdmin } from "../context/AdminContext"
import { RestockNotificationModal } from "./RestockNotificationModal"

interface ProductDetailPageProps {
  productId: number
  onNavigateBack: () => void
}

export function ProductDetailPage({ productId, onNavigateBack }: ProductDetailPageProps) {
  const { products, getProductStock } = useAdmin()
  
  // FIX: Load product from dynamic context
  const product = products.find((p) => p.id === productId)
  const { addToCart } = useCart()

  const [selectedSize, setSelectedSize] = useState<string>("")
  const [selectedColor, setSelectedColor] = useState<string>(product?.colors?.[0] || product?.color || "")
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showSizeChart, setShowSizeChart] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [showRestockModal, setShowRestockModal] = useState(false)

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg md:text-xl mb-4">Product not found</p>
          <button onClick={onNavigateBack} className="underline text-sm md:text-base hover:no-underline">
            Go back
          </button>
        </div>
      </div>
    )
  }

  const productStock = getProductStock(product.id)
  const currentSizeStock = productStock?.sizes?.[selectedSize] ?? 50
  const isOutOfStock = currentSizeStock === 0
  const isProductVisible = productStock?.isVisible ?? true

  const hasAnySizeInStock = product.sizes.some((size) => {
    const stock = productStock?.sizes?.[size] ?? 50
    return stock > 0
  })

  // FIX: Get primary image from product.images array
  const primaryImage = product.images && product.images.length > 0 ? product.images[currentImageIndex] : null

  const handleAddToCart = () => {
    if (selectedSize && !isOutOfStock) {
      addToCart(product, selectedSize)
      setAddedToCart(true)
      setTimeout(() => setAddedToCart(false), 2000)
    }
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-6 border-b border-neutral-200">
        <button onClick={onNavigateBack} className="flex items-center gap-2 text-xs md:text-sm hover:underline">
          <ChevronLeft className="w-4 h-4" />
          <span>BACK TO PRODUCTS</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-6 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
          {/* Left - Image Gallery */}
          <div className="space-y-3 md:space-y-4">
            {/* FIX: Main Image - Display actual product image */}
            <div className="aspect-3/4 bg-neutral-200 border border-neutral-300 rounded overflow-hidden">
              {primaryImage ? (
                <img 
                  src={primaryImage} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement
                    if (fallback) fallback.style.display = 'flex'
                  }}
                />
              ) : null}
              <div 
                className="w-full h-full flex items-center justify-center"
                style={{ display: primaryImage ? 'none' : 'flex' }}
              >
                <span className="text-xs md:text-sm text-neutral-500">{product.name}</span>
              </div>
            </div>

            {/* FIX: Thumbnail Images - Show actual product images */}
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`aspect-square bg-neutral-200 border-2 transition-colors rounded overflow-hidden ${
                      currentImageIndex === index ? "border-black" : "border-neutral-300"
                    }`}
                  >
                    <img 
                      src={image} 
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right - Product Details */}
          <div className="space-y-3 md:space-y-6">
            {/* FIX: Product Name & Price - Now visible */}
            <div>
              {product.label && (
                <span className="inline-block bg-black text-white px-2 md:px-3 py-1 text-xs tracking-wider mb-2 md:mb-3">
                  {product.label}
                </span>
              )}
              <h1 className="text-xl sm:text-2xl md:text-4xl tracking-wider mb-2 md:mb-3">{product.name}</h1>
              
              {/* FIX: Display price prominently */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-3 md:mb-4">
                <p className="text-xl md:text-3xl font-semibold">${product.price.toFixed(2)}</p>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3 h-3 md:w-4 md:h-4 ${
                          i < Math.floor(product.rating) ? "fill-black text-black" : "text-neutral-300"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs md:text-sm text-neutral-600">
                    {product.rating} ({product.reviews})
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              <p className="text-xs md:text-base text-neutral-700 leading-relaxed">{product.description}</p>
            </div>

            {/* FIX: Color Selection - Display colors */}
            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm tracking-wider font-semibold">
                  COLOR: {selectedColor || product.color || 'N/A'}
                </span>
              </div>
              {product.colors && product.colors.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-2 md:px-4 py-1.5 md:py-2 border text-xs md:text-sm tracking-wider transition-colors rounded ${
                        selectedColor === color
                          ? "border-black bg-black text-white"
                          : "border-neutral-300 hover:border-black"
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Size Selection */}
            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm tracking-wider font-semibold">
                  SIZE: {selectedSize || "SELECT SIZE"}
                </span>
                <button
                  onClick={() => setShowSizeChart(!showSizeChart)}
                  className="flex items-center gap-1 text-xs md:text-sm underline hover:no-underline"
                >
                  <Ruler className="w-3 h-3 md:w-4 md:h-4" />
                  SIZE GUIDE
                </button>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                {product.sizes.map((size) => {
                  const sizeStock = productStock?.sizes?.[size] ?? 50
                  const sizeOutOfStock = sizeStock === 0

                  return (
                    <button
                      key={size}
                      onClick={() => !sizeOutOfStock && setSelectedSize(size)}
                      disabled={sizeOutOfStock}
                      className={`py-2 md:py-3 border text-xs md:text-sm tracking-wider transition-colors rounded ${
                        sizeOutOfStock
                          ? "border-red-300 bg-red-50 text-red-400 cursor-not-allowed"
                          : selectedSize === size
                            ? "border-black bg-black text-white"
                            : "border-neutral-300 hover:border-black"
                      }`}
                      title={sizeOutOfStock ? `Size ${size} out of stock` : ""}
                    >
                      {size}
                      {sizeOutOfStock && <span className="block text-xs">OUT</span>}
                    </button>
                  )
                })}
              </div>
              {!selectedSize && <p className="text-xs text-red-600 mt-2">Please select a size</p>}
            </div>

            {/* Size Chart Modal */}
            {showSizeChart && (
              <div className="bg-neutral-50 border border-neutral-300 p-3 md:p-6 rounded overflow-x-auto">
                <h3 className="tracking-wider mb-4 text-xs md:text-base font-semibold">SIZE CHART</h3>
                <table className="w-full text-xs md:text-sm">
                  <thead>
                    <tr className="border-b border-neutral-300">
                      <th className="text-left py-2">SIZE</th>
                      <th className="text-left py-2">CHEST</th>
                      <th className="text-left py-2">LENGTH</th>
                      <th className="text-left py-2">SLEEVE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-neutral-200">
                      <td className="py-2">XS</td>
                      <td className="py-2">34-36</td>
                      <td className="py-2">27</td>
                      <td className="py-2">32</td>
                    </tr>
                    <tr className="border-b border-neutral-200">
                      <td className="py-2">S</td>
                      <td className="py-2">36-38</td>
                      <td className="py-2">28</td>
                      <td className="py-2">33</td>
                    </tr>
                    <tr className="border-b border-neutral-200">
                      <td className="py-2">M</td>
                      <td className="py-2">38-40</td>
                      <td className="py-2">29</td>
                      <td className="py-2">34</td>
                    </tr>
                    <tr className="border-b border-neutral-200">
                      <td className="py-2">L</td>
                      <td className="py-2">40-42</td>
                      <td className="py-2">30</td>
                      <td className="py-2">35</td>
                    </tr>
                    <tr>
                      <td className="py-2">XL</td>
                      <td className="py-2">42-44</td>
                      <td className="py-2">31</td>
                      <td className="py-2">36</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Add to Cart Button */}
            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              {!hasAnySizeInStock ? (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 p-3 md:p-4 rounded">
                    <p className="text-red-700 font-semibold text-sm md:text-base">Out of Stock</p>
                    <p className="text-red-600 text-xs md:text-sm">
                      This product is currently unavailable in all sizes
                    </p>
                  </div>
                  <button
                    onClick={() => setShowRestockModal(true)}
                    className="w-full py-2.5 md:py-4 border border-black text-black hover:bg-black hover:text-white transition-colors text-xs md:text-sm tracking-wider rounded-full font-semibold"
                  >
                    NOTIFY ME WHEN RESTOCKED
                  </button>
                </div>
              ) : isOutOfStock && selectedSize ? (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 p-3 md:p-4 rounded">
                    <p className="text-orange-700 font-semibold text-sm md:text-base">Out of Stock</p>
                    <p className="text-orange-600 text-xs md:text-sm">Size {selectedSize} is currently unavailable</p>
                  </div>
                  <button
                    onClick={() => setShowRestockModal(true)}
                    className="w-full py-2.5 md:py-4 border border-black text-black hover:bg-black hover:text-white transition-colors text-xs md:text-sm tracking-wider rounded-full font-semibold"
                  >
                    NOTIFY ME WHEN RESTOCKED
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 md:gap-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={!selectedSize}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 md:py-4 rounded-full text-xs md:text-sm tracking-wider transition-colors font-semibold ${
                      selectedSize
                        ? "bg-black text-white hover:bg-neutral-800"
                        : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {addedToCart ? "ADDED!" : "ADD TO CART"}
                  </button>
                  <button className="border border-black p-2.5 md:p-4 rounded-full hover:bg-black hover:text-white transition-colors">
                    <Heart className="w-5 h-5" />
                  </button>
                  <button className="border border-black p-2.5 md:p-4 rounded-full hover:bg-black hover:text-white transition-colors">
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Material Details */}
            {product.material && (
              <div className="border-t border-neutral-200 pt-3 md:pt-6">
                <h3 className="tracking-wider mb-2 md:mb-3 text-xs md:text-base font-semibold">
                  MATERIAL & CONSTRUCTION
                </h3>
                <p className="text-xs md:text-sm text-neutral-700 leading-relaxed">{product.material}</p>
              </div>
            )}

            {/* Wash Care */}
            {product.washCare && product.washCare.length > 0 && (
              <div className="border-t border-neutral-200 pt-3 md:pt-6">
                <h3 className="tracking-wider mb-2 md:mb-3 text-xs md:text-base font-semibold">CARE INSTRUCTIONS</h3>
                <ul className="space-y-1 md:space-y-2">
                  {product.washCare.map((instruction, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs md:text-sm text-neutral-700">
                      <span className="mt-0.5">•</span>
                      <span>{instruction}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasAnySizeInStock && (
              <div className="border-t border-neutral-200 pt-3 md:pt-6">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs md:text-sm text-neutral-600">In Stock - Ships within 1-2 business days</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restock Notification Modal */}
      <RestockNotificationModal
        productId={product.id}
        size={selectedSize}
        isOpen={showRestockModal}
        onClose={() => setShowRestockModal(false)}
      />
    </div>
  )
}
