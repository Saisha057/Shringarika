import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product } from '../data/products';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';

export interface CartItem {
  product: Product;
  size: string;
  color?: string;
  quantity: number;
  variantId?: string | null; // UUID from product_inventory table
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, size: string, color?: string) => void;
  removeFromCart: (productId: number, size: string) => void;
  updateQuantity: (productId: number, size: string, quantity: number) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getCartTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { user } = useAuth();
  const [hasSyncedCart, setHasSyncedCart] = useState(false);

  // P1-002 FIX: Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem('fashionCart', JSON.stringify(cart));
      console.log('💾 Cart saved to localStorage:', cart.length, 'items');
    }
  }, [cart]);

  // Load cart on mount - from backend if logged in, from localStorage if not
  useEffect(() => {
    const loadCart = async () => {
      if (user) {
        // User just logged in - preserve and merge guest cart
        const guestCart = localStorage.getItem('fashionCart');
        
        // First, fetch backend cart
        try {
          console.log("🛒 Loading cart from backend for user:", user.email);
          const response = await cartAPI.get();
          const backendCart = response?.data?.items || [];
          console.log("✅ Loaded", backendCart.length, "items from backend cart");
          
          // Merge guest cart with backend cart if guest had items
          if (guestCart && !hasSyncedCart) {
            try {
              const guestItems: CartItem[] = JSON.parse(guestCart);
              console.log("🔄 Found", guestItems.length, "items in guest cart - merging...");
              
              // Merge logic: Add guest items that aren't already in backend cart
              const mergedCart = [...backendCart];
              guestItems.forEach(guestItem => {
                const existsInBackend = backendCart.find(
                  (item: any) => item.product.id === guestItem.product.id && item.size === guestItem.size
                );
                if (!existsInBackend) {
                  mergedCart.push(guestItem);
                }
              });
              
              if (mergedCart.length > backendCart.length) {
                console.log("✅ Merged guest cart: Total", mergedCart.length, "items");
                setCart(mergedCart);
                // Sync merged cart to backend
                await cartAPI.syncLocalCart(mergedCart);
                setHasSyncedCart(true);
              } else {
                setCart(backendCart);
              }
            } catch (err) {
              console.error('Error merging carts:', err);
              setCart(backendCart);
            }
          } else {
            setCart(backendCart);
          }
        } catch (error: any) {
          // Silently fallback to localStorage for 401/500 errors
          if (error.response?.status === 401 || error.response?.status === 500) {
            console.log("⚠️ Backend cart unavailable, using localStorage");
          } else {
            console.error("❌ Error loading cart from backend:", error);
          }
          // Fallback to localStorage
          const savedCart = localStorage.getItem('fashionCart');
          if (savedCart) {
            try {
              const localCart = JSON.parse(savedCart);
              setCart(localCart);
            } catch (err) {
              console.error('Error loading local cart:', err);
              setCart([]);
            }
          } else {
            setCart([]);
          }
        }
      } else {
        // Not logged in - use localStorage
        setHasSyncedCart(false); // Reset sync flag when logged out
        const savedCart = localStorage.getItem('fashionCart');
        if (savedCart) {
          try {
            console.log("📦 Loading cart from localStorage (not logged in)");
            setCart(JSON.parse(savedCart));
          } catch (error) {
            console.error('Error loading cart:', error);
            setCart([]);
          }
        } else {
          setCart([]);
        }
      }
    };

    loadCart();
  }, [user]);

  // Save cart to localStorage for guest users
  useEffect(() => {
    if (!user) {
      localStorage.setItem('fashionCart', JSON.stringify(cart));
    }
  }, [cart, user]);

  const addToCart = async (product: Product, size: string, color?: string) => {
    // Fetch variant ID from product_inventory table (renamed to product_variants in backend)
    let variantId: string | null = null;
    try {
      const productId = typeof product.id === 'number' ? String(product.id) : product.id;
      const response = await fetch(`/api/products/${productId}/variants`);
      if (response.ok) {
        const data = await response.json();
        const variants = data.data || data;
        // Find variant matching selected size
        const matchingVariant = variants.find((v: any) => v.size === size && (!color || v.color === color));
        if (matchingVariant) {
          variantId = matchingVariant.id;
          console.log('✅ Found variant ID:', variantId, 'for size:', size);
        } else {
          console.warn('⚠️ No matching variant found for size:', size);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch variant ID:', error);
      // Continue without variant ID - backend will handle as null
    }

    const existingItem = cart.find(
      (item) => item.product.id === product.id && item.size === size && item.color === color
    );

    const newQuantity = existingItem ? existingItem.quantity + 1 : 1;

    // Update backend if user is logged in (fail silently if backend unavailable)
    if (user) {
      try {
        await cartAPI.add(
          product.id.toString(),
          1,
          size,
          color || undefined
        );
        console.log("✅ Item added to backend cart");
      } catch (error: any) {
        // Silently fail for 401/500 errors - cart will work locally
        if (error.response?.status === 401 || error.response?.status === 500) {
          console.log("⚠️ Backend cart unavailable, using local cart only");
        } else {
          console.error("❌ Error adding to backend cart:", error);
        }
        // Continue with local update even if backend fails
      }
    }

    // Update local state
    setCart((prevCart) => {
      if (existingItem) {
        return prevCart.map((item) =>
          item.product.id === product.id && item.size === size && item.color === color
            ? { ...item, quantity: item.quantity + 1, variantId }
            : item
        );
      }
      return [...prevCart, { product, size, color, quantity: 1, variantId }];
    });
  };

  const removeFromCart = async (productId: number, size: string) => {
    // Update backend if user is logged in (fail silently if backend unavailable)
    if (user) {
      try {
        const item = cart.find(i => i.product.id === productId && i.size === size);
        if (item) {
          // Backend expects itemId - use a combination of productId and size
          const itemId = `${productId}_${size}`;
          await cartAPI.remove(itemId);
          console.log("✅ Item removed from backend cart");
        }
      } catch (error: any) {
        // Silently fail for 401/500 errors - cart will work locally
        if (error.response?.status === 401 || error.response?.status === 500) {
          console.log("⚠️ Backend cart unavailable, removing from local cart only");
        } else {
          console.error("❌ Error removing from backend cart:", error);
        }
        // Continue with local update even if backend fails
      }
    }

    // Update local state
    setCart((prevCart) =>
      prevCart.filter((item) => !(item.product.id === productId && item.size === size))
    );
  };

  const updateQuantity = async (productId: number, size: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, size);
      return;
    }

    // Update backend if user is logged in (fail silently if backend unavailable)
    if (user) {
      try {
        const itemId = `${productId}_${size}`;
        await cartAPI.update(itemId, quantity);
        console.log("✅ Quantity updated in backend cart");
      } catch (error: any) {
        // Silently fail for 401/500 errors - cart will work locally
        if (error.response?.status === 401 || error.response?.status === 500) {
          console.log("⚠️ Backend cart unavailable, updating local cart only");
        } else {
          console.error("❌ Error updating quantity in backend:", error);
        }
        // Continue with local update even if backend fails
      }
    }

    // Update local state
    setCart((prevCart) =>
      prevCart.map((item) =>
        item.product.id === productId && item.size === size
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = async () => {
    // Clear backend cart if user is logged in (fail silently if backend unavailable)
    if (user) {
      try {
        await cartAPI.clear();
        console.log("✅ Backend cart cleared");
      } catch (error: any) {
        // Silently fail for 401/500 errors - cart will work locally
        if (error.response?.status === 401 || error.response?.status === 500) {
          console.log("⚠️ Backend cart unavailable, clearing local cart only");
        } else {
          console.error("❌ Error clearing backend cart:", error);
        }
      }
    }

    // Clear local state and localStorage
    setCart([]);
    localStorage.removeItem('fashionCart');
  };

  const getCartCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.product.price * item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartCount,
        getCartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
