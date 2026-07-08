// =============================================================================
// REAL-TIME STOCK UPDATES - Frontend Implementation
// =============================================================================
// Purpose: Add real-time stock synchronization using Supabase Realtime
// Location: src/hooks/useRealTimeStock.ts (NEW FILE)
// =============================================================================

import { useEffect, useState } from 'react';
import { supabase } from './config/supabase';

interface StockStatus {
  exists: boolean;
  inStock: boolean;
  available: number;
  lowStock: boolean;
  loading: boolean;
  error: string | null;
}

interface UseRealTimeStockParams {
  productId: string | undefined;
  size: string | undefined;
  color?: string;
  quantity?: number;
}

/**
 * Hook to get real-time stock updates for a product variant
 * Subscribes to Supabase Realtime changes on product_inventory table
 */
export const useRealTimeStock = ({
  productId,
  size,
  color = 'default',
  quantity = 1
}: UseRealTimeStockParams): StockStatus => {
  const [stockStatus, setStockStatus] = useState<StockStatus>({
    exists: false,
    inStock: false,
    available: 0,
    lowStock: false,
    loading: true,
    error: null
  });

  useEffect(() => {
    // Don't subscribe if required params are missing
    if (!productId || !size) {
      setStockStatus({
        exists: false,
        inStock: false,
        available: 0,
        lowStock: false,
        loading: false,
        error: 'Missing product ID or size'
      });
      return;
    }

    // Fetch initial stock status
    const fetchInitialStock = async () => {
      try {
        setStockStatus(prev => ({ ...prev, loading: true, error: null }));

        const { data, error } = await supabase.rpc('check_stock_availability', {
          p_product_id: productId,
          p_size: size,
          p_color: color,
          p_quantity: quantity
        });

        if (error) throw error;

        setStockStatus({
          exists: data?.exists || false,
          inStock: data?.in_stock || false,
          available: data?.available || 0,
          lowStock: data?.low_stock || false,
          loading: false,
          error: null
        });
      } catch (err) {
        console.error('[useRealTimeStock] Error fetching initial stock:', err);
        setStockStatus(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch stock'
        }));
      }
    };

    fetchInitialStock();

    // Subscribe to real-time stock changes
    console.log('[useRealTimeStock] Subscribing to stock updates:', {
      productId,
      size,
      color
    });

    const channel = supabase
      .channel(`product-stock-${productId}-${size}-${color}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'product_inventory',
          filter: `product_id=eq.${productId}`
        },
        (payload: any) => {
          console.log('[useRealTimeStock] Real-time update received:', payload);

          // Check if this update is for our specific variant
          const newData = payload.new as any;
          const oldData = payload.old as any;

          // Handle DELETE event
          if (payload.eventType === 'DELETE' && oldData.size === size && oldData.color === color) {
            setStockStatus({
              exists: false,
              inStock: false,
              available: 0,
              lowStock: false,
              loading: false,
              error: 'Product variant no longer available'
            });
            return;
          }

          // Handle INSERT/UPDATE events
          if (newData && newData.size === size && newData.color === color) {
            const availableStock = newData.stock || 0;
            const threshold = newData.low_stock_threshold || 5;

            setStockStatus({
              exists: true,
              inStock: availableStock >= quantity,
              available: availableStock,
              lowStock: availableStock <= threshold && availableStock > 0,
              loading: false,
              error: null
            });

            // Show toast notification for significant changes
            if (oldData && oldData.stock !== newData.stock) {
              console.log(`[useRealTimeStock] Stock changed: ${oldData.stock} → ${newData.stock}`);
              
              // Optional: Trigger a toast notification
              if (newData.stock === 0) {
                // Product just went out of stock
                console.warn('[useRealTimeStock] Product is now OUT OF STOCK');
              } else if (oldData.stock === 0 && newData.stock > 0) {
                // Product just came back in stock
                console.log('[useRealTimeStock] Product is now BACK IN STOCK');
              }
            }
          }
        }
      )
      .subscribe((status: string) => {
        console.log('[useRealTimeStock] Subscription status:', status);
      });

    // Cleanup subscription on unmount
    return () => {
      console.log('[useRealTimeStock] Unsubscribing from stock updates');
      supabase.removeChannel(channel);
    };
  }, [productId, size, color, quantity]);

  return stockStatus;
};

// =============================================================================
// Stock Indicator Component (Updated)
// =============================================================================
// Purpose: Display real-time stock status with visual indicators
// Location: src/components/StockIndicator.tsx (UPDATE EXISTING)
// =============================================================================

/*
import React from 'react';
import { useRealTimeStock } from '../hooks/useRealTimeStock';
import { Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface StockIndicatorProps {
  productId: string;
  size: string;
  color?: string;
  quantity?: number;
  showAvailable?: boolean;
}

export const StockIndicator: React.FC<StockIndicatorProps> = ({
  productId,
  size,
  color = 'default',
  quantity = 1,
  showAvailable = true
}) => {
  const stockStatus = useRealTimeStock({ productId, size, color, quantity });

  // Loading state
  if (stockStatus.loading) {
    return (
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking stock...</span>
      </div>
    );
  }

  // Error state
  if (stockStatus.error) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{stockStatus.error}</span>
      </div>
    );
  }

  // Variant doesn't exist
  if (!stockStatus.exists) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <XCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Not available</span>
      </div>
    );
  }

  // Out of stock
  if (!stockStatus.inStock || stockStatus.available === 0) {
    return (
      <div className="flex items-center gap-2 text-red-600">
        <XCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Out of stock</span>
      </div>
    );
  }

  // Low stock
  if (stockStatus.lowStock) {
    return (
      <div className="flex items-center gap-2 text-orange-600">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm font-medium">
          Low stock
          {showAvailable && ` (${stockStatus.available} left)`}
        </span>
      </div>
    );
  }

  // In stock
  return (
    <div className="flex items-center gap-2 text-green-600">
      <CheckCircle className="w-4 h-4" />
      <span className="text-sm font-medium">
        In stock
        {showAvailable && stockStatus.available <= 10 && ` (${stockStatus.available} available)`}
      </span>
    </div>
  );
};
*/

// =============================================================================
// Product Detail Page Integration (Example)
// =============================================================================
// Purpose: Show how to integrate useRealTimeStock in ProductDetailPage
// Location: src/components/ProductDetailPage.tsx (UPDATE EXISTING)
// =============================================================================

/*
import { useRealTimeStock } from '../hooks/useRealTimeStock';

// Inside ProductDetailPage component:
export const ProductDetailPage = ({ productId }) => {
  const [selectedSize, setSelectedSize] = useState<string>();
  const [selectedColor, setSelectedColor] = useState<string>();
  const [quantity, setQuantity] = useState(1);

  // Use real-time stock hook
  const stockStatus = useRealTimeStock({
    productId,
    size: selectedSize,
    color: selectedColor,
    quantity
  });

  const handleAddToCart = () => {
    // Validate stock before adding to cart
    if (!stockStatus.inStock) {
      toast.error('This item is out of stock');
      return;
    }

    if (stockStatus.available < quantity) {
      toast.error(`Only ${stockStatus.available} items available`);
      return;
    }

    // Add to cart
    addToCart({
      productId,
      size: selectedSize,
      color: selectedColor,
      quantity
    });
  };

  return (
    <div>
      // ... size/color selectors ...

      // Display real-time stock status
      <StockIndicator
        productId={productId}
        size={selectedSize}
        color={selectedColor}
        quantity={quantity}
        showAvailable={true}
      />

      // Disable button if out of stock
      <button
        onClick={handleAddToCart}
        disabled={!stockStatus.inStock || stockStatus.loading}
      >
        {stockStatus.inStock ? 'Add to Cart' : 'Out of Stock'}
      </button>
    </div>
  );
};
*/

// =============================================================================
// Cart Validation Hook
// =============================================================================
// Purpose: Validate all cart items have sufficient stock before checkout
// Location: src/hooks/useCartStockValidation.ts (NEW FILE)
// =============================================================================

/*
import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';

interface CartItem {
  id: string;
  productId: string;
  size: string;
  color?: string;
  quantity: number;
  name: string;
}

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    productId: string;
    name: string;
    issue: string;
    available: number;
    requested: number;
  }>;
}

export const useCartStockValidation = (cartItems: CartItem[]) => {
  const [validationResult, setValidationResult] = useState<ValidationResult>({
    valid: true,
    errors: []
  });
  const [isValidating, setIsValidating] = useState(false);

  const validateStock = async () => {
    if (!cartItems || cartItems.length === 0) {
      setValidationResult({ valid: true, errors: [] });
      return;
    }

    setIsValidating(true);
    const errors: ValidationResult['errors'] = [];

    for (const item of cartItems) {
      const { data, error } = await supabase.rpc('check_stock_availability', {
        p_product_id: item.productId,
        p_size: item.size,
        p_color: item.color || 'default',
        p_quantity: item.quantity
      });

      if (error || !data) {
        errors.push({
          productId: item.productId,
          name: item.name,
          issue: 'Failed to check stock',
          available: 0,
          requested: item.quantity
        });
        continue;
      }

      if (!data.in_stock) {
        errors.push({
          productId: item.productId,
          name: item.name,
          issue: data.available === 0 ? 'Out of stock' : 'Insufficient stock',
          available: data.available,
          requested: item.quantity
        });
      }
    }

    setValidationResult({
      valid: errors.length === 0,
      errors
    });
    setIsValidating(false);
  };

  // Auto-validate on cart changes
  useEffect(() => {
    validateStock();
  }, [cartItems]);

  return {
    ...validationResult,
    isValidating,
    revalidate: validateStock
  };
};
*/

// =============================================================================
// Checkout Page Integration (Example)
// =============================================================================

/*
import { useCartStockValidation } from '../hooks/useCartStockValidation';

export const CheckoutPage = () => {
  const { cartItems } = useCart();
  const { valid, errors, isValidating, revalidate } = useCartStockValidation(cartItems);

  const handlePlaceOrder = async () => {
    // Revalidate stock right before placing order
    await revalidate();

    if (!valid) {
      toast.error('Some items in your cart are no longer available');
      return;
    }

    // Proceed with order creation
    // ...
  };

  return (
    <div>
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <h3 className="font-semibold text-red-800 mb-2">Stock Issues</h3>
          <ul className="space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-sm text-red-700">
                {error.name}: {error.issue} 
                (Available: {error.available}, Requested: {error.requested})
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={handlePlaceOrder}
        disabled={!valid || isValidating}
      >
        {isValidating ? 'Validating stock...' : 'Place Order'}
      </button>
    </div>
  );
};
*/

export default {};
