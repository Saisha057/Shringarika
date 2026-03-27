import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product } from '../data/products';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';
import {
  addToGuestCart,
  clearGuestCart,
  getGuestCart,
  GuestCartItem,
  removeFromGuestCart,
  updateGuestCartQuantity,
} from '../utils/cartStorage';

export interface CartItem {
  product: Product;
  size: string;
  color?: string;
  quantity: number;
  variantId?: string | null; // UUID from product_inventory table
}

type ProductId = string | number;

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, size: string, color?: string) => void;
  removeFromCart: (productId: ProductId, size: string) => void;
  updateQuantity: (productId: ProductId, size: string, quantity: number) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getCartTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const { user } = useAuth();

  const toGuestCartItem = (item: CartItem): GuestCartItem => ({
    productId: String(item.product.id),
    variantId: item.variantId ?? null,
    quantity: item.quantity,
    price: Number(item.product.price || 0),
    name: item.product.name || 'Product',
    image: item.product.images?.[0] || '',
    color: item.color || item.product.color || '',
    size: item.size,
  });

  const guestToCartItem = (item: GuestCartItem): CartItem => ({
    product: {
      id: item.productId,
      name: item.name,
      price: item.price,
      color: item.color,
      category: 'general',
      images: item.image ? [item.image] : [],
      sizes: item.size ? [item.size] : [],
    },
    size: item.size,
    color: item.color,
    quantity: item.quantity,
    variantId: item.variantId,
  });

  const normalizeServerItem = (item: any): CartItem => {
    if (item?.product) return item as CartItem;

    return {
      product: {
        id: item.productId,
        name: item.name || 'Product',
        price: Number(item.price || 0),
        color: item.color || '',
        category: 'general',
        images: item.image ? [item.image] : [],
        sizes: item.size ? [item.size] : [],
      },
      size: item.size || '',
      color: item.color,
      quantity: Number(item.quantity || 1),
      variantId: item.variantId || null,
    };
  };

  // Load cart on mount - from backend if logged in, from localStorage if not
  useEffect(() => {
    const loadCart = async () => {
      if (user) {
        try {
          const guestItems = getGuestCart();

          // On login, merge guest cart into user cart in backend and then clear guest storage.
          if (guestItems.length > 0) {
            await cartAPI.mergeGuestCart(guestItems);
            clearGuestCart();
          }

          const response = await cartAPI.get();
          const backendItems = response?.items || response?.data?.items || [];
          setCart((backendItems || []).map(normalizeServerItem));
        } catch (error: any) {
          // Silently fallback to localStorage for 401/500 errors
          if (error.response?.status === 401 || error.response?.status === 500) {
            console.log("⚠️ Backend cart unavailable, using localStorage");
          } else {
            console.error("❌ Error loading cart from backend:", error);
          }
          setCart(getGuestCart().map(guestToCartItem));
        }
      } else {
        // Guest cart stays fully local and browser-specific.
        setCart(getGuestCart().map(guestToCartItem));
      }
    };

    loadCart();
  }, [user]);

  // Keep guest cart synchronized across multiple browser tabs.
  useEffect(() => {
    if (user) return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'guest_cart') {
        setCart(getGuestCart().map(guestToCartItem));
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [user]);

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
      (item) =>
        String(item.product.id) === String(product.id) &&
        item.size === size &&
        item.color === color
    );

    const newQuantity = existingItem ? existingItem.quantity + 1 : 1;

    if (!user) {
      const nextGuest = addToGuestCart(
        toGuestCartItem({
          product,
          size,
          color,
          quantity: 1,
          variantId,
        }),
      );
      setCart(nextGuest.map(guestToCartItem));
      return;
    }

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

    // Update local state for logged-in users
    setCart((prevCart) => {
      if (existingItem) {
        return prevCart.map((item) =>
          String(item.product.id) === String(product.id) && item.size === size && item.color === color
            ? { ...item, quantity: item.quantity + 1, variantId }
            : item
        );
      }
      return [...prevCart, { product, size, color, quantity: 1, variantId }];
    });
  };

  const removeFromCart = async (productId: ProductId, size: string) => {
    if (!user) {
      const currentItem = cart.find((item) => String(item.product.id) === String(productId) && item.size === size);
      const nextGuest = removeFromGuestCart(
        String(productId),
        size,
        currentItem?.color,
        currentItem?.variantId,
      );
      setCart(nextGuest.map(guestToCartItem));
      return;
    }

    // Update backend if user is logged in (fail silently if backend unavailable)
    if (user) {
      try {
        const item = cart.find(i => String(i.product.id) === String(productId) && i.size === size);
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
      prevCart.filter((item) => !(String(item.product.id) === String(productId) && item.size === size))
    );
  };

  const updateQuantity = async (productId: ProductId, size: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId, size);
      return;
    }

    if (!user) {
      const currentItem = cart.find((item) => String(item.product.id) === String(productId) && item.size === size);
      const nextGuest = updateGuestCartQuantity(
        String(productId),
        size,
        quantity,
        currentItem?.color,
        currentItem?.variantId,
      );
      setCart(nextGuest.map(guestToCartItem));
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
        String(item.product.id) === String(productId) && item.size === size
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = async () => {
    if (!user) {
      clearGuestCart();
      setCart([]);
      return;
    }

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

    // Clear local state
    setCart([]);
  };

  const getCartCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + Number(item.product.price ?? 0) * item.quantity, 0);
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
