"use client"

import React, { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { useAdmin } from '../context/AdminContext'

interface StockStatusProps {
  productId: string | number;
  variant?: string;
  quantity?: number;
  showLabel?: boolean;
  className?: string;
}

interface StockInfo {
  available: number;
  inStock: boolean;
  alertLevel?: 'critical' | 'low' | 'warning' | 'ok';
}

export const StockStatus: React.FC<StockStatusProps> = ({
  productId,
  variant,
  quantity = 1,
  showLabel = true,
  className = '',
}) => {
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guard: Don't run if productId is missing
    if (!productId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchStockStatus = async () => {
      try {
        setLoading(true);
        const API_URL = import.meta.env.VITE_API_URL || '/api';
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`${API_URL}/stock/check-availability`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({
            items: [{
              productId,
              variant: variant || null,
              quantity,
            }],
          }),
        });

        // CRITICAL FIX: Check response.ok before parsing
        if (!response.ok) {
          throw new Error(`Stock check failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Only update state if component is still mounted
        if (!isMounted) return;

        if (data.status === 'success' && data.data.items && data.data.items.length > 0) {
          const item = data.data.items[0];
          setStockInfo({
            available: item.available,
            inStock: item.inStock,
            alertLevel: getAlertLevel(item.available),
          });
        } else {
          setStockInfo(null);
        }
      } catch (error) {
        console.error('Error fetching stock status:', error);
        // Only update state if component is still mounted
        if (isMounted) {
          setStockInfo(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchStockStatus();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [productId, variant, quantity]);

  const getAlertLevel = (stock: number): 'critical' | 'low' | 'warning' | 'ok' => {
    if (stock === 0) return 'critical';
    if (stock <= 5) return 'low';
    if (stock <= 10) return 'warning';
    return 'ok';
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-pulse h-4 w-24 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!stockInfo) return null;

  const { available, inStock, alertLevel } = stockInfo;

  // Out of stock
  if (!inStock || available === 0) {
    return (
      <div className={`flex items-center gap-2 text-red-600 ${className}`}>
        <AlertCircle className="w-4 h-4" />
        {showLabel && <span className="text-sm font-medium">Out of Stock</span>}
      </div>
    );
  }

  // Critical stock (1-5 items)
  if (alertLevel === 'critical' || alertLevel === 'low') {
    return (
      <div className={`flex items-center gap-2 text-orange-600 ${className}`}>
        <AlertTriangle className="w-4 h-4" />
        {showLabel && (
          <span className="text-sm font-medium">
            Only {available} left in stock!
          </span>
        )}
      </div>
    );
  }

  // Warning stock (6-10 items)
  if (alertLevel === 'warning') {
    return (
      <div className={`flex items-center gap-2 text-yellow-600 ${className}`}>
        <AlertTriangle className="w-4 h-4" />
        {showLabel && (
          <span className="text-sm font-medium">
            Only {available} left
          </span>
        )}
      </div>
    );
  }

  // In stock (11+ items)
  return (
    <div className={`flex items-center gap-2 text-green-600 ${className}`}>
      <CheckCircle className="w-4 h-4" />
      {showLabel && <span className="text-sm font-medium">In Stock</span>}
    </div>
  );
};

interface StockBadgeProps {
  stock: number;
  className?: string;
}

export const StockBadge: React.FC<StockBadgeProps> = ({ stock, className = '' }) => {
  if (stock === 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 ${className}`}>
        <AlertCircle className="w-3 h-3" />
        Out of Stock
      </span>
    );
  }

  if (stock <= 5) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 ${className}`}>
        <AlertTriangle className="w-3 h-3" />
        Low Stock ({stock})
      </span>
    );
  }

  if (stock <= 10) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ${className}`}>
        <AlertTriangle className="w-3 h-3" />
        {stock} left
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 ${className}`}>
      <CheckCircle className="w-3 h-3" />
      In Stock
    </span>
  );
};

interface StockIndicatorProps {
  productId: string | number;
  variant?: string;
  onStockStatusChange?: (inStock: boolean, available: number) => void;
}

export const StockIndicator: React.FC<StockIndicatorProps> = ({
  productId,
  variant,
  onStockStatusChange,
}) => {
  const [stockInfo, setStockInfo] = useState<StockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const { getProductStock } = useAdmin();

  useEffect(() => {
    // Guard: Don't run if productId is missing
    if (!productId) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchStockStatus = async () => {
      // Try admin-context snapshot first so local admin edits reflect immediately
      try {
        const adminSnapshot = getProductStock(productId);
        if (adminSnapshot) {
          const available = variant
            ? (adminSnapshot.sizes?.[variant] ?? 0)
            : Object.values(adminSnapshot.sizes || {}).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
          const info: StockInfo = {
            available,
            inStock: available > 0,
            alertLevel: available === 0 ? 'critical' : available <= 5 ? 'low' : available <= 10 ? 'warning' : 'ok',
          };
          
          if (isMounted) {
            setStockInfo(info);
            if (onStockStatusChange) onStockStatusChange(info.inStock, info.available);
            setLoading(false);
          }
          return; // do not poll when using admin snapshot
        }
      } catch (err) {
        // ignore and fallback to API
      }

      // Fallback to backend polling
      try {
        const API_URL = import.meta.env.VITE_API_URL || '/api';
        const response = await fetch(`${API_URL}/stock/check-availability`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [{
              productId,
              variant: variant || null,
              quantity: 1,
            }],
          }),
        });

        // CRITICAL FIX: Check response.ok before parsing
        if (!response.ok) {
          throw new Error(`Stock check failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Only update state if component is still mounted
        if (!isMounted) return;

        if (data.status === 'success' && data.data.items && data.data.items.length > 0) {
          const item = data.data.items[0];
          const info = {
            available: item.available,
            inStock: item.inStock,
            alertLevel: item.available === 0 ? 'critical' : item.available <= 5 ? 'low' : item.available <= 10 ? 'warning' : 'ok' as 'critical' | 'low' | 'warning' | 'ok',
          };
          setStockInfo(info);
          
          if (onStockStatusChange) {
            onStockStatusChange(item.inStock, item.available);
          }
        } else {
          setStockInfo(null);
        }
      } catch (error) {
        console.error('Error fetching stock status:', error);
        if (isMounted) {
          setStockInfo(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchStockStatus();
    
    // ✅ Listen for stock update events from checkout/orders
    const handleStockUpdate = (event: any) => {
      const orderItems = event.detail?.orderItems || [];
      const relevantItem = orderItems.find((item: any) => 
        item.productId === productId && (!variant || item.size === variant)
      );
      
      if (relevantItem && isMounted) {
        console.log('🔄 [STOCK INDICATOR] Stock updated for product', productId, 'variant', variant, '- refreshing...');
        fetchStockStatus();
      }
    };
    
    window.addEventListener('stockUpdated', handleStockUpdate);
    
    // Poll every 30 seconds for real-time updates
    pollInterval = setInterval(() => {
      if (isMounted) {
        fetchStockStatus();
      }
    }, 30000);
    
    // Cleanup function
    return () => {
      isMounted = false;
      window.removeEventListener('stockUpdated', handleStockUpdate);
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [productId, variant, onStockStatusChange, getProductStock]);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-500">Checking stock...</span>
      </div>
    );
  }

  if (!stockInfo) return null;

  return <StockBadge stock={stockInfo.available} />;
};

export default StockStatus;
