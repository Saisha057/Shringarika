import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for realtime subscriptions
// IMPORTANT: anon key must match the one in server/.env (SUPABASE_ANON_KEY)
const supabaseUrl = 'https://srdljxbumxkgjxoqqrzs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyZGxqeGJ1bXhrZ2p4b3FxcnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjk3MzAsImV4cCI6MjA4MDk0NTczMH0.9ky1F9JVhzAH2A6_2l_nVeLmEOGrKlTC5KFTnanMfDk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface VariantStock {
  stock: number;
  isLowStock: boolean;
  variantId: string;
  updatedAt: string;
}

interface StockMap {
  [size: string]: {
    [color: string]: VariantStock;
  };
}

interface UseVariantStockReturn {
  stockMap: StockMap | null;
  loading: boolean;
  error: string | null;
  getStock: (size: string, color: string) => VariantStock | null;
  isLowStock: (size: string, color: string) => boolean;
  refetch: () => Promise<void>;
}

/**
 * Real-time hook for product variant stock management
 * 
 * Features:
 * - Fetches initial stock data from backend API
 * - Subscribes to real-time updates via Supabase
 * - Automatically updates when stock changes
 * - Provides utility functions for checking stock levels
 * 
 * @param productId - The product ID to track stock for
 * @returns Stock data, loading state, error state, and utility functions
 */
export function useVariantStock(productId: string): UseVariantStockReturn {
  const [stockMap, setStockMap] = useState<StockMap | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<any>(null);
  const isMountedRef = useRef<boolean>(true);

  // Fetch stock data from backend API
  const fetchStock = useCallback(async () => {
    if (!productId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/stock/variant/${productId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch stock: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status === 'success' && data.data.variants) {
        if (isMountedRef.current) {
          setStockMap(data.data.variants);
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching variant stock:', err);
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch stock');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [productId]);

  // Subscribe to real-time updates from Supabase
  useEffect(() => {
    if (!productId) return;

    // Initial fetch
    fetchStock();

    // Set up real-time subscription
    const channel = supabase
      .channel(`product_inventory_${productId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'product_inventory',
          filter: `product_id=eq.${productId}`,
        },
        (payload) => {
          console.log('📡 Real-time stock update received:', payload);

          // Handle different event types
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
            const size = newData.size;
            const color = newData.color || 'default';
            const stock = newData.stock;
            const isLowStock = stock <= (newData.low_stock_threshold || 10);

            setStockMap((prevMap) => {
              if (!prevMap) return prevMap;

              const updatedMap = { ...prevMap };
              if (!updatedMap[size]) {
                updatedMap[size] = {};
              }

              updatedMap[size][color] = {
                stock,
                isLowStock,
                variantId: newData.id,
                updatedAt: newData.updated_at || new Date().toISOString(),
              };

              return updatedMap;
            });
          } else if (payload.eventType === 'DELETE') {
            const oldData = payload.old as any;
            const size = oldData.size;
            const color = oldData.color || 'default';

            setStockMap((prevMap) => {
              if (!prevMap) return prevMap;

              const updatedMap = { ...prevMap };
              if (updatedMap[size] && updatedMap[size][color]) {
                delete updatedMap[size][color];
                if (Object.keys(updatedMap[size]).length === 0) {
                  delete updatedMap[size];
                }
              }

              return updatedMap;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time subscription active for product:', productId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time subscription error');
        } else if (status === 'TIMED_OUT') {
          console.warn('⚠️ Real-time subscription timed out, reconnecting...');
        }
      });

    subscriptionRef.current = channel;

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      if (subscriptionRef.current) {
        console.log('🔌 Unsubscribing from real-time updates');
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [productId, fetchStock]);

  // Utility function: Get stock for specific size + color
  const getStock = useCallback(
    (size: string, color: string = 'default'): VariantStock | null => {
      if (!stockMap || !stockMap[size] || !stockMap[size][color]) {
        return null;
      }
      return stockMap[size][color];
    },
    [stockMap]
  );

  // Utility function: Check if variant is low stock
  const isLowStock = useCallback(
    (size: string, color: string = 'default'): boolean => {
      const variant = getStock(size, color);
      return variant ? variant.isLowStock : false;
    },
    [getStock]
  );

  // Refetch function for manual refresh
  const refetch = useCallback(async () => {
    await fetchStock();
  }, [fetchStock]);

  return {
    stockMap,
    loading,
    error,
    getStock,
    isLowStock,
    refetch,
  };
}
