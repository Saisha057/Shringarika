"use client"

import { ChevronLeft, Star, ShoppingBag, Heart, Share2, Ruler, AlertTriangle } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useCart } from "../context/CartContext"
import { useAdmin } from "../context/AdminContext"
import { useAuth } from "../context/AuthContext"
import { RestockNotificationModal } from "./RestockNotificationModal"
import { ProductReviews } from "./ProductReviews"
import { OptimizedImage } from "./OptimizedImage"
import { useRecentlyViewed } from "../hooks/useRecentlyViewed"
import { SizeRecommendation } from "./SizeRecommendation"
import { ShippingCalculator } from './ShippingCalculator';
import { StockStatus, StockIndicator } from './StockStatus';
import { useVariantStock } from '../hooks/useVariantStock';

interface ProductDetailPageProps {
  productId: number
  onNavigateBack: () => void
  onNavigateToCart?: () => void
}

export function ProductDetailPage({ productId, onNavigateBack, onNavigateToCart }: ProductDetailPageProps) {
  const { products, getProductStock } = useAdmin()
  const product = products.find((p) => p.id === productId)
  const { addToCart, cart } = useCart()
  const { user } = useAuth()
  const { addToRecentlyViewed } = useRecentlyViewed()

  // Initialize real-time stock management
  const { stockMap, getStock, isLowStock: checkLowStock } = useVariantStock(product?.id || 0)

  // NEW: Add state for dynamically fetched variants
  const [availableColors, setAvailableColors] = useState<string[]>([])
  const [availableSizes, setAvailableSizes] = useState<string[]>([])
  const [variantsLoading, setVariantsLoading] = useState<boolean>(false)

  const [selectedSize, setSelectedSize] = useState<string>("")
  // FIX: Initialize color from dynamic colors or fallback
  const [selectedColor, setSelectedColor] = useState<string>("")
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showSizeChart, setShowSizeChart] = useState(false)
  const [showSizeRecommendation, setShowSizeRecommendation] = useState(false)
  const [addedToCart, setAddedToCart] = useState(false)
  const [showRestockModal, setShowRestockModal] = useState(false)
  const [isInWishlist, setIsInWishlist] = useState(false)
  const [realTimeStock, setRealTimeStock] = useState<{inStock: boolean; available: number} | null>(null)

  // Helper function to get user-specific wishlist key
  const getWishlistKey = () => {
    return user?.id ? `fashionWishlist_${user.id}` : 'fashionWishlist_guest';
  };

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

  // Use real-time stock status instead of admin context
  const isOutOfStock = realTimeStock ? !realTimeStock.inStock : false
  const currentSizeStock = realTimeStock ? realTimeStock.available : 0

  // Check if this product (+ selected size) is already in the cart
  const isInCart = cart.some(
    item => String(item.product.id) === String(product.id) &&
            (!selectedSize || item.size === selectedSize)
  )

  // Admin-context stock snapshot for product (used as fallback)
  const productStock = getProductStock(product.id)

  // Determine if any size for this product has stock according to admin snapshot
  const hasAnySizeInStock = availableSizes.length > 0 ? availableSizes.some((size) => {
    const qty = productStock?.sizes?.[size]
    // If admin snapshot missing, assume available (to avoid false out-of-stock)
    return (typeof qty === 'number' ? qty : 50) > 0
  }) : true

  // Fetch available colors and sizes from product_inventory
  const fetchDynamicVariants = useCallback(async () => {
    if (!product?.id) return;

    try {
      setVariantsLoading(true);
      
      // Validate product ID format
      const productIdStr = String(product.id);
      console.log('🔍 Fetching variants for product:', productIdStr);
      
      const response = await fetch(`/api/products/${productIdStr}/variants-dynamic`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 Variants API response status:', response.status);

      if (!response.ok) {
        console.warn('⚠️ Variants API failed, using fallback');
        // Fallback to static product data — normalize case before dedup
        const toTitleCase = (s: string) => s.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase());
        const fallbackColors = [...new Set((product.colors || []).map(toTitleCase))];
        const normalizedPrimary = product.color ? toTitleCase(product.color) : '';
        setAvailableColors(normalizedPrimary && !fallbackColors.includes(normalizedPrimary) ? [normalizedPrimary, ...fallbackColors] : fallbackColors);
        setAvailableSizes(product.sizes || []);
        setVariantsLoading(false);
        return;
      }

      const data = await response.json();
      console.log('✅ Variants data received:', data);

      if (data.status === 'success') {
        // Normalize to Title Case so "green" and "Green" are treated as the same color
        const toTitleCase = (s: string) => s.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase());

        // Merge inventory colors with product.colors, normalize each, then deduplicate
        const inventoryColors = Array.isArray(data.data?.colors) ? data.data.colors : [];
        const productColors = Array.isArray(product.colors) ? product.colors : [];
        const allColors = [...inventoryColors, ...productColors].map(toTitleCase);
        let colors = [...new Set(allColors)];
        
        // Ensure primary color is always included (normalized)
        const normalizedPrimary = product.color ? toTitleCase(product.color) : '';
        if (normalizedPrimary && !colors.includes(normalizedPrimary)) {
          colors = [normalizedPrimary, ...colors];
        }
        
        const inventorySizes = Array.isArray(data.data?.sizes) ? data.data.sizes : [];
        const productSizes = Array.isArray(product.sizes) ? product.sizes : [];
        const sizes = [...new Set([...inventorySizes, ...productSizes])];
        
        setAvailableColors(colors);
        setAvailableSizes(sizes);
        
        // Set initial selected color to primary color if available
        if (!selectedColor) {
          const initialColor = product.color || colors[0] || '';
          setSelectedColor(initialColor);
        }
        
        console.log('✅ Fetched dynamic variants:', colors, sizes);
      }
    } catch (err) {
      console.error('❌ Error fetching dynamic variants:', err);
      // Fallback to product static arrays if API fails
      const toTitleCaseFallback = (s: string) => s.trim().replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase());
      const rawFallback = (product?.colors || []).map(toTitleCaseFallback);
      const normalizedPrimaryFallback = product?.color ? toTitleCaseFallback(product.color) : '';
      let fallbackColors = [...new Set(rawFallback)];
      if (normalizedPrimaryFallback && !fallbackColors.includes(normalizedPrimaryFallback)) {
        fallbackColors = [normalizedPrimaryFallback, ...fallbackColors];
      }
      setAvailableColors(fallbackColors);
      setAvailableSizes(product?.sizes || []);
      
      if (!selectedColor) {
        const fallbackColor = normalizedPrimaryFallback || fallbackColors[0] || '';
        setSelectedColor(fallbackColor);
      }
    } finally {
      setVariantsLoading(false);
    }
  }, [product?.id, product?.colors, product?.sizes, product?.color, selectedColor]);

  // Handle stock status changes from StockIndicator
  const handleStockStatusChange = (inStock: boolean, available: number) => {
    setRealTimeStock({ inStock, available })
  }

  // FIX: Get primary image from product.images array
  const primaryImage = product.images && product.images.length > 0 ? product.images[currentImageIndex] : null

  // Check if product is in wishlist on mount
  useEffect(() => {
    if (!user?.id || !product?.id) {
      setIsInWishlist(false);
      return;
    }

    const wishlistKey = getWishlistKey();
    const wishlist = JSON.parse(localStorage.getItem(wishlistKey) || '[]')
    const isInList = wishlist.some((item: any) => item.id === product.id)
    setIsInWishlist(isInList)
    console.log('💚 Wishlist check for user', user.id, '- Product', product.id, 'in wishlist:', isInList);
    
    // Add to recently viewed
    addToRecentlyViewed(product, user?.id);

    // NEW: Fetch dynamic variants on mount
    fetchDynamicVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, user?.id])

  // NEW: Refetch variants when stockMap changes (real-time updates)
  useEffect(() => {
    if (stockMap) {
      fetchDynamicVariants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockMap]);

  const handleAddToCart = () => {
    // Check color selection first
    if (!selectedColor) {
      alert('Please select a color first');
      return;
    }
    
    // Check real-time stock before adding to cart
    if (!selectedSize) {
      alert('Please select a size');
      return;
    }
    
    // Get real-time stock for selected variant
    const variantStock = getStock(selectedSize, selectedColor)
    
    // FALLBACK: If real-time API fails, use admin context stock
    let stock = variantStock?.stock
    if (stock === undefined || stock === null) {
      const adminStock = productStock?.sizes?.[selectedSize]
      stock = typeof adminStock === 'number' ? adminStock : 50
    }
    
    const isOutOfStock = stock === 0
    
    if (isOutOfStock) {
      alert('This item is currently out of stock');
      setShowRestockModal(true);
      return;
    }

    addToCart(product, selectedSize, selectedColor)
    setAddedToCart(true)
    setTimeout(() => setAddedToCart(false), 2000)
  }

  const handleWishlist = () => {
    if (!user?.id) {
      alert('Please login to add items to your wishlist');
      return;
    }

    const wishlistKey = getWishlistKey();
    const wishlist = JSON.parse(localStorage.getItem(wishlistKey) || '[]')
    
    if (isInWishlist) {
      // Remove from wishlist
      const updatedWishlist = wishlist.filter((item: any) => item.id !== product.id)
      localStorage.setItem(wishlistKey, JSON.stringify(updatedWishlist))
      setIsInWishlist(false)
      console.log('❤️‍🩹 Removed product', product.id, 'from wishlist for user:', user.id);
    } else {
      // Add to wishlist
      wishlist.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: primaryImage,
        category: product.category
      })
      localStorage.setItem(wishlistKey, JSON.stringify(wishlist))
      setIsInWishlist(true)
      console.log('💚 Added product', product.id, 'to wishlist for user:', user.id);
    }
  }

  const handleShare = async () => {
    const productUrl = `${window.location.origin}${window.location.pathname}?product=${product.id}`
    const shareData = {
      title: product.name,
      text: `Check out ${product.name} on SHRINGARIKA - ₹${product.price}`,
      url: productUrl
    }

    // Check if Web Share API is supported
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        // User cancelled or error occurred, fallback to copy
        copyToClipboard(productUrl)
      }
    } else {
      // Fallback: Copy to clipboard
      copyToClipboard(productUrl)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Product link copied to clipboard! You can now paste and share it.')
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        alert('Product link copied to clipboard! You can now paste and share it.')
      } catch (err) {
        alert('Failed to copy link. Please copy manually: ' + text)
      }
      document.body.removeChild(textArea)
    })
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-6 border-b border-neutral-200">
        <button onClick={onNavigateBack} className="flex items-center gap-1 text-xs sm:text-sm tracking-wider text-neutral-600 hover:text-black py-2 px-0">
          <ChevronLeft className="w-4 h-4" />
          <span>BACK TO PRODUCTS</span>
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-6 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
          {/* Left - Image Gallery */}
          <div className="space-y-3 md:space-y-4">
            {/* FIX: Main Image - Display actual product image with proper fitting */}
            <div className="w-full aspect-3/4 sm:aspect-3/4 md:aspect-4/5 bg-neutral-100 border border-neutral-300 rounded-sm overflow-hidden">
              {primaryImage ? (
                <OptimizedImage
                  src={primaryImage}
                  alt={product.name}
                  className="w-full h-full"
                  imageClassName="bg-white block p-2"
                  lazy={false}
                  priority={true}
                  responsive={false}
                  objectFit="contain"
                  placeholder="color"
                  placeholderColor="#ffffff"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xs md:text-sm text-neutral-500">{product.name}</span>
                </div>
              )}
            </div>

            {/* FIX: Thumbnail Images - Show actual product images */}
            {product.images && product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`aspect-square bg-neutral-100 border-2 transition-colors rounded overflow-hidden ${
                      currentImageIndex === index ? "border-black" : "border-neutral-300"
                    }`}
                  >
                    <OptimizedImage
                      src={image}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full"
                      imageClassName="bg-white block p-1"
                      lazy={index !== 0}
                      priority={index === 0}
                      responsive={false}
                      objectFit="contain"
                      placeholder="color"
                      placeholderColor="#ffffff"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right - Product Details */}
          <div className="space-y-3 md:space-y-6">
            {/* Product Name & Price */}
            <div>
              {product.label && (
                <span className="inline-block bg-black text-white px-2 md:px-3 py-1 text-xs tracking-wider mb-2 md:mb-3">
                  {product.label}
                </span>
              )}
              <h1 className="text-xl sm:text-2xl md:text-3xl font-medium tracking-wider mt-3 sm:mt-4 mb-2 md:mb-3">{product.name}</h1>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-3 md:mb-4">
                <p className="text-lg sm:text-xl md:text-2xl font-bold mt-1 sm:mt-2">₹{Number(product.price || 0).toFixed(2)}</p>
                {/* Only show rating if there are actual customer reviews */}
                {product.reviews > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 md:w-4 md:h-4 ${
                            product.rating && i < Math.floor(product.rating) ? "fill-black text-black" : "text-neutral-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs md:text-sm text-neutral-600">
                      {product.rating} ({product.reviews})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              <p className="text-xs md:text-base text-neutral-700 leading-relaxed">{product.description}</p>
            </div>

            {/* FIX: Color Selection - Display colors dynamically from product_inventory */}
            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm tracking-wider font-semibold">
                  COLOR: {selectedColor || 'SELECT COLOR'}
                </span>
              </div>
              {availableColors.length > 0 ? (
                <div className="flex gap-2 flex-wrap">
                  {availableColors.map((color) => (
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
              ) : variantsLoading ? (
                <div className="text-sm text-neutral-500">Loading colors...</div>
              ) : (
                <div className="text-sm text-neutral-500">No colors available</div>
              )}
            </div>

            {/* Size Selection */}
            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs md:text-sm tracking-wider font-semibold">
                  SIZE: {selectedSize || "SELECT SIZE"}
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSizeRecommendation(true)}
                    className="flex items-center gap-1 text-xs md:text-sm bg-black text-white px-3 py-1 rounded hover:bg-neutral-800 transition-colors"
                  >
                    <Ruler className="w-3 h-3 md:w-4 md:h-4" />
                    FIND MY SIZE
                  </button>
                  <button
                    onClick={() => setShowSizeChart(!showSizeChart)}
                    className="flex items-center gap-1 text-xs md:text-sm underline hover:no-underline"
                  >
                    <Ruler className="w-3 h-3 md:w-4 md:h-4" />
                    SIZE CHART
                  </button>
                </div>
              </div>

              {/* Low Stock Warning Banner - Shows when ANY variant is low */}
              {selectedColor && availableSizes.some(size => checkLowStock(size, selectedColor)) && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <p className="text-sm text-red-700 font-medium">
                    Hurry! Only a few stocks left!
                  </p>
                </div>
              )}

              <div className="grid grid-cols-4 md:grid-cols-5 gap-2">
                {variantsLoading ? (
                  <div className="col-span-4 md:col-span-5 text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
                    <p className="text-sm text-neutral-500 mt-2">Loading sizes...</p>
                  </div>
                ) : availableSizes.length > 0 ? (
                  availableSizes.map((size) => {
                    const variantStock = getStock(size, selectedColor)
                    
                    // FALLBACK: If real-time API fails, use admin context stock
                    let stock = variantStock?.stock
                    if (stock === undefined || stock === null) {
                      const adminStock = productStock?.sizes?.[size]
                      stock = typeof adminStock === 'number' ? adminStock : 50
                    }
                    
                    const isLowStock = stock <= 5
                    const isOutOfStock = stock === 0
                    const isDisabled = !selectedColor || isOutOfStock

                    return (
                      <div key={size} className="flex flex-col gap-1">
                        <button
                          onClick={() => !isDisabled && setSelectedSize(size)}
                          disabled={isDisabled}
                          className={`py-2 md:py-3 border text-xs md:text-sm tracking-wider transition-colors rounded ${
                            !selectedColor
                              ? "border-neutral-200 bg-neutral-50 text-neutral-400 cursor-not-allowed"
                              : isOutOfStock
                                ? "border-red-300 bg-red-50 text-red-400 cursor-not-allowed opacity-60"
                                : selectedSize === size
                                  ? "border-black bg-black text-white"
                                  : "border-neutral-300 hover:border-black"
                          }`}
                          title={
                            !selectedColor
                              ? 'Please select a color first'
                              : isOutOfStock
                                ? `Size ${size} is out of stock`
                                : ''
                          }
                        >
                          {size}
                          {isOutOfStock && <span className="block text-[10px]">OUT</span>}
                        </button>
                        
                        {/* Stock Count - Show only when low stock (≤5) and not out of stock */}
                        {selectedColor && !isOutOfStock && isLowStock && (
                          <div className="text-center">
                            <span className="text-xs text-red-600 font-medium">
                              Only {stock} left
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="col-span-4 md:col-span-5 text-center py-4 text-sm text-neutral-500">
                    No sizes available
                  </div>
                )}
              </div>
              {!selectedColor && <p className="text-xs text-orange-600 mt-2">⚠️ Please select a color first</p>}
              {selectedColor && !selectedSize && <p className="text-xs text-red-600 mt-2">Please select a size</p>}
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

            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              {/* Check if selected variant is out of stock using real-time data */}
              {selectedSize && selectedColor && getStock(selectedSize, selectedColor)?.stock === 0 ? (
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 p-3 md:p-4 rounded">
                    <p className="text-orange-700 font-semibold text-sm md:text-base">Out of Stock</p>
                    <p className="text-orange-600 text-xs md:text-sm">
                      Size {selectedSize} in {selectedColor} is currently unavailable
                    </p>
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
                    onClick={isInCart ? () => onNavigateToCart?.() : handleAddToCart}
                    disabled={!isInCart && !selectedSize}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 md:py-4 rounded-full text-xs md:text-sm tracking-wider transition-colors font-semibold ${
                      isInCart
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : selectedSize
                          ? "bg-black text-white hover:bg-neutral-800"
                          : "bg-neutral-300 text-neutral-500 cursor-not-allowed"
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    {isInCart ? "GO TO CART" : (addedToCart ? "ADDED!" : "ADD TO CART")}
                  </button>
                  <button 
                    onClick={handleWishlist}
                    className={`border p-2.5 md:p-4 rounded-full transition-colors ${
                      isInWishlist 
                        ? "bg-black text-white border-black" 
                        : "border-black hover:bg-black hover:text-white"
                    }`}
                    title={isInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <Heart className={`w-5 h-5 ${isInWishlist ? "fill-current" : ""}`} />
                  </button>
                  <button 
                    onClick={handleShare}
                    className="border border-black p-2.5 md:p-4 rounded-full hover:bg-black hover:text-white transition-colors"
                    title="Share product"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Material Details */}
            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              <h3 className="tracking-wider mb-2 md:mb-3 text-xs md:text-base font-semibold">
                MATERIAL & CONSTRUCTION
              </h3>
              <p className="text-xs md:text-sm text-neutral-700 leading-relaxed">{product.material}</p>
            </div>

            {/* Wash Care */}
            <div className="border-t border-neutral-200 pt-3 md:pt-6">
              <h3 className="tracking-wider mb-2 md:mb-3 text-xs md:text-base font-semibold">CARE INSTRUCTIONS</h3>
              <ul className="space-y-1 md:space-y-2">
                {product.washCare && product.washCare.map((instruction, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs md:text-sm text-neutral-700">
                    <span className="mt-0.5">•</span>
                    <span>{instruction}</span>
                  </li>
                ))}
              </ul>
            </div>

            {hasAnySizeInStock && (
              <div className="border-t border-neutral-200 pt-3 md:pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs md:text-sm text-neutral-600">In Stock - Ships within 1-2 business days</span>
                </div>
                
                {/* Shipping Calculator */}
                <ShippingCalculator 
                  cartValue={Number(product.price) || 0}
                  weight={0.5}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Reviews Section */}
      <div className="max-w-7xl mx-auto px-4">
        <ProductReviews productId={product.id} />
      </div>

      {/* Restock Notification Modal */}
      <RestockNotificationModal
        productId={product.id}
        size={selectedSize}
        isOpen={showRestockModal}
        onClose={() => setShowRestockModal(false)}
      />

      {/* Size Recommendation Modal */}
      {showSizeRecommendation && (
        <SizeRecommendation
          productCategory={product.category}
          onClose={() => setShowSizeRecommendation(false)}
          onSizeSelect={(size) => setSelectedSize(size)}
        />
      )}
    </div>
  )
}
