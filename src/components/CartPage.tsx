"use client"

import { ChevronLeft, Plus, Minus, Trash2 } from "lucide-react"
import { useCart } from "../context/CartContext"

interface CartPageProps {
  onNavigateHome: () => void
  onContinueShopping: () => void
  onProceedToCheckout: () => void
}

export function CartPage({ onNavigateHome, onContinueShopping, onProceedToCheckout }: CartPageProps) {
  const { cart, removeFromCart, updateQuantity, getCartTotal, clearCart } = useCart()

  const subtotal = getCartTotal()
  const shipping = subtotal > 150 ? 0 : 10
  const total = subtotal + shipping

  if (cart.length === 0) {
    return (
      <div className="bg-white min-h-screen">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-6 md:py-12">
          <div className="text-center py-12 md:py-20">
            <h1 className="text-2xl sm:text-3xl md:text-4xl tracking-wider mb-3 md:mb-4">YOUR CART IS EMPTY</h1>
            <p className="text-xs md:text-base text-neutral-600 mb-6 md:mb-8">Add some items to get started</p>
            <button
              onClick={onContinueShopping}
              className="bg-black text-white px-6 md:px-8 py-2 md:py-3 rounded-full text-xs md:text-sm tracking-wider hover:bg-neutral-800 transition-colors"
            >
              CONTINUE SHOPPING
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-4 md:py-6 border-b border-neutral-200">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-xs md:text-sm hover:underline mb-3 md:mb-4"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>BACK TO HOME</span>
        </button>
        <h1 className="text-2xl sm:text-3xl md:text-4xl tracking-wider">SHOPPING CART</h1>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-6 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 lg:gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4 md:space-y-6">
            {cart.map((item) => {
              // Get product image from images array
              const productImage = item.product.images && item.product.images.length > 0 
                ? item.product.images[0] 
                : null

              return (
              <div
                key={`${item.product.id}-${item.size}`}
                className="flex gap-3 md:gap-6 pb-4 md:pb-6 border-b border-neutral-200"
              >
                {/* Product Image */}
                <div className="w-20 h-28 md:w-32 md:h-40 bg-neutral-200 border border-neutral-300 shrink-0 rounded overflow-hidden">
                  {productImage ? (
                    <img 
                      src={productImage} 
                      alt={item.product.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  {!productImage && (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-xs text-neutral-500">No Image</span>
                    </div>
                  )}
                  <div 
                    className="w-full h-full flex items-center justify-center absolute inset-0"
                    style={{ display: 'none' }}
                  >
                    <span className="text-xs text-neutral-500">No Image</span>
                  </div>
                </div>

                {/* Product Details */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="tracking-wider text-xs md:text-base mb-1 line-clamp-2">{item.product.name}</h3>
                    <p className="text-xs md:text-sm text-neutral-600 mb-1 md:mb-2">
                      {item.product.color} / Size: {item.size}
                    </p>
                    <p className="text-sm md:text-lg font-semibold">₹{Number(item.product.price || 0).toFixed(2)}</p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                    <div className="flex items-center border border-neutral-300 rounded">
                      <button
                        onClick={() => updateQuantity(item.product.id, item.size, Math.max(0, item.quantity - 1))}
                        className="p-1 md:p-2 hover:bg-neutral-100 transition-colors"
                      >
                        <Minus className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                      <span className="px-2 md:px-4 text-xs md:text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.product.id, item.size, item.quantity + 1)}
                        className="p-1 md:p-2 hover:bg-neutral-100 transition-colors"
                      >
                        <Plus className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id, item.size)}
                      className="text-xs md:text-sm text-red-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>

                {/* Item Total */}
                <div className="text-right shrink-0">
                  <p className="text-sm md:text-lg font-semibold">₹{(Number(item.product.price) * item.quantity).toFixed(2)}</p>
                </div>
              </div>
            )})}

            {/* Clear Cart */}
            <button
              onClick={clearCart}
              className="text-xs md:text-sm text-neutral-600 hover:text-black hover:underline"
            >
              Clear all items
            </button>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="border border-neutral-300 rounded-lg p-4 md:p-6 sticky top-24">
              <h2 className="text-lg md:text-2xl tracking-wider mb-4 md:mb-6">ORDER SUMMARY</h2>

              <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-neutral-600">Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs md:text-sm">
                  <span className="text-neutral-600">Shipping</span>
                  <span>{shipping === 0 ? "FREE" : `₹${shipping.toFixed(2)}`}</span>
                </div>
                {subtotal < 150 && (
                  <p className="text-xs text-neutral-500">Add ₹{(150 - subtotal).toFixed(2)} more for free shipping</p>
                )}
                <div className="border-t border-neutral-300 pt-3 md:pt-4 flex justify-between">
                  <span className="tracking-wider text-xs md:text-base">TOTAL</span>
                  <span className="text-lg md:text-xl font-semibold">₹{total.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={onProceedToCheckout}
                className="w-full bg-black text-white py-2.5 md:py-4 rounded-full text-xs md:text-sm tracking-wider hover:bg-neutral-800 transition-colors mb-2 md:mb-3"
              >
                PROCEED TO CHECKOUT
              </button>

              <button
                onClick={onContinueShopping}
                className="w-full border border-black py-2.5 md:py-4 rounded-full text-xs md:text-sm tracking-wider hover:bg-black hover:text-white transition-colors"
              >
                CONTINUE SHOPPING
              </button>

              {/* Additional Info */}
              <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-neutral-200 space-y-2 md:space-y-3 text-xs text-neutral-600">
                <div className="flex items-start gap-2">
                  <span className="shrink-0">✓</span>
                  <span>Free returns within 30 days</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0">✓</span>
                  <span>Secure checkout</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="shrink-0">✓</span>
                  <span>Ships within 1-2 business days</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
