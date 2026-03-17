import { ChevronLeft, Heart, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAdmin } from '../context/AdminContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

interface WishlistPageProps {
  onNavigateHome: () => void;
  onViewProduct: (productId: number) => void;
}

interface WishlistItem {
  id: number;
  name: string;
  price: number;
  image?: string;
  category?: string;
}

export function WishlistPage({ onNavigateHome, onViewProduct }: WishlistPageProps) {
  const { products } = useAdmin();
  const { addToCart } = useCart();
  const { user } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [addedToCart, setAddedToCart] = useState<number | null>(null);

  // Helper function to get user-specific wishlist key
  const getWishlistKey = () => {
    return user?.id ? `fashionWishlist_${user.id}` : 'fashionWishlist_guest';
  };

  useEffect(() => {
    // CRITICAL SECURITY: Load user-specific wishlist ONLY - NO CROSS-ACCOUNT ACCESS
    console.log('🔒 DATA ISOLATION CHECK - Wishlist Page');
    console.log('  User ID:', user?.id || 'NONE (not authenticated)');
    
    if (!user?.id) {
      console.warn('⚠️ SECURITY: No user logged in - wishlist access denied');
      setWishlistItems([]);
      return;
    }

    const wishlistKey = getWishlistKey();
    const savedWishlist = localStorage.getItem(wishlistKey);
    console.log('✅ Loading wishlist for authenticated user:', user.id);
    console.log('  Storage Key:', wishlistKey);
    
    if (savedWishlist) {
      try {
        const parsedWishlist = JSON.parse(savedWishlist);
        setWishlistItems(Array.isArray(parsedWishlist) ? parsedWishlist : []);
        console.log('✅ Loaded', parsedWishlist.length, 'items from wishlist');
      } catch (_) {
        console.warn('⚠️ Wishlist data corrupted — resetting');
        localStorage.removeItem(wishlistKey);
        setWishlistItems([]);
      }
    } else {
      setWishlistItems([]);
      console.log('📭 Wishlist is empty for this user');
    }
  }, [user?.id]);

  const removeFromWishlist = (productId: number) => {
    if (!user?.id) {
      console.log('⚠️ Cannot remove from wishlist - no user logged in');
      return;
    }

    const updatedWishlist = wishlistItems.filter(item => item.id !== productId);
    setWishlistItems(updatedWishlist);
    const wishlistKey = getWishlistKey();
    localStorage.setItem(wishlistKey, JSON.stringify(updatedWishlist));
    console.log('🗑️ Removed product', productId, 'from wishlist for user:', user.id);
  };

  const handleAddToCart = (productId: number) => {
    const fullProduct = products.find(p => p.id === productId);
    if (!fullProduct) return;

    // Check if product has sizes or colors
    const hasSizes = fullProduct.sizes && fullProduct.sizes.length > 0;
    const hasColors = (fullProduct.colors && fullProduct.colors.length > 0) || fullProduct.color;

    // If already showing selection for this product
    if (selectedProduct === productId) {
      // Validate selections
      if (hasSizes && !selectedSize) {
        alert('Please select a size');
        return;
      }
      if (hasColors && !selectedColor) {
        alert('Please select a color');
        return;
      }

      // Add to cart — pass selectedColor so the correct variant is tracked
      addToCart(fullProduct, selectedSize || 'One Size', selectedColor || undefined);
      setAddedToCart(productId);
      setTimeout(() => {
        setAddedToCart(null);
        setSelectedProduct(null);
        setSelectedSize('');
        setSelectedColor('');
      }, 2000);
    } else {
      // Show size/color selection
      if (hasSizes || hasColors) {
        setSelectedProduct(productId);
        setSelectedSize('');
        setSelectedColor(hasColors ? (fullProduct.colors?.[0] || fullProduct.color || '') : '');
      } else {
        // No size/color needed, add directly
        addToCart(fullProduct, 'One Size', undefined);
        setAddedToCart(productId);
        setTimeout(() => setAddedToCart(null), 2000);
      }
    }
  };

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <button 
            onClick={onNavigateHome}
            className="flex items-center gap-2 text-sm hover:underline mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>BACK TO HOME</span>
          </button>
          
          <h1 className="text-5xl tracking-wider mb-2">MY WISHLIST</h1>
          <p className="text-neutral-600">
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved for later
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        {wishlistItems.length === 0 ? (
          <div className="text-center py-20">
            <Heart className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
            <h2 className="text-2xl tracking-wider mb-2">YOUR WISHLIST IS EMPTY</h2>
            <p className="text-neutral-600 mb-6">
              Save items you love to your wishlist
            </p>
            <button
              onClick={onNavigateHome}
              className="bg-black text-white px-8 py-3 rounded-full text-sm tracking-wider hover:bg-neutral-800 transition-colors"
            >
              START SHOPPING
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlistItems.map((product) => {
              const fullProduct = products.find(p => String(p.id) === String(product.id));
              // After products have loaded, a missing fullProduct means the product was deleted
              const isUnavailable = products.length > 0 && !fullProduct;
              const showSelection = selectedProduct === product.id;
              const hasSizes = fullProduct?.sizes && fullProduct.sizes.length > 0;
              const hasColors = (fullProduct?.colors && fullProduct.colors.length > 0) || fullProduct?.color;
              // Use live product data where available, fall back to stored snapshot
              const displayName = fullProduct?.name || product.name;
              const displayPrice = fullProduct?.price ?? (fullProduct?.base_price ?? product.price);
              const displayImage = fullProduct?.images?.[0] || fullProduct?.primary_image || product.image;
              
              return (
                <div key={product.id} className="group">
                  <div 
                    className="relative bg-neutral-100 aspect-3/4 mb-3 overflow-hidden rounded-lg cursor-pointer"
                    onClick={() => onViewProduct(product.id)}
                  >
                    {product.image ? (
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.parentElement?.querySelector('.fallback-text') as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="fallback-text absolute inset-0 flex items-center justify-center"
                      style={{ display: product.image ? 'none' : 'flex' }}
                    >
                      <span className="text-neutral-400 text-sm">No Image</span>
                    </div>
                    {/* Remove Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromWishlist(product.id);
                      }}
                      className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center hover:bg-red-50 transition-colors shadow-lg z-10"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                  
                  <h3 
                    className="text-sm tracking-wider mb-1 group-hover:underline cursor-pointer"
                    onClick={() => !isUnavailable && onViewProduct(product.id)}
                  >
                    {displayName}
                  </h3>
                  <p className="text-base mb-3">₹{Number(displayPrice || 0).toFixed(2)}</p>
                  
                  {/* Size Selection */}
                  {showSelection && hasSizes && fullProduct && (
                    <div className="mb-3">
                      <p className="text-xs tracking-wider mb-2">SELECT SIZE:</p>
                      <div className="flex flex-wrap gap-2">
                        {fullProduct.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setSelectedSize(size)}
                            className={`px-3 py-1 text-xs border rounded ${
                              selectedSize === size
                                ? 'bg-black text-white border-black'
                                : 'border-neutral-300 hover:border-black'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Color Selection */}
                  {showSelection && hasColors && fullProduct && (
                    <div className="mb-3">
                      <p className="text-xs tracking-wider mb-2">SELECT COLOR:</p>
                      <div className="flex flex-wrap gap-2">
                        {(fullProduct.colors || [fullProduct.color]).filter(Boolean).map((color) => (
                          <button
                            key={color}
                            onClick={() => setSelectedColor(color || '')}
                            className={`px-3 py-1 text-xs border rounded capitalize ${
                              selectedColor === color
                                ? 'bg-black text-white border-black'
                                : 'border-neutral-300 hover:border-black'
                            }`}
                          >
                            {color}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => !isUnavailable && handleAddToCart(product.id)}
                    disabled={isUnavailable}
                    className={`w-full py-2 rounded-full text-sm tracking-wider transition-colors ${
                      isUnavailable
                        ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                        : addedToCart === product.id
                          ? 'bg-green-600 text-white'
                          : 'bg-black text-white hover:bg-neutral-800'
                    }`}
                  >
                    {isUnavailable ? 'UNAVAILABLE' : addedToCart === product.id ? '✓ ADDED!' : showSelection ? 'CONFIRM & ADD TO CART' : 'ADD TO CART'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
